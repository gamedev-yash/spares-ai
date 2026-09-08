"""
Configuration: the four CPI settings, and where they are read from.

Credentials are never hard-coded and never passed on the command line. They
come from the environment, and for local development from a .env file. On
Azure the same four names are supplied as App Service settings or Key Vault
references, so nothing in this package changes between laptop and cloud.

The .env search order deliberately includes the repository root, because
that is where the credentials file currently sits in this project.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from .errors import CPIConfigError

# CPI exposes one pass-through iFlow rather than an OData service of its own.
# Everything is a GET against this path with the real SAP path carried in the
# APIPath parameter. Proven against the live tenant by cpi_discovery.py.
CPI_PATH = "/http/SAPECC/OdataConsumption"

REQUIRED = ("CPI_CLIENT_ID", "CPI_CLIENT_SECRET", "CPI_TOKEN_URL", "CPI_BASE_URL")

_PACKAGE_DIR = Path(__file__).resolve().parent
_SEARCH = (
    _PACKAGE_DIR / ".env",
    _PACKAGE_DIR.parent / ".env",          # data-generator/.env
    _PACKAGE_DIR.parent.parent / ".env",   # spares-ai/.env  <- current location
)


def load_env_file(path: str | Path | None = None) -> Path | None:
    """Load a .env into os.environ without overriding real environment
    variables, and return the file that was used.

    With no argument the search order above is tried and the first hit wins.
    CPI_ENV_FILE, if set, takes precedence over the search.
    """
    candidates: tuple[Path, ...]
    if path is not None:
        candidates = (Path(path),)
    elif os.environ.get("CPI_ENV_FILE"):
        candidates = (Path(os.environ["CPI_ENV_FILE"]),)
    else:
        candidates = _SEARCH

    for candidate in candidates:
        if not candidate.is_file():
            continue
        for line in candidate.read_text(encoding="utf-8-sig").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("export "):
                line = line[len("export "):].lstrip()
            key, separator, value = line.partition("=")
            if not separator:
                continue
            key, value = key.strip(), value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            elif " #" in value:
                value = value.split(" #", 1)[0].strip()
            os.environ.setdefault(key, value)
        return candidate

    if path is not None:
        raise CPIConfigError(f"env file not found: {path}")
    return None


@dataclass(frozen=True)
class CPIConfig:
    client_id: str
    client_secret: str
    token_url: str
    base_url: str
    cpi_path: str = CPI_PATH
    token_timeout: float = 60.0
    request_timeout: float = 120.0
    # Refresh this many seconds before the token actually expires, so a call
    # that is already in flight cannot be rejected mid-request.
    token_skew: float = 60.0
    verify: bool | str = True

    @property
    def endpoint(self) -> str:
        return self.base_url.rstrip("/") + self.cpi_path

    @classmethod
    def from_env(cls, *, env_file: str | Path | None = None, **overrides) -> "CPIConfig":
        load_env_file(env_file)
        missing = [name for name in REQUIRED if not os.environ.get(name)]
        if missing:
            searched = "\n  ".join(str(p) for p in _SEARCH)
            raise CPIConfigError(
                f"missing {', '.join(missing)}.\nSet them in the environment or in a "
                f".env file. Searched:\n  {searched}"
            )
        # REQUESTS_CA_BUNDLE is honoured by requests itself; CPI_VERIFY is the
        # explicit escape hatch for a locally trusted bundle.
        verify: bool | str = os.environ.get("CPI_VERIFY") or True
        return cls(
            client_id=os.environ["CPI_CLIENT_ID"],
            client_secret=os.environ["CPI_CLIENT_SECRET"],
            token_url=os.environ["CPI_TOKEN_URL"],
            base_url=os.environ["CPI_BASE_URL"],
            verify=verify,
            **overrides,
        )

    def redacted(self) -> dict[str, str]:
        """Safe to print: enough to confirm which tenant, nothing reusable."""

        def tail(value: str) -> str:
            return f"...{value[-6:]} ({len(value)} chars)" if value else "(unset)"

        return {
            "CPI_CLIENT_ID": tail(self.client_id),
            "CPI_CLIENT_SECRET": tail(self.client_secret),
            "CPI_TOKEN_URL": self.token_url,
            "CPI_BASE_URL": self.base_url,
            "endpoint": self.endpoint,
        }
