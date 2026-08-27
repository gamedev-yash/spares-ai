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

from app.services import utilization_service
from app.services.csv_store import DataStore, Row

STOPWORDS = {
    "the", "a", "an", "for", "and", "with", "need", "needed", "needing", "require", "requires",
    "required", "please", "want", "some", "this", "that", "next", "week", "weeks", "day", "days",
    "month", "months", "tomorrow", "today", "asap", "urgent", "urgently", "unit", "units", "pcs",
}

QUANTITY_RE = re.compile(r"\b(\d{1,4})\b")


@dataclass
class RRDraftState:
    # collecting -> awaiting_material_choice -> awaiting_quantity -> awaiting_date ->
    #   [OAR only: awaiting_reservation_type -> awaiting_reservation_detail ->
    #    awaiting_purpose -> awaiting_planned_date] -> awaiting_confirmation -> done
    stage: str = "collecting"
    material_id: int | None = None
    material_label: str | None = None
    material_candidates: list[dict] = field(default_factory=list)
    quantity: float | None = None
    required_date: str | None = None  # ISO date
    purpose: str | None = None

    # Initiative 13 -- OAR consumption-plan slots, only collected when the chosen
    # material classifies as OAR (see utilization_service.classify_material).
    is_oar: bool | None = None
    reservation_type: str | None = None  # JOB_CARD | STRAIGHT
    job_card_number: str | None = None
    project: str | None = None
    equipment: str | None = None
    planned_consumption_date: str | None = None  # ISO date
    # True only once the user has explicitly answered the OAR "what's this for" question --
    # an OAR request never reuses the generic purpose auto-extracted from the opening
    # message (see advance()), since that text is usually too thin to plan a date against.
    purpose_confirmed: bool = False

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
            "is_oar": self.is_oar,
            "reservation_type": self.reservation_type,
            "job_card_number": self.job_card_number,
            "project": self.project,
            "equipment": self.equipment,
            "planned_consumption_date": self.planned_consumption_date,
            "purpose_confirmed": self.purpose_confirmed,
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
            is_oar=data.get("is_oar"),
            reservation_type=data.get("reservation_type"),
            job_card_number=data.get("job_card_number"),
            project=data.get("project"),
            equipment=data.get("equipment"),
            planned_consumption_date=data.get("planned_consumption_date"),
            purpose_confirmed=data.get("purpose_confirmed", False),
        )


RR_INTENT_KEYWORDS = ("need", "require", "requisition", "order", "request", "get me", "replace", "replacement")

# Stages where a free-text reply answers an Initiative-13 OAR consumption-plan question
# (job card number, equipment, purpose, planned date) -- the generic quantity/date/purpose
# auto-extraction below must NOT run on these turns, or a job-card number like "JC-4421"
# gets mis-captured as a quantity, or an equipment name gets mis-captured as the purpose.
OAR_SLOT_STAGES = {"awaiting_reservation_type", "awaiting_reservation_detail", "awaiting_purpose", "awaiting_planned_date"}

