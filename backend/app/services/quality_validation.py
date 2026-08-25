"""Deterministic PR line-item quality rules. AI intervention (pr_quality.py) wraps these
in an optional natural-language explanation -- the rules themselves are plain code, per the
brief's "business-critical calculations should be deterministic, not LLM reasoning."
"""

from __future__ import annotations

VAGUE_PHRASES = {
    "misc parts",
    "spares as required",
    "items per attached list",
    "as discussed",
    "various items",
    "n/a",
    "tbd",
}

SERVICE_KEYWORDS = ("service", "repair", "inspection", "calibration", "installation", "refurbishment")

MIN_DESCRIPTION_LENGTH = 12


def check_line(description: str, service_code: str | None, material_group: str | None) -> list[str]:
    issues: list[str] = []
    desc_lower = (description or "").strip().lower()

    looks_like_service = material_group == "Services" or any(kw in desc_lower for kw in SERVICE_KEYWORDS)
    if looks_like_service and not service_code:
        issues.append("MISSING_SERVICE_CODE")

    if desc_lower in VAGUE_PHRASES or len(desc_lower) < MIN_DESCRIPTION_LENGTH:
        issues.append("VAGUE_DESCRIPTION")

    return issues


def check_duplicates(lines: list[tuple[int, int]]) -> set[int]:
    """lines: list of (line_item_id, material_id). Returns the set of line_item_ids that
    share a material_id with another line on the same PR (likely duplicate/should-be-merged)."""
    seen: dict[int, int] = {}
    duplicates: set[int] = set()
    for line_item_id, material_id in lines:
        if material_id in seen:
            duplicates.add(line_item_id)
            duplicates.add(seen[material_id])
        else:
            seen[material_id] = line_item_id
    return duplicates
