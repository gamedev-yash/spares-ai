"""
OAuth 2.0 client-credentials token handling.

The token is fetched once and reused until it is close to expiry. Without
this, a run that reads 40,000 material documents across 40 pages would ask
the authorisation server for 40 tokens it did not need.

Two details are easy to get wrong and are proven correct here against the
live tenant:

  * the client id and secret go in HTTP Basic auth, not in the form body;
  * only ``grant_type=client_credentials`` is posted as form data.

``expires_in`` is respected, minus a safety margin, so a token cannot expire
between the moment it is chosen and the moment SAP validates it. The lock
means concurrent callers refresh once between them rather than stampeding
the token endpoint.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass

import requests

from .config import CPIConfig
from .errors import CPIAuthError, CPIParseError, CPITransportError

# Used when the authorisation server omits expires_in. Short enough to be
# safe, long enough to stay useful.
FALLBACK_TTL = 600.0


@dataclass
class Token:
    value: str
    expires_at: float          # monotonic clock, not wall clock
    issued_at: float

    def is_valid(self, skew: float) -> bool:
        return time.monotonic() < (self.expires_at - skew)

    @property
    def expires_in(self) -> float:
        return max(0.0, self.expires_at - time.monotonic())


class TokenManager:
    """Caches one bearer token and refreshes it when it is about to expire."""

    def __init__(self, config: CPIConfig, session: requests.Session | None = None) -> None:
        self._config = config
        self._session = session or requests.Session()
        self._lock = threading.Lock()
        self._token: Token | None = None
        self.fetch_count = 0

    def get_token(self, *, force: bool = False) -> str:
        """Return a usable bearer token, fetching one only when needed."""
        token = self._token
        if not force and token is not None and token.is_valid(self._config.token_skew):
            return token.value

        with self._lock:
            # Another thread may have refreshed while this one waited.
            token = self._token
            if not force and token is not None and token.is_valid(self._config.token_skew):
                return token.value
            self._token = self._fetch()
            return self._token.value

    def invalidate(self) -> None:
        """Drop the cached token. Called after a 401 so the next call re-authenticates."""
        with self._lock:
            self._token = None

    @property
    def token(self) -> Token | None:
        return self._token

    def _fetch(self) -> Token:
        config = self._config
        try:
            response = self._session.post(
                config.token_url,
                data={"grant_type": "client_credentials"},
                auth=(config.client_id, config.client_secret),
                timeout=config.token_timeout,
                verify=config.verify,
            )
        except requests.exceptions.RequestException as exc:
            raise CPITransportError(f"token request failed: {exc}") from exc

        if response.status_code != 200:
            raise CPIAuthError(
                f"token request returned HTTP {response.status_code}",
                status=response.status_code,
                body=(response.text or "")[:1000],
            )

        try:
            payload = response.json()
            value = payload["access_token"]
        except (ValueError, KeyError) as exc:
            raise CPIParseError(
                f"token response had no access_token: {(response.text or '')[:300]}"
            ) from exc

        try:
            ttl = float(payload.get("expires_in", FALLBACK_TTL))
        except (TypeError, ValueError):
            ttl = FALLBACK_TTL

        self.fetch_count += 1
        now = time.monotonic()
        return Token(value=value, expires_at=now + ttl, issued_at=now)
