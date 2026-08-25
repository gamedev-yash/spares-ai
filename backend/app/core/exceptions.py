"""Consistent API error envelope.

Every error response has the shape: {"error": {"code": str, "message": str, "details": Any | None}}
Internal exceptions/stack traces are never leaked to the client -- they are logged instead.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import get_logger

logger = get_logger(__name__)


class AppError(Exception):
    """Base class for domain/business errors that should map to a clean HTTP response."""

    def __init__(self, message: str, code: str = "app_error", status_code: int = status.HTTP_400_BAD_REQUEST, details: Any | None = None):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details
        super().__init__(message)


class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found", details: Any | None = None):
        super().__init__(message, code="not_found", status_code=status.HTTP_404_NOT_FOUND, details=details)


class ForbiddenError(AppError):
    def __init__(self, message: str = "Not authorized to perform this action", details: Any | None = None):
        super().__init__(message, code="forbidden", status_code=status.HTTP_403_FORBIDDEN, details=details)


class UnauthorizedError(AppError):
    def __init__(self, message: str = "Authentication required", details: Any | None = None):
        super().__init__(message, code="unauthorized", status_code=status.HTTP_401_UNAUTHORIZED, details=details)


class ConflictError(AppError):
    def __init__(self, message: str = "Conflicting state", details: Any | None = None):
        super().__init__(message, code="conflict", status_code=status.HTTP_409_CONFLICT, details=details)


class ValidationAppError(AppError):
    def __init__(self, message: str = "Validation failed", details: Any | None = None):
        super().__init__(message, code="validation_error", status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, details=details)


def _envelope(code: str, message: str, details: Any | None = None) -> dict:
    return {"error": {"code": code, "message": message, "details": details}}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=_envelope(exc.code, exc.message, exc.details))

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_envelope("validation_error", "Request validation failed", exc.errors()),
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=_envelope("http_error", str(exc.detail)))

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled_exception", path=str(request.url))
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_envelope("internal_error", "An unexpected error occurred"),
        )
