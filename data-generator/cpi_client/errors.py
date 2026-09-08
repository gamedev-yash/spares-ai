"""
Typed errors for the CPI client.

Every failure a caller can reasonably act on differently gets its own class,
so application code branches on exception type instead of re-reading HTTP
status codes at every call site. SAP's own error envelope - JSON
``{"error": {"code": ..., "message": {"value": ...}}}`` or the XML
equivalent - is unwrapped into ``sap_code`` and ``sap_message`` whenever the
response carries one, because that text is usually the only thing that says
what actually went wrong.

Retry policy lives on the exception (``retryable``) rather than in a table
somewhere else, so adding a status code means touching one place.
"""

from __future__ import annotations

import json
import re
import xml.etree.ElementTree as ET


class CPIError(Exception):
    """Base for every failure raised by this package."""

    retryable = False

    def __init__(
        self,
        message: str,
        *,
        status: int | None = None,
        sap_code: str | None = None,
        sap_message: str | None = None,
        body: str | None = None,
        api_path: str | None = None,
        api_query: str | None = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.sap_code = sap_code
        self.sap_message = sap_message
        self.body = body
        self.api_path = api_path
        self.api_query = api_query

    def __str__(self) -> str:
        parts = [super().__str__()]
        if self.sap_code:
            parts.append(f"SAP code {self.sap_code}")
        if self.sap_message:
            parts.append(self.sap_message)
        if self.api_path:
            where = self.api_path
            if self.api_query:
                where += f"?{self.api_query}"
            parts.append(f"while calling {where}")
        return " | ".join(parts)


class CPIConfigError(CPIError):
    """A required setting (client id, secret, token URL, base URL) is missing."""


class CPITransportError(CPIError):
    """The request never produced an HTTP response: DNS, TLS, timeout, reset.

    TLS verification failures are the common case on a corporate laptop, so
    the hint is attached here rather than left for the caller to recognise.
    """

    retryable = True

    def __init__(self, message: str, **kwargs) -> None:
        if "CERTIFICATE_VERIFY_FAILED" in message:
            message += (
                "\n\nHint: this is corporate TLS interception, not a bad credential. "
                "Either `pip install pip-system-certs` so Python trusts the Windows "
                "certificate store, or point REQUESTS_CA_BUNDLE at a bundle that "
                "includes your corporate root CA."
            )
        super().__init__(message, **kwargs)


class CPIParseError(CPIError):
    """The response arrived but was not the shape the client expected."""


class CPIAuthError(CPIError):
    """401. The token was rejected. The client refreshes once before raising this."""


class CPIForbiddenError(CPIError):
    """403. The service user lacks authorisation. Never retried - it will not change."""


class CPINotFoundError(CPIError):
    """404. No such entity set, or no entity with that key."""


class CPIBadRequestError(CPIError):
    """400. Almost always a malformed $filter or a property name that does not exist."""


class CPIRateLimitError(CPIError):
    """429. Retryable, and honours Retry-After when the response supplies it."""

    retryable = True

    def __init__(self, message: str, *, retry_after: float | None = None, **kwargs) -> None:
        super().__init__(message, **kwargs)
        self.retry_after = retry_after


class CPIServerError(CPIError):
    """5xx from SAP or CPI. Retryable: often transient under load.

    Worth knowing for this landscape: $count on PurchaseRequisitionSet,
    GoodsMovementItemSet and PurchaseOrderItemSet returns 500 consistently,
    which is a rejected unbounded query rather than a transient fault. Retry
    will not rescue those - add a $filter.
    """

    retryable = True


class CPIServiceUnavailableError(CPIServerError):
    """503 / 504. The integration layer is up but not answering right now."""


_STATUS_MAP: dict[int, type[CPIError]] = {
    400: CPIBadRequestError,
    401: CPIAuthError,
    403: CPIForbiddenError,
    404: CPINotFoundError,
    429: CPIRateLimitError,
    503: CPIServiceUnavailableError,
    504: CPIServiceUnavailableError,
}


def _sap_error(body: str) -> tuple[str | None, str | None]:
    """Pull (code, message) out of an OData error payload, JSON or XML."""
    text = (body or "").strip()
    if not text:
        return None, None

    if text.startswith("{"):
        try:
            error = json.loads(text).get("error") or {}
        except ValueError:
            return None, None
        message = error.get("message")
        if isinstance(message, dict):
            message = message.get("value")
        return error.get("code"), message

    if text.startswith("<"):
        try:
            root = ET.fromstring(text)
        except ET.ParseError:
            return None, None
        # The error namespace varies between gateway versions, so match on
        # the local tag name instead of a fixed namespace.
        found: dict[str, str] = {}
        for element in root.iter():
            tag = element.tag.rsplit("}", 1)[-1]
            if tag in ("code", "message") and tag not in found and element.text:
                found[tag] = element.text.strip()
        return found.get("code"), found.get("message")

    return None, None


def _retry_after(headers) -> float | None:
    raw = (headers or {}).get("Retry-After")
    if not raw:
        return None
    if re.fullmatch(r"\s*\d+(\.\d+)?\s*", str(raw)):
        return float(raw)
    return None  # HTTP-date form; the backoff schedule covers it


def from_response(response, *, api_path: str = "", api_query: str = "") -> CPIError:
    """Map an HTTP response onto the right exception class, unwrapped."""
    status = response.status_code
    body = response.text or ""
    sap_code, sap_message = _sap_error(body)

    if status in _STATUS_MAP:
        cls = _STATUS_MAP[status]
    elif status >= 500:
        cls = CPIServerError
    else:
        cls = CPIError

    kwargs = dict(
        status=status,
        sap_code=sap_code,
        sap_message=sap_message,
        body=body[:2000],
        api_path=api_path,
        api_query=api_query,
    )
    if cls is CPIRateLimitError:
        kwargs["retry_after"] = _retry_after(response.headers)

    return cls(f"HTTP {status}", **kwargs)
