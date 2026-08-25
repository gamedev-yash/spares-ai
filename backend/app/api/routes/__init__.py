from fastapi import APIRouter

from app.api.routes.analytics import router as analytics_router
from app.api.routes.approvals import router as approvals_router
from app.api.routes.audit import router as audit_router
from app.api.routes.auth import router as auth_router
from app.api.routes.chat import router as chat_router
from app.api.routes.materials import router as materials_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.po import router as po_router
from app.api.routes.pr import router as pr_router
from app.api.routes.rr import router as rr_router
from app.api.routes.situation_analysis import router as situation_analysis_router
from app.api.routes.users import router as users_router
from app.api.routes.vzi import router as vzi_router

router = APIRouter()

# No authentication is required in this build (see PROMPT_SPEC.md Part 10) -- every route
# below is open. app/api/deps.get_current_user still resolves a "current user" (from a
# bearer token if the frontend sent one, else a default demo user) wherever a route needs
# an actor to attribute audit/notification rows to.
router.include_router(auth_router)
router.include_router(materials_router)
router.include_router(audit_router)
router.include_router(situation_analysis_router)
router.include_router(vzi_router)
router.include_router(approvals_router)
router.include_router(analytics_router)
router.include_router(rr_router)
router.include_router(pr_router)
router.include_router(po_router)
router.include_router(users_router)
router.include_router(notifications_router)
router.include_router(chat_router)
