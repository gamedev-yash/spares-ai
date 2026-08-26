"""Deterministic slot-filling for AI-guided RR creation (AI_MODE=demo path).

This is the "AI intervention at RR creation" feature: extract what it can from free text,
ask for whatever's missing one step at a time, then create the RR through the exact same
validated `rr_service.create_rr` / `create_rr` tool everything else uses -- the assistant
never inserts a row itself.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, timedelta

from app.services import repair_service
from app.services.csv_store import ATTESTATION_STATEMENT, DataStore, Row

STOPWORDS = {
    "the", "a", "an", "for", "and", "with", "need", "needed", "needing", "require", "requires",
    "required", "please", "want", "some", "this", "that", "next", "week", "weeks", "day", "days",
    "month", "months", "tomorrow", "today", "asap", "urgent", "urgently", "unit", "units", "pcs",
}

QUANTITY_RE = re.compile(r"\b(\d{1,4})\b")


@dataclass
class RRDraftState:
    # collecting -> awaiting_material_choice -> awaiting_quantity -> awaiting_date
    #   -> awaiting_duplicate_decision (Initiative 8, only when a repair is in flight)
    #   -> awaiting_attestation        (Initiative 8, only for repairable materials)
    #   -> awaiting_confirmation -> done
    stage: str = "collecting"
    material_id: int | None = None
    material_label: str | None = None
    material_candidates: list[dict] = field(default_factory=list)
    quantity: float | None = None
    required_date: str | None = None  # ISO date
    purpose: str | None = None
    # Initiative 8: the user has seen the active-repair warning and chosen to continue.
    duplicate_ack: bool = False
    # Initiative 8: the user has made the condition-to-repair declaration. Without this the
    # requisition cannot be created -- rr_service enforces it regardless of what is set here.
    attested: bool = False

    def to_dict(self) -> dict:
        return {
            "flow": "create_rr",
            "stage": self.stage,
            "material_id": self.material_id,
            "material_label": self.material_label,
            "material_candidates": self.material_candidates,
            "quantity": self.quantity,
            "required_date": self.required_date,
            "purpose": self.purpose,
            "duplicate_ack": self.duplicate_ack,
            "attested": self.attested,
        }

    @classmethod
    def from_dict(cls, data: dict | None) -> "RRDraftState":
        if not data:
            return cls()
        return cls(
            stage=data.get("stage", "collecting"),
            material_id=data.get("material_id"),
            material_label=data.get("material_label"),
            material_candidates=data.get("material_candidates") or [],
            quantity=data.get("quantity"),
            required_date=data.get("required_date"),
            purpose=data.get("purpose"),
            duplicate_ack=bool(data.get("duplicate_ack")),
            attested=bool(data.get("attested")),
        )


RR_INTENT_KEYWORDS = ("need", "require", "requisition", "order", "request", "get me", "replace", "replacement")


def looks_like_rr_request(text: str) -> bool:
    lower = text.lower()
    return any(kw in lower for kw in RR_INTENT_KEYWORDS)


def extract_quantity(text: str) -> float | None:
    match = QUANTITY_RE.search(text)
    return float(match.group(1)) if match else None


def extract_required_date(text: str) -> str | None:
    lower = text.lower()
    today = date.today()
    if "tomorrow" in lower:
        return (today + timedelta(days=1)).isoformat()
    if "next week" in lower:
        return (today + timedelta(days=7)).isoformat()
    if "next month" in lower:
        return (today + timedelta(days=30)).isoformat()
    match = re.search(r"in (\d{1,3}) (day|days|week|weeks)", lower)
    if match:
        n = int(match.group(1))
        unit = match.group(2)
        days = n * 7 if "week" in unit else n
        return (today + timedelta(days=days)).isoformat()
    try:
        return date.fromisoformat(text.strip()).isoformat()
    except ValueError:
        return None


def search_material_candidates(store: DataStore, text: str, limit: int = 5) -> list[dict]:
    tokens = [w for w in re.findall(r"[a-zA-Z]{4,}", text.lower()) if w not in STOPWORDS]
    if not tokens:
        return []

    candidates = store.materials.filter(lambda m: bool(m.get("active")))
    scored = []
    for m in candidates:
        haystack = f"{m['description']} {m['material_group']} {m['material_type']}".lower()
        score = sum(1 for t in tokens if t in haystack)
        if score > 0:
            scored.append((score, m))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [
        {"id": m["id"], "label": f"{m['material_code']} - {m['description']}", "description": f"{m['material_group']} - R{float(m.get('last_po_price') or 0):,.2f}"}
        for _, m in scored[:limit]
    ]


def extract_purpose(text: str) -> str:
    cleaned = QUANTITY_RE.sub("", text).strip()
    return cleaned[:255] if cleaned else text[:255]


@dataclass
class AssistantTurn:
    text: str
    options: list[dict] | None = None
    state: RRDraftState | None = None
    ready_to_create: bool = False


def advance(store: DataStore, user: Row, state: RRDraftState, message: str | None, option_id: str | None) -> AssistantTurn:
    """Advance the slot-filling state machine by one user turn."""

    if message:
        # Re-run slot extraction on every free-text turn (guarded by `is None`), not just the
        # first -- otherwise a plain-text answer to "how many?"/"when?" asked on a later turn
        # is silently dropped and the assistant repeats the same question forever.
        if state.quantity is None:
            state.quantity = extract_quantity(message)
        if state.required_date is None:
            state.required_date = extract_required_date(message)
        if state.purpose is None:
            state.purpose = extract_purpose(message)
        if state.material_id is None and not state.material_candidates:
            candidates = search_material_candidates(store, message)
            if len(candidates) == 1:
                state.material_id = candidates[0]["id"]
                state.material_label = candidates[0]["label"]
            elif len(candidates) > 1:
                state.material_candidates = candidates

    if option_id and state.stage == "awaiting_material_choice":
        chosen = next((c for c in state.material_candidates if str(c["id"]) == option_id), None)
        if chosen:
            state.material_id = chosen["id"]
            state.material_label = chosen["label"]
            state.material_candidates = []

    if option_id == "cancel_create_rr":
        return AssistantTurn(text="No problem -- cancelled. Let me know if you'd like to start another requisition.", state=RRDraftState())

    # Initiative 8 Layer 2: the user was warned a repair is already in flight and chose to
    # continue anyway. That is allowed by design -- a genuine second failure is a real case.
    if option_id == "proceed_despite_repair":
        state.duplicate_ack = True

    if option_id == "confirm_attestation":
        state.attested = True

    if option_id == "confirm_create_rr":
        state.stage = "done"
        return AssistantTurn(text="", state=state, ready_to_create=True)

    # Decide what's still missing, in a fixed order.
    if state.material_id is None:
        if state.material_candidates:
            state.stage = "awaiting_material_choice"
            return AssistantTurn(
                text="I found a few materials that might match -- which one did you mean?",
                options=[{"id": str(c["id"]), "label": c["label"], "description": c["description"]} for c in state.material_candidates],
                state=state,
            )
        state.stage = "collecting"
        return AssistantTurn(text="Which material do you need? (You can use its description or material code.)", state=state)

    if state.quantity is None:
        state.stage = "awaiting_quantity"
        return AssistantTurn(text=f"How many units of {state.material_label} do you need?", state=state)

    if state.required_date is None:
        state.stage = "awaiting_date"
        return AssistantTurn(text="When do you need this by? (e.g. 'next week', 'in 10 days', or a date like 2026-09-01)", state=state)

    # --- Initiative 8 Layer 2: the conversational duplicate guard --------------------
    # Only repairable (80-series) materials reach this branch, so nothing changes for the
    # ordinary new-buy flow.
    if repair_service.material_is_repairable(store, state.material_id):
        check = repair_service.check_duplicate(store, state.material_id, user["plant"])

        if check["has_active_chain"] and not state.duplicate_ack:
            state.stage = "awaiting_duplicate_decision"
            return AssistantTurn(
                text=_duplicate_warning(store, state, user, check),
                options=[
                    {"id": "proceed_despite_repair", "label": "Proceed anyway", "description": "Raise the requisition despite the repair in progress"},
                    {"id": "cancel_create_rr", "label": "Wait for the repair", "description": "Don't raise a new requisition"},
                ],
                state=state,
            )

        if not state.attested:
            state.stage = "awaiting_attestation"
            return AssistantTurn(
                text=(
                    f"**{state.material_label}** is a repairable item, so a condition-to-repair "
                    "declaration is required before a new requisition can be raised.\n\n"
                    f"> _{ATTESTATION_STATEMENT}_\n\n"
                    "Please confirm this is the case."
                ),
                options=[
                    {"id": "confirm_attestation", "label": "I confirm it cannot be repaired", "description": "Records the declaration against this requisition"},
                    {"id": "cancel_create_rr", "label": "Cancel", "description": "Discard this draft"},
                ],
                state=state,
            )

    state.stage = "awaiting_confirmation"
    summary = (
        f"To confirm: **{state.quantity:g}x {state.material_label}**, needed by **{state.required_date}**"
        + (f", for: {state.purpose}" if state.purpose else "")
        + f". This will be submitted for {user['plant']} / {user['department']} and routed for DOA approval."
    )
    if state.attested:
        summary += "\n\nYour condition-to-repair declaration will be recorded against it and shown to the approver."
    if state.duplicate_ack:
        summary += " The active repair will be flagged on the requisition for the approver to see."

    return AssistantTurn(
        text=summary,
        options=[
            {"id": "confirm_create_rr", "label": "Confirm & create RR", "description": "Submit this requisition"},
            {"id": "cancel_create_rr", "label": "Cancel", "description": "Discard this draft"},
        ],
        state=state,
    )


def _duplicate_warning(store: DataStore, state: RRDraftState, user: Row, check: dict) -> str:
    """The conversational form of the Layer 2 alert: what is already in flight, plus the
    economic comparison, so the decision is made on the numbers (Initiative 8 SS3.3)."""
    chain = check["chains"][0]
    lines = [
        f"**A repair for this material is already in progress.**",
        "",
        f"- {chain['quantity_under_repair']:g} unit(s) of **{check['material_description']}** "
        f"({check['material_code']}) are with **{chain['vendor'] or 'a vendor'}**"
        + (f" on {chain['repair_po_number']}" if chain["repair_po_number"] else f" on {chain['repair_pr_number']}"),
    ]
    if chain["expected_return"]:
        if chain["overdue"]:
            lines.append(f"- Expected back on **{chain['expected_return']}** - now **{chain['days_overdue']} day(s) overdue**")
        else:
            lines.append(f"- Expected back on **{chain['expected_return']}**")
    lines.append(f"- Open for {chain['days_open']} day(s)")

    econ = repair_service.economic_evaluation(store, state.material_id, user["plant"])
    if econ:
        lines += [
            "",
            f"Repair in progress: **R{econ['repair_total_cost']:,.2f}**  ·  "
            f"New unit(s): **R{econ['new_total_cost']:,.2f}** "
            f"({econ['new_lead_time_days']} day lead time)",
        ]
        if econ["saving_if_repair_used"] > 0:
            lines.append(
                f"Letting the repair complete avoids about **R{econ['saving_if_repair_used']:,.2f}** "
                f"({econ['saving_pct']:.0f}%) of new spend."
            )
        if econ["repair_is_overdue"]:
            lines.append("_Note: the repair has missed its expected return date, so a new unit may still be justified._")

    lines += ["", "Do you still wish to proceed?"]
    return "\n".join(lines)
