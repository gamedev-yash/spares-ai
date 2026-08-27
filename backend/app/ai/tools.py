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
from app.services import analytics_service, rr_service, utilization_service
from app.services.audit_service import record_audit
from app.services.csv_store import DataStore, Row
from app.schemas.procurement import RequestRequisitionCreate, RRLineItemCreate
from app.schemas.utilization import ConsumptionPlanCreate


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


def _create_rr(ctx: ToolContext, plant: str, department: str, required_date: str, purpose: str, line_items: list[dict], priority: str = "Normal") -> Any:
    try:
        payload = RequestRequisitionCreate(
            plant=plant,
            department=department,
            required_date=date.fromisoformat(required_date),
            purpose=purpose,
            priority=priority,
            line_items=[RRLineItemCreate(**line) for line in line_items],
        )
        rr = rr_service.create_rr(ctx.store, ctx.current_user, payload, source_system="chat_assistant")
        return {"rr_id": rr["id"], "rr_number": rr["rr_number"], "status": rr["status"], "total_estimated_value": float(rr["total_estimated_value"])}
    except AppError as e:
        return {"error": e.message}


def _create_consumption_plan(
    ctx: ToolContext, plant: str, department: str, required_date: str, priority: str, material_id: int, quantity: float,
    reservation_type: str, purpose: str, planned_consumption_date: str, job_card_number: str | None = None,
    project: str | None = None, equipment: str | None = None,
) -> Any:
    try:
        payload = ConsumptionPlanCreate(
            plant=plant, department=department, required_date=date.fromisoformat(required_date), priority=priority,
            material_id=material_id, quantity=quantity, reservation_type=reservation_type, purpose=purpose,
            job_card_number=job_card_number, project=project, equipment=equipment,
            planned_consumption_date=date.fromisoformat(planned_consumption_date),
        )
        result = utilization_service.create_consumption_plan(ctx.store, ctx.current_user, payload, source_system="chat_assistant")
        return {
            "tracking_id": result["tracking_id"], "rr_id": result["rr_id"], "rr_number": result["rr_number"],
            "risk_level": result["risk"]["level"], "stock_matches": len(result["stock_check"]["matches"]),
        }
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
                },
                "required": ["plant", "department", "required_date", "purpose", "line_items"],
            },
        ),
        _create_rr,
    ),
    "create_consumption_plan": (
        ToolSpec(
            "create_consumption_plan",
            "Create an OAR (order-as-required) requisition with its mandatory Initiative 13 consumption plan -- use this "
            "instead of create_rr once the material has been classified OAR and the reservation type, purpose, "
            "equipment/job-card, and planned consumption date are all known and confirmed by the user.",
            {
                "type": "object",
                "properties": {
                    "plant": {"type": "string"},
                    "department": {"type": "string"},
                    "required_date": {"type": "string", "description": "ISO date YYYY-MM-DD"},
                    "priority": {"type": "string", "enum": ["Normal", "High", "Critical"]},
                    "material_id": {"type": "integer"},
                    "quantity": {"type": "number"},
                    "reservation_type": {"type": "string", "enum": ["JOB_CARD", "STRAIGHT"]},
                    "purpose": {"type": "string"},
                    "planned_consumption_date": {"type": "string", "description": "ISO date YYYY-MM-DD"},
                    "job_card_number": {"type": "string"},
                    "project": {"type": "string"},
                    "equipment": {"type": "string"},
                },
                "required": ["plant", "department", "required_date", "material_id", "quantity", "reservation_type", "purpose", "planned_consumption_date"],
            },
        ),
        _create_consumption_plan,
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
