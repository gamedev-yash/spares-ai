"""Initiative 10 (scoped to what Initiative 8 needs) -- conversational repair-register queries.

Initiative 8 requires the repair register to be "queryable through the chatbot"
(SS3.4: *available as a dashboard and queryable through the chatbot*; SS5.2: *planners,
buyers and management can query a single register, accessible through a dashboard or
chatbot*). That -- a conversational surface over data Initiative 8 already owns -- is the
ONLY Initiative 10 capability Initiative 8 depends on.

Deliberately NOT implemented here, because Initiative 8 does not need any of it: alternate
part matching, supplier recommendation, index-based price benchmarking, document ingestion
or OCR, material-master enrichment, or reservation/lead-time estimation.

This is the demo-mode path and it is fully deterministic -- no LLM call. In provider mode
the model reaches the same data through the read-only tools in `tools.py`
(`get_repair_register`, `check_repair_chain`, `compare_repair_vs_new`).

Routing precedence matters: this classifier runs BEFORE the RR-creation flow, because
several natural ways of asking a question ("I need to know what's out for repair") contain
RR-intent keywords and would otherwise start a requisition the user never asked for.
"""

from __future__ import annotations

import re

from app.ai import rr_assistant
from app.services import repair_register_service, repair_service
from app.services.csv_store import DataStore, Row, is_repairable_code

# The subject has to actually be refurbishment -- "repair" alone is not enough, since
# "I need a repair kit" is a requisition, not a question.
REPAIR_TOPIC_PATTERNS = (
    "out for repair", "under repair", "being repaired", "in for repair", "away for repair",
    "repair register", "repair status", "repair chain", "repairs", "refurbish",
    "at the vendor", "with the vendor", "coming back", "due back", "back from",
    # The duplicate-risk view is a register question too. These have to be multi-word:
    # bare "order" is an RR-creation keyword, and "reorder" contains it.
    "reorder point", "re-order point", "reorder level", "duplicate risk",
)
REPAIR_WORDS = ("repair", "refurbish", "refurbishment")

# Question / listing shape. Without one of these it is a request, not a query.
QUESTION_STARTERS = (
    "what", "which", "who", "when", "where", "is ", "are ", "any", "anything",
    "how many", "how much", "do we", "does", "has ", "have we", "show", "list", "tell me",
)
LISTING_PHRASES = ("show me", "list ", "give me a list", "what's the status", "whats the status")

OVERDUE_WORDS = ("overdue", "late", "past due", "delayed", "behind")
RISK_WORDS = ("reorder", "re-order", "at risk", "duplicate risk", "about to", "trigger")

MATERIAL_CODE_RE = re.compile(r"\b(\d{2,3}-\d{4,6})\b")


def _is_question_shaped(lower: str) -> bool:
    stripped = lower.strip()
    if stripped.endswith("?"):
        return True
    if any(stripped.startswith(s) for s in QUESTION_STARTERS):
        return True
    return any(p in stripped for p in LISTING_PHRASES)


def looks_like_repair_query(text: str) -> bool:
    """True when the user is ASKING about repairs rather than requesting a part."""
    if not text:
        return False
    lower = text.lower()

    on_topic = any(p in lower for p in REPAIR_TOPIC_PATTERNS) or (
        any(w in lower for w in REPAIR_WORDS) and _is_question_shaped(lower)
    )
    if not on_topic:
        return False

    # A phrase like "out for repair" is unambiguous even without a question mark.
    if any(p in lower for p in REPAIR_TOPIC_PATTERNS):
        return True
    return _is_question_shaped(lower)


def _plants(store: DataStore) -> list[str]:
    """Every plant name the user could reasonably name.

    A chain's plant comes from its *documents*, not the material master -- a material
    mastered at one site can be under repair for another. Taking the union across
    materials, requisitions and PRs means a plant is still recognised (and answered with
    "nothing here") even when it has no open chains.
    """
    names: set[str] = set()
    for table in (store.materials, store.rr, store.pr):
        names.update(row["plant"] for row in table.all() if row.get("plant"))
    # Longest first, so "Black Mountain" wins over a hypothetical "Black".
    return sorted(names, key=len, reverse=True)


def _detect_plant(store: DataStore, text: str) -> str | None:
    lower = text.lower()
    for plant in _plants(store):
        if plant.lower() in lower:
            return plant
    return None


def _resolve_material(store: DataStore, text: str) -> Row | None:
    """A material code if one was typed, otherwise the best description match."""
    match = MATERIAL_CODE_RE.search(text)
    if match:
        code = match.group(1)
        found = next((m for m in store.materials.all() if m.get("material_code") == code), None)
        if found is not None:
            return found

    candidates = rr_assistant.search_material_candidates(store, text, limit=8)
    if not candidates:
        return None

    materials = {m["id"]: m for m in store.materials.all()}
    # Prefer a repairable hit -- the question was about repairs.
    for candidate in candidates:
        material = materials.get(candidate["id"])
        if material and is_repairable_code(material.get("material_code")):
            return material
    return materials.get(candidates[0]["id"])


