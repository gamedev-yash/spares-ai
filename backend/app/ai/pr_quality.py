"""PR line-item quality intervention: deterministic rules decide WHAT the issues are;
the LLM (when configured) only phrases an explanation for a human reviewer. It never
decides the issues itself and never touches the PR record -- see quality_validation.py.
"""

from app.ai.factory import get_llm_provider, is_demo_mode
from app.services import quality_validation

SYSTEM_PROMPT = (
    "You are a procurement quality assistant. You are given a list of rule-detected issues "
    "on a purchase requisition's line items. Write a short (2-4 sentence), plain-language "
    "summary a buyer can read before deciding what to do. Do not invent issues beyond what "
    "is listed. Do not suggest you can fix anything automatically."
)


def build_explanation(pr_number: str, issues: list[dict]) -> str:
    if not issues:
        return "No quality issues were detected on this PR's line items."

    if is_demo_mode():
        lines = "; ".join(f"line {i['line_item_id']}: {', '.join(i['issues'])}" for i in issues)
        return (
            f"[Demo mode -- templated, not LLM-generated] {pr_number} has {len(issues)} line item(s) "
            f"flagged for review before approval: {lines}. A buyer should confirm the correct service "
            f"code and tighten any vague descriptions before this PR proceeds."
        )

    provider = get_llm_provider()
    summary_input = f"PR {pr_number} issues: " + "; ".join(
        f"line {i['line_item_id']} ({i['description']}): {', '.join(i['issues'])}" for i in issues
    )
    return provider.complete(SYSTEM_PROMPT, summary_input)


def check_pr_quality(pr_number: str, lines: list[dict]) -> dict:
    """lines: [{id, material_id, description, service_code, material_group}]"""
    issues = []
    duplicate_ids = quality_validation.check_duplicates([(line["id"], line["material_id"]) for line in lines])

    for line in lines:
        line_issues = quality_validation.check_line(line["description"], line["service_code"], line["material_group"])
        if line["id"] in duplicate_ids:
            line_issues.append("DUPLICATE_LINE_ITEM")
        if line_issues:
            issues.append(
                {
                    "line_item_id": line["id"],
                    "material_id": line["material_id"],
                    "description": line["description"],
                    "issues": line_issues,
                }
            )

    return {
        "has_issues": bool(issues),
        "issues": issues,
        "explanation": build_explanation(pr_number, issues),
    }