VAGUE_PURPOSES = {"pump seal", "seal", "spares", "spare part", "part", "material", "maintenance", "repair", "replacement"}


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
        # is silently dropped and the assistant repeats the same question forever. Skipped
        # entirely on an OAR-slot turn (see OAR_SLOT_STAGES) so a job-card number or
        # equipment name typed there isn't mis-captured as quantity/date/purpose.
        if state.stage not in OAR_SLOT_STAGES:
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

    if state.is_oar is None:
        material = store.materials.get(state.material_id)
        if material is not None:
            classification, _reason = utilization_service.classify_material(material)
            state.is_oar = classification == "OAR"

    if state.is_oar:
        if state.reservation_type is None:
            if option_id in ("reservation_job_card", "reservation_straight"):
                state.reservation_type = "JOB_CARD" if option_id == "reservation_job_card" else "STRAIGHT"
            elif message:
                lower = message.lower()
                if "job" in lower and "card" in lower:
                    state.reservation_type = "JOB_CARD"
                elif "straight" in lower:
                    state.reservation_type = "STRAIGHT"
            if state.reservation_type is None:
                state.stage = "awaiting_reservation_type"
                return AssistantTurn(
                    text=(
                        f"This material is classified as **OAR** (order-as-required) -- before creating the "
                        f"reservation I need a consumption plan. Is this linked to a job card, or a straight reservation?"
                    ),
                    options=[
                        {"id": "reservation_job_card", "label": "Job-card-linked", "description": "This reservation is tied to an existing job card"},
                        {"id": "reservation_straight", "label": "Straight reservation", "description": "No job card -- I'll capture the project/equipment/purpose instead"},
                    ],
                    state=state,
                )

        if state.reservation_type == "JOB_CARD" and state.job_card_number is None:
            if message:
                state.job_card_number = message.strip()[:40]
            else:
                state.stage = "awaiting_reservation_detail"
                return AssistantTurn(text="What's the job card number for this reservation?", state=state)

        if state.reservation_type == "STRAIGHT" and not (state.equipment or state.project):
            if message:
                state.equipment = message.strip()[:120]
            else:
                state.stage = "awaiting_reservation_detail"
                return AssistantTurn(
                    text="No job card -- please tell me the project, equipment, or operational activity this is for.",
                    state=state,
                )

        if not state.purpose_confirmed:
            if message and state.stage == "awaiting_purpose":
                candidate = extract_purpose(message)
                if len(candidate.strip()) >= 12 and candidate.strip().lower() not in VAGUE_PURPOSES:
                    state.purpose = candidate
                    state.purpose_confirmed = True
                else:
                    return AssistantTurn(
                        text=(
                            "That's still a bit vague to plan against -- describe the specific job, shutdown, or "
                            "activity this material is for."
                        ),
                        state=state,
                    )
            if not state.purpose_confirmed:
                state.stage = "awaiting_purpose"
                return AssistantTurn(
                    text=(
                        "What's this material actually for? Be specific about the job/shutdown/activity -- "
                        "\"pump seal\" alone is too vague to plan a consumption date against."
                    ),
                    state=state,
                )

        if state.planned_consumption_date is None:
            if message and state.stage == "awaiting_planned_date":
                state.planned_consumption_date = extract_required_date(message)
            if state.planned_consumption_date is None:
                state.stage = "awaiting_planned_date"
                return AssistantTurn(
                    text="When do you plan to actually consume/use this material? (e.g. 'in 3 weeks', or a date like 2026-09-15)",
                    state=state,
                )
        state.required_date = state.required_date or state.planned_consumption_date

    if state.required_date is None:
        state.stage = "awaiting_date"
        return AssistantTurn(text="When do you need this by? (e.g. 'next week', 'in 10 days', or a date like 2026-09-01)", state=state)

    state.stage = "awaiting_confirmation"

    if state.is_oar:
        material = store.materials.get(state.material_id)
        risk = utilization_service.assess_risk(store, material, user["plant"], user["department"], state.quantity, user["id"]) if material else None
        check = utilization_service.stock_check(store, material, user["plant"], state.quantity) if material else None

        lead_note = ""
        if material and state.planned_consumption_date:
            lead_days = int(material.get("lead_time_days") or 0)
            days_until = (date.fromisoformat(state.planned_consumption_date) - date.today()).days
            if days_until < lead_days:
                lead_note = (
                    f"\n\n**Lead-time warning:** the selected consumption date is earlier than the expected "
                    f"{lead_days}-day procurement lead time. Please confirm whether this is an emergency requirement."
                )
        stock_note = ""
        if check and check["matches"]:
            stock_note = (
                f"\n\n**Potential purchase avoidance detected:** {len(check['matches'])} existing/alternate stock "
                f"match(es) found (est. avoided value R{check['estimated_avoided_value']:,.2f}). You'll be able to "
                f"act on this from the Redeployment page after submitting."
            )
        risk_note = f"\n\nNM/SM risk for this request: **{risk['level']}** ({risk['score']}%)." if risk else ""
        reservation_desc = f"job card {state.job_card_number}" if state.reservation_type == "JOB_CARD" else (state.equipment or state.project or "the stated purpose")

        summary = (
            f"To confirm: **{state.quantity:g}x {state.material_label}** (OAR), for **{reservation_desc}**, "
            f"planned consumption **{state.planned_consumption_date}**, purpose: {state.purpose}."
            f"{risk_note}{stock_note}{lead_note}"
            f"\n\nThis will create the reservation (with a mock SAP reservation number and a Spares AI tracking ID) "
            f"and route it for DOA approval."
        )
    else:
        summary = (
            f"To confirm: **{state.quantity:g}x {state.material_label}**, needed by **{state.required_date}**"
            + (f", for: {state.purpose}" if state.purpose else "")
            + f". This will be submitted for {user['plant']} / {user['department']} and routed for DOA approval."
        )
    return AssistantTurn(
        text=summary,
        options=[
            {"id": "confirm_create_rr", "label": "Confirm & create RR", "description": "Submit this requisition"},
            {"id": "cancel_create_rr", "label": "Cancel", "description": "Discard this draft"},
        ],
        state=state,
    )
