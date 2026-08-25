"""Chat orchestrator: the single place that decides what happens with an incoming chat
turn. Demo mode uses fully deterministic routing (no LLM call at all); provider mode hands
routing to the model via its native tool-calling loop. Either way, every data access or
write goes through app/ai/tools.py -- never a direct store read built from user text.

Chat session/message state lives only in the in-memory ChatStore (app.services.csv_store) --
it does not survive a backend restart. That's a deliberate limitation for this demo build;
everything the assistant *does* (RRs, approvals, audit, notifications) is CSV-persisted.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.ai import rr_assistant
from app.ai.factory import get_llm_provider, is_demo_mode
from app.ai.rr_assistant import RRDraftState
from app.ai.tools import ToolContext, execute_tool, get_tool_specs
from app.core.exceptions import NotFoundError
from app.services.csv_store import DataStore, Row

SYSTEM_PROMPT = (
    "You are the Spares AI procurement assistant for a mining company. You help users create "
    "requisitions (RRs), and look up materials, requisitions, purchase orders, cycle-time, "
    "bottlenecks, and approval status. Always use the provided tools to look up or create real "
    "data -- never invent numbers or IDs. Keep replies concise (2-4 sentences) and procurement-"
    "appropriate. You cannot approve/reject anything yourself; direct users to the Approvals page "
    "for that."
)

FALLBACK_OPTIONS = [
    {"id": "menu_open_prs", "label": "Show open PRs", "description": "Currently open purchase requisitions"},
    {"id": "menu_open_pos", "label": "Show open POs", "description": "Currently open purchase orders"},
    {"id": "menu_cycle_time", "label": "Cycle time", "description": "RR-to-PO cycle time stats"},
    {"id": "menu_create_rr", "label": "Create a requisition", "description": "Start a new RR"},
]


def _get_or_create_session(store: DataStore, user: Row, session_id: int | None) -> Row:
    if session_id is not None:
        session = store.chat.get_session(session_id)
        if session is None or session["user_id"] != user["id"]:
            raise NotFoundError(f"Chat session {session_id} not found")
        return session
    return store.chat.create_session(user["id"], "New conversation")


def _run_demo_menu_shortcut(ctx: ToolContext, option_id: str) -> str | None:
    if option_id == "menu_open_prs":
        result = execute_tool(ctx, "get_open_prs", {"limit": 5})
        return f"There are {result['open_pr_count']} open PRs. The oldest: " + ", ".join(f"{i['number']} ({i['days_open']}d)" for i in result["items"][:5])
    if option_id == "menu_open_pos":
        result = execute_tool(ctx, "get_open_pos", {"limit": 5})
        return f"There are {result['open_po_count']} open POs. The oldest: " + ", ".join(f"{i['number']} ({i['days_open']}d)" for i in result["items"][:5])
    if option_id == "menu_cycle_time":
        result = execute_tool(ctx, "get_cycle_time", {})
        return f"Average RR-to-PO cycle time is {result['average_days']} days (median {result['median_days']}, P90 {result['p90_days']}). The slowest stage is {result['bottleneck_stage']}."
    return None


def handle_chat_turn(store: DataStore, user: Row, session_id: int | None, message: str | None, option_id: str | None) -> dict:
    session = _get_or_create_session(store, user, session_id)
    ctx = ToolContext(store=store, current_user=user)

    if message:
        store.chat.add_message(session["id"], "user", message, None, datetime.now(timezone.utc).isoformat())
        if session["title"] == "New conversation":
            session["title"] = message[:80]
    elif option_id:
        history = store.chat.messages_for_session(session["id"])
        last_assistant = next((m for m in reversed(history) if m["role"] == "assistant"), None)
        chosen_label = option_id
        if last_assistant and last_assistant.get("options"):
            match = next((o for o in last_assistant["options"] if o.get("id") == option_id), None)
            if match:
                chosen_label = match["label"]
        store.chat.add_message(session["id"], "user", chosen_label, None, datetime.now(timezone.utc).isoformat())

    state = RRDraftState.from_dict(session.get("assistant_state"))
    demo_mode = is_demo_mode()

    reply_text: str
    reply_options: list[dict] | None = None

    in_rr_flow = state.stage not in ("collecting", "done") or bool(message and rr_assistant.looks_like_rr_request(message))

    if in_rr_flow:
        turn = rr_assistant.advance(store, user, state, message, option_id)
        if turn.ready_to_create:
            result = execute_tool(
                ctx,
                "create_rr",
                {
                    "plant": user["plant"],
                    "department": user["department"],
                    "required_date": turn.state.required_date,
                    "purpose": turn.state.purpose or turn.state.material_label or "Requested via AI assistant",
                    "line_items": [{"material_id": turn.state.material_id, "quantity": turn.state.quantity}],
                },
            )
            if "error" in result:
                reply_text = f"I couldn't create that requisition: {result['error']}"
            else:
                reply_text = f"Done -- **{result['rr_number']}** has been created and sent for DOA approval (estimated value R{result['total_estimated_value']:,.2f})."
            session["assistant_state"] = None
        else:
            reply_text = turn.text
            reply_options = turn.options
            session["assistant_state"] = turn.state.to_dict() if turn.state else None
    elif option_id and option_id.startswith("menu_"):
        shortcut_reply = _run_demo_menu_shortcut(ctx, option_id)
        reply_text = shortcut_reply or "Sorry, I couldn't run that lookup."
        session["assistant_state"] = None
    elif demo_mode:
        reply_text = (
            "I can help you create a requisition, or look up open PRs/POs, cycle time, or bottlenecks. "
            "What would you like to do?"
        )
        reply_options = FALLBACK_OPTIONS
        session["assistant_state"] = None
    else:
        provider = get_llm_provider()
        reply_text = provider.run_tool_loop(
            SYSTEM_PROMPT,
            message or "",
            get_tool_specs(),
            lambda name, args: execute_tool(ctx, name, args),
        )
        session["assistant_state"] = None

    assistant_msg = store.chat.add_message(session["id"], "assistant", reply_text, reply_options, datetime.now(timezone.utc).isoformat())

    return {
        "session_id": session["id"],
        "session_title": session["title"],
        "message": {"id": assistant_msg["id"], "role": "assistant", "text": assistant_msg["text"], "options": assistant_msg["options"], "created_at": assistant_msg["created_at"]},
        "demo_mode": demo_mode,
    }
