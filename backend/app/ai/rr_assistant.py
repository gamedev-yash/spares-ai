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

from app.services.csv_store import DataStore, Row

STOPWORDS = {
    "the", "a", "an", "for", "and", "with", "need", "needed", "needing", "require", "requires",
    "required", "please", "want", "some", "this", "that", "next", "week", "weeks", "day", "days",
    "month", "months", "tomorrow", "today", "asap", "urgent", "urgently", "unit", "units", "pcs",
}

QUANTITY_RE = re.compile(r"\b(\d{1,4})\b")


@dataclass
class RRDraftState:
    stage: str = "collecting"  # collecting -> awaiting_material_choice -> awaiting_quantity -> awaiting_date -> awaiting_confirmation -> done
    material_id: int | None = None
    material_label: str | None = None
    material_candidates: list[dict] = field(default_factory=list)
    quantity: float | None = None
    required_date: str | None = None  # ISO date
    purpose: str | None = None

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

    state.stage = "awaiting_confirmation"
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
