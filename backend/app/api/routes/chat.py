from fastapi import APIRouter, Depends

from app.ai.orchestrator import handle_chat_turn
from app.api.deps import get_current_user, get_store
from app.core.exceptions import NotFoundError, ValidationAppError
from app.schemas.chat import ChatMessageOut, ChatRequest, ChatResponse, ChatSessionSummaryOut
from app.services.csv_store import DataStore, Row

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def post_chat(
    payload: ChatRequest,
    store: DataStore = Depends(get_store),
    current_user: Row = Depends(get_current_user),
) -> ChatResponse:
    if not payload.message and not payload.option_id:
        raise ValidationAppError("Either 'message' or 'option_id' is required")

    result = handle_chat_turn(store, current_user, payload.session_id, payload.message, payload.option_id)
    return ChatResponse(**result)


@router.get("/sessions", response_model=list[ChatSessionSummaryOut])
def list_sessions(store: DataStore = Depends(get_store), current_user: Row = Depends(get_current_user)) -> list[ChatSessionSummaryOut]:
    sessions = sorted(store.chat.sessions_for_user(current_user["id"]), key=lambda s: s["updated_at"] or "", reverse=True)
    return [ChatSessionSummaryOut.model_validate(s) for s in sessions]


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageOut])
def get_session_messages(
    session_id: int, store: DataStore = Depends(get_store), current_user: Row = Depends(get_current_user)
) -> list[ChatMessageOut]:
    session = store.chat.get_session(session_id)
    if session is None or session["user_id"] != current_user["id"]:
        raise NotFoundError(f"Chat session {session_id} not found")
    return [ChatMessageOut.model_validate(m) for m in store.chat.messages_for_session(session_id)]
