"""No authentication is required in this build (see PROMPT_SPEC.md Part 10). This route
exists only so the existing frontend login page / cookie flow keeps working: `/login`
accepts any password for a known employee_code and hands back that user's id as a bare,
unsigned token (see app/api/deps.get_current_user). It is a UX convenience, not a security
boundary -- every other route works with or without it (falling back to a default demo user).
"""

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user, get_store
from app.core.exceptions import UnauthorizedError
from app.schemas.auth import LoginRequest, TokenResponse, UserOut
from app.services.csv_store import DataStore, Row

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, store: DataStore = Depends(get_store)) -> TokenResponse:
    user = next((u for u in store.users.all() if u.get("employee_code") == payload.employee_code), None)
    if user is None or not user.get("active"):
        raise UnauthorizedError("Invalid employee code")

    return TokenResponse(access_token=str(user["id"]), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(current_user: Row = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(current_user)