def _fmt_money(value: float) -> str:
    return f"R{value:,.0f}"


def _chain_line(chain: dict) -> str:
    ref = chain.get("repair_po_number") or chain.get("repair_pr_number") or "repair document"
    where = f"at **{chain['vendor']}**" if chain.get("vendor") else "awaiting dispatch to a vendor"
    when = ""
    if chain.get("expected_return"):
        when = (
            f", **{chain['days_overdue']} day(s) overdue**"
            if chain.get("overdue")
            else f", due back **{chain['expected_return']}**"
        )
    return f"- {chain['quantity_under_repair']:g} x {ref} {where}{when}"


FOLLOW_UPS = [
    {"id": "menu_repair_overdue", "label": "Show overdue repairs", "description": "Chains past their expected return"},
    {"id": "menu_repair_risk", "label": "At reorder point", "description": "Could be ordered again while out"},
    {"id": "menu_repair_register", "label": "Whole register", "description": "Everything currently out for repair"},
]


def _material_answer(store: DataStore, material: Row, plant: str | None) -> tuple[str, list[dict] | None]:
    code = material.get("material_code")
    desc = material.get("description")

    if not is_repairable_code(code):
        return (
            f"**{code} - {desc}** is not a repairable item, so it is never sent out for "
            f"refurbishment. Repairable spares carry an 80-series material code.",
            None,
        )

    result = repair_service.check_duplicate(store, material["id"], plant)
    scope = f" at {plant}" if plant else ""

    if not result["has_active_chain"]:
        return (
            f"Nothing is currently out for repair for **{code} - {desc}**{scope}. "
            f"It is a repairable item, so a condition-to-repair declaration is still required "
            f"before a new requisition can be raised for it.",
            None,
        )

    lines = [
        f"**{code} - {desc}** has {len(result['chains'])} repair "
        f"{'chain' if len(result['chains']) == 1 else 'chains'} open{scope}, "
        f"{result['total_quantity_under_repair']:g} unit(s) in total:",
        "",
    ]
    lines += [_chain_line(c) for c in result["chains"]]

    econ = repair_service.economic_evaluation(store, material["id"], plant)
    if econ:
        lines += [
            "",
            f"Repair in progress **{_fmt_money(econ['repair_total_cost'])}** vs "
            f"**{_fmt_money(econ['new_total_cost'])}** new "
            f"({econ['new_lead_time_days']} day lead time).",
        ]
        if econ["saving_if_repair_used"] > 0:
            lines.append(
                f"Letting the repair finish avoids about "
                f"**{_fmt_money(econ['saving_if_repair_used'])}** ({econ['saving_pct']:.0f}%)."
            )
    return "\n".join(lines), None


def _list_answer(
    store: DataStore, status: str | None, plant: str | None, heading: str
) -> tuple[str, list[dict] | None]:
    register = repair_register_service.get_register(store, plant=plant, status=status)
    summary = register["summary"]
    items = register["items"]
    scope = f" at {plant}" if plant else ""

    if not items:
        return f"Nothing matches that{scope} right now.", FOLLOW_UPS

    lines = [
        f"**{heading}{scope}: {summary['open_chain_count']}** "
        f"({summary['total_quantity_under_repair']:g} units, "
        f"{_fmt_money(summary['total_value_under_repair'])} in flight).",
    ]
    if status is None:
        lines.append(
            f"{summary['overdue_count']} overdue - "
            f"{summary['duplicate_risk_count']} at or below the reorder point while still out."
        )
    lines.append("")

    for row in items[:5]:
        ref = row.get("repair_po_number") or row.get("repair_pr_number") or "-"
        state = (
            f"{row['days_overdue']}d overdue"
            if row["overdue"]
            else f"due {row['expected_return'] or 'TBC'}"
        )
        flag = " - at reorder point" if row["reorder_triggered"] else ""
        lines.append(
            f"- **{row['material_code']}** ({row['plant']}) - {row['quantity_under_repair']:g} at "
            f"{row['vendor'] or 'vendor TBC'} on {ref}, {state}, stock {row['stock_on_hand']}{flag}"
        )

    if len(items) > 5:
        lines.append(f"\n_{len(items) - 5} more on the repair register._")

    return "\n".join(lines), FOLLOW_UPS


def answer(store: DataStore, user: Row, text: str) -> tuple[str, list[dict] | None]:
    """Answer a repair-register question. Read-only -- never writes anything."""
    lower = text.lower()
    plant = _detect_plant(store, text)

    # "is X under repair?" / "when is 80-10059 coming back?"
    material = _resolve_material(store, text)
    if material is not None:
        return _material_answer(store, material, plant)

    if any(w in lower for w in OVERDUE_WORDS):
        return _list_answer(store, "OVERDUE", plant, "Overdue repairs")

    if any(w in lower for w in RISK_WORDS):
        return _list_answer(store, "REORDER_TRIGGERED", plant, "Out for repair and at the reorder point")

    return _list_answer(store, None, plant, "Currently out for repair")
