"""The AI tool registry -- the ONLY way the assistant (demo routing or a real LLM's
tool-calling loop) touches procurement data. Every handler here calls into ordinary,
already-validated backend services/store lookups; none of them bypass the same store a
human user's requests go through. See app/ai/provider_base.py and app/ai/orchestrator.py
for how these get invoked.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any

from app.ai.provider_base import ToolSpec
from app.core.exceptions import AppError
from app.services import analytics_service, repair_register_service, repair_service, rr_service
from app.services.audit_service import record_audit
from app.services.csv_store import DataStore, Row
from app.schemas.procurement import RequestRequisitionCreate, RRLineItemCreate


@dataclass
class ToolContext:
    store: DataStore
    current_user: Row


def _search_materials(ctx: ToolContext, query: str, limit: int = 5) -> Any:
    needle = query.lower()
    rows = [
        m for m in ctx.store.materials.all()
        if m.get("active")
        and (needle in (m.get("description") or "").lower() or needle in (m.get("material_code") or "").lower() or needle in (m.get("material_group") or "").lower())
    ][:limit]
    return [
        {"id": m["id"], "material_code": m["material_code"], "description": m["description"], "material_group": m["material_group"], "last_po_price": float(m.get("last_po_price") or 0)}
        for m in rows
    ]


def _get_material(ctx: ToolContext, material_id: int) -> Any:
    m = ctx.store.materials.get(material_id)
    if m is None:
        return {"error": f"Material {material_id} not found"}
    return {"id": m["id"], "material_code": m["material_code"], "description": m["description"], "material_group": m["material_group"], "criticality": m["criticality"], "last_po_price": float(m.get("last_po_price") or 0), "lead_time_days": m["lead_time_days"]}


def _create_rr(
    ctx: ToolContext,
    plant: str,
    department: str,
    required_date: str,
    purpose: str,
    line_items: list[dict],
    priority: str = "Normal",
    attestation_confirmed: bool = False,
    attestation_note: str | None = None,
) -> Any:
    try:
        payload = RequestRequisitionCreate(
            plant=plant,
            department=department,
            required_date=date.fromisoformat(required_date),
            purpose=purpose,
            priority=priority,
            line_items=[RRLineItemCreate(**line) for line in line_items],
            attestation_confirmed=attestation_confirmed,
            attestation_note=attestation_note,
        )
        rr = rr_service.create_rr(ctx.store, ctx.current_user, payload, source_system="chat_assistant")
        return {"rr_id": rr["id"], "rr_number": rr["rr_number"], "status": rr["status"], "total_estimated_value": float(rr["total_estimated_value"])}
    except AppError as e:
        return {"error": e.message}


def _get_rr(ctx: ToolContext, rr_id: int) -> Any:
    rr = ctx.store.rr.get(rr_id)
    if rr is None:
        return {"error": f"RR {rr_id} not found"}
    return {"rr_number": rr["rr_number"], "status": rr["status"], "plant": rr["plant"], "total_estimated_value": float(rr["total_estimated_value"]), "required_date": rr["required_date"]}


def _get_pr(ctx: ToolContext, pr_id: int) -> Any:
    pr = ctx.store.pr.get(pr_id)
    if pr is None:
        return {"error": f"PR {pr_id} not found"}
    return {"pr_number": pr["pr_number"], "status": pr["status"], "plant": pr["plant"], "total_value": float(pr["total_value"])}


def _get_po(ctx: ToolContext, po_id: int) -> Any:
    po = ctx.store.po.get(po_id)
    if po is None:
        return {"error": f"PO {po_id} not found"}
    return {"po_number": po["po_number"], "status": po["status"], "total_value": float(po["total_value"]), "expected_delivery": po["expected_delivery"]}


def _get_open_prs(ctx: ToolContext, limit: int = 10) -> Any:
    result = analytics_service.get_open_pr_po(ctx.store, page=1, page_size=limit)
    return {"open_pr_count": result["open_pr_count"], "items": [i for i in result["items"] if i["type"] == "PR"]}


def _get_open_pos(ctx: ToolContext, limit: int = 10) -> Any:
    result = analytics_service.get_open_pr_po(ctx.store, page=1, page_size=limit)
    return {"open_po_count": result["open_po_count"], "items": [i for i in result["items"] if i["type"] == "PO"]}


def _get_cycle_time(ctx: ToolContext) -> Any:
    return analytics_service.get_cycle_time(ctx.store)


def _get_bottlenecks(ctx: ToolContext) -> Any:
    return analytics_service.get_bottlenecks(ctx.store)


def _get_approval_status(ctx: ToolContext, rr_id: int) -> Any:
    approvals = ctx.store.approvals.filter(lambda a: a.get("rr_id") == rr_id)
    return [{"id": a["id"], "approval_type": a["approval_type"], "status": a["status"], "approver_role": a["approver_role"]} for a in approvals]


def _check_repair_chain(ctx: ToolContext, material_id: int, plant: str | None = None) -> Any:
    """Initiative 8 Layer 2: the duplicate guard on the conversational path. Read-only and
    advisory -- it reports what is already in flight; the user decides."""
    result = repair_service.check_duplicate(ctx.store, material_id, plant)
    return {
        "material_code": result.get("material_code"),
        "material_description": result.get("material_description"),
        "is_repairable": result["is_repairable"],
        "has_active_chain": result["has_active_chain"],
        "total_quantity_under_repair": result.get("total_quantity_under_repair", 0),
        "earliest_expected_return": result.get("earliest_expected_return"),
        "chains": [
            {
                "repair_pr_number": c["repair_pr_number"],
                "repair_po_number": c["repair_po_number"],
                "vendor": c["vendor"],
                "quantity_under_repair": c["quantity_under_repair"],
                "expected_return": c["expected_return"],
                "days_open": c["days_open"],
                "overdue": c["overdue"],
            }
            for c in result["chains"]
        ],
    }


def _compare_repair_vs_new(ctx: ToolContext, material_id: int, plant: str | None = None) -> Any:
    result = repair_service.economic_evaluation(ctx.store, material_id, plant)
    if result is None:
        return {"error": "No active repair chain for this material, so there is nothing to compare."}
    return result


def _get_repair_register(ctx: ToolContext, plant: str | None = None, status: str | None = None, limit: int = 10) -> Any:
    register = repair_register_service.get_register(ctx.store, plant=plant, status=status)
    return {
        "summary": register["summary"],
        "items": [
            {
                "material_code": r["material_code"],
                "material_description": r["material_description"],
                "plant": r["plant"],
                "stock_on_hand": r["stock_on_hand"],
                "reorder_point": r["reorder_point"],
                "quantity_under_repair": r["quantity_under_repair"],
                "vendor": r["vendor"],
                "expected_return": r["expected_return"],
                "days_open": r["days_open"],
                "overdue": r["overdue"],
            }
            for r in register["items"][:limit]
        ],
    }


def _get_audit_history(ctx: ToolContext, entity_type: str, entity_id: int) -> Any:
    rows = sorted(
        ctx.store.audit_logs.filter(lambda a: a.get("entity_type") == entity_type and a.get("entity_id") == entity_id),
        key=lambda a: a.get("timestamp") or "",
        reverse=True,
    )[:20]
    return [{"action": r["action"], "timestamp": r["timestamp"], "user_id": r.get("user_id")} for r in rows]


TOOLS: dict[str, tuple[ToolSpec, Any]] = {
    "search_materials": (
        ToolSpec("search_materials", "Search the material catalog by description, code, or group.", {"type": "object", "properties": {"query": {"type": "string"}, "limit": {"type": "integer"}}, "required": ["query"]}),
        _search_materials,
    ),
    "get_material": (
        ToolSpec("get_material", "Get a single material by its id.", {"type": "object", "properties": {"material_id": {"type": "integer"}}, "required": ["material_id"]}),
        _get_material,
    ),
    "create_rr": (
        ToolSpec(
            "create_rr",
            "Create a new requisition (RR) once material, quantity, plant, department, required date, and purpose are all known and confirmed by the user.",
            {
                "type": "object",
                "properties": {
                    "plant": {"type": "string"},
                    "department": {"type": "string"},
                    "required_date": {"type": "string", "description": "ISO date YYYY-MM-DD"},
                    "purpose": {"type": "string"},
                    "priority": {"type": "string", "enum": ["Normal", "High", "Critical"]},
                    "line_items": {
                        "type": "array",
                        "items": {"type": "object", "properties": {"material_id": {"type": "integer"}, "quantity": {"type": "number"}}, "required": ["material_id", "quantity"]},
                    },
                    "attestation_confirmed": {
                        "type": "boolean",
                        "description": (
                            "Required for repairable (80-series) materials: set true ONLY after the "
                            "user has explicitly confirmed the existing item cannot be repaired. "
                            "Never assume this -- ask, and wait for the answer."
                        ),
                    },
                    "attestation_note": {"type": "string", "description": "Optional reason the user gave."},
                },
                "required": ["plant", "department", "required_date", "purpose", "line_items"],
            },
        ),
        _create_rr,
    ),
    "check_repair_chain": (
        ToolSpec(
            "check_repair_chain",
            "Check whether a material is repairable and whether a repair is already in progress for it at a plant. Call this BEFORE creating a requisition for any material.",
            {"type": "object", "properties": {"material_id": {"type": "integer"}, "plant": {"type": "string"}}, "required": ["material_id"]},
        ),
        _check_repair_chain,
    ),
    "compare_repair_vs_new": (
        ToolSpec(
            "compare_repair_vs_new",
            "Compare an in-progress repair against buying a new unit: cost, lead time, and expected return date.",
            {"type": "object", "properties": {"material_id": {"type": "integer"}, "plant": {"type": "string"}}, "required": ["material_id"]},
        ),
        _compare_repair_vs_new,
    ),
    "get_repair_register": (
        ToolSpec(
            "get_repair_register",
            "List parts currently out for repair, with stock on hand and expected return dates. Optional status filter: OVERDUE, IN_FLIGHT, REORDER_TRIGGERED.",
            {"type": "object", "properties": {"plant": {"type": "string"}, "status": {"type": "string"}, "limit": {"type": "integer"}}},
        ),
        _get_repair_register,
    ),
    "get_rr": (ToolSpec("get_rr", "Get an RR by id.", {"type": "object", "properties": {"rr_id": {"type": "integer"}}, "required": ["rr_id"]}), _get_rr),
    "get_pr": (ToolSpec("get_pr", "Get a PR by id.", {"type": "object", "properties": {"pr_id": {"type": "integer"}}, "required": ["pr_id"]}), _get_pr),
    "get_po": (ToolSpec("get_po", "Get a PO by id.", {"type": "object", "properties": {"po_id": {"type": "integer"}}, "required": ["po_id"]}), _get_po),
    "get_open_prs": (ToolSpec("get_open_prs", "List currently open PRs.", {"type": "object", "properties": {"limit": {"type": "integer"}}}), _get_open_prs),
    "get_open_pos": (ToolSpec("get_open_pos", "List currently open POs.", {"type": "object", "properties": {"limit": {"type": "integer"}}}), _get_open_pos),
    "get_cycle_time": (ToolSpec("get_cycle_time", "Get RR-to-PO cycle time statistics (average, median, P90/P95, stage breakdown, bottleneck).", {"type": "object", "properties": {}}), _get_cycle_time),
    "get_bottlenecks": (ToolSpec("get_bottlenecks", "Get per-stage bottleneck statistics.", {"type": "object", "properties": {}}), _get_bottlenecks),
    "get_approval_status": (ToolSpec("get_approval_status", "Get the approval records for an RR.", {"type": "object", "properties": {"rr_id": {"type": "integer"}}, "required": ["rr_id"]}), _get_approval_status),
    "get_audit_history": (
        ToolSpec("get_audit_history", "Get recent audit log entries for an entity.", {"type": "object", "properties": {"entity_type": {"type": "string", "enum": ["RR", "PR", "PO", "APPROVAL"]}, "entity_id": {"type": "integer"}}, "required": ["entity_type", "entity_id"]}),
        _get_audit_history,
    ),
}


def get_tool_specs() -> list[ToolSpec]:
    return [spec for spec, _ in TOOLS.values()]


def execute_tool(ctx: ToolContext, name: str, args: dict) -> Any:
    if name not in TOOLS:
        return {"error": f"Unknown tool '{name}'"}
    _, handler = TOOLS[name]
    try:
        result = handler(ctx, **args)
    except TypeError as e:
        return {"error": f"Invalid arguments for {name}: {e}"}
    if name == "create_rr" and isinstance(result, dict) and "rr_id" in result:
        record_audit(ctx.store, user_id=ctx.current_user["id"], action="AI_TOOL_CREATE_RR", entity_type="RR", entity_id=result["rr_id"], new_value=result)
    return result
