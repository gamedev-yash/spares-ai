"""FastAPI dependencies -- the CSV data store, and a trivial "current user" lookup.

There is no authentication in this build (see PROMPT_SPEC.md Part 10: "No authentication is
required"). `get_current_user` never rejects a request: it decodes the bearer token the
frontend already sends (a bare user id -- see routes/auth.py) if present and valid, and
otherwise falls back to a default demo user. This keeps the existing frontend login/cookie
flow (src/lib/api/auth.ts, src/proxy.ts) working unmodified while removing all JWT/password
machinery.
"""

from __future__ import annotations

from functools import lru_cache

from fastapi import Depends, Header

from app.config import get_settings
from app.core.exceptions import NotFoundError
from app.services.csv_store import DataStore, Row


@lru_cache
def _store_singleton() -> DataStore:
    settings = get_settings()
    return DataStore(settings.data_dir)


def get_store() -> DataStore:
    return _store_singleton()


def get_current_user(
    authorization: str | None = Header(default=None),
    store: DataStore = Depends(get_store),
) -> Row:
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        if token.isdigit():
            user = store.users.get(int(token))
            if user is not None and user.get("active"):
                return user

    user = store.default_user()
    if user is None:
        raise NotFoundError("No users configured in users.csv")
    return user
