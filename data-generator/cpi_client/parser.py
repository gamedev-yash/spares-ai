"""
OData v2 envelope parsing and type coercion.

A v2 JSON collection arrives wrapped twice and annotated:

    {"d": {"results": [{"__metadata": {...}, "Lifnr": "0000001000",
                        "ToItems": {"__deferred": {...}}}],
           "__next": "https://sap.../VendorSet?$skiptoken=..."}}

Callers want the list of plain dicts. This module unwraps ``d.results``,
drops ``__metadata`` and unfollowed ``__deferred`` navigation stubs, and
converts the wire representations that v2 uses for non-string types:

    Edm.DateTime  /Date(1757280000000)/   ->  datetime  (also +HHMM offsets)
    Edm.Time      PT08H30M00S             ->  time
    Edm.Decimal   "1234.56" (a string,    ->  Decimal
                  to protect precision)
    Edm.Int*      "42" or 42              ->  int
    Edm.Boolean   true / "true"           ->  bool

Coercion is driven by the declared type from discovery, never guessed from
the value. That matters here: PurchaseOrderItemSet.Netpr and .Netwr were
re-declared from Edm.Decimal to Edm.String by the service, and a guessing
parser would silently keep converting them while the contract says text.

``__next`` needs care. SAP returns an absolute URL pointing at the SAP host,
which is unreachable from here - only the CPI proxy is. So the link is split
back into (APIPath, APIQuery) and re-issued through the proxy.
"""

from __future__ import annotations

import json
import re
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, InvalidOperation
from urllib.parse import unquote, urlsplit

from .errors import CPIParseError
from .models import Page
from .query import ODATA_ROOT

_DATE_RE = re.compile(r"^/Date\((-?\d+)([+-]\d{1,4})?\)/$")
_DURATION_RE = re.compile(
    r"^P(?:(?P<days>\d+)D)?"
    r"(?:T(?:(?P<hours>\d+)H)?(?:(?P<minutes>\d+)M)?(?:(?P<seconds>\d+(?:\.\d+)?)S)?)?$"
)

_INT_TYPES = {"Edm.Int16", "Edm.Int32", "Edm.Int64", "Edm.Byte", "Edm.SByte"}
_FLOAT_TYPES = {"Edm.Double", "Edm.Single"}
_DECIMAL_TYPES = {"Edm.Decimal"}

DROP_KEYS = ("__metadata",)


def parse_datetime(value: str) -> datetime:
    """``/Date(ms)/`` or ``/Date(ms+offset)/`` -> aware datetime (UTC based)."""
    match = _DATE_RE.match(value.strip())
    if not match:
        # Some gateways emit ISO 8601 instead; accept it rather than fail.
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            raise CPIParseError(f"not an OData v2 datetime: {value!r}") from None
    milliseconds = int(match.group(1))
    moment = datetime(1970, 1, 1, tzinfo=timezone.utc) + timedelta(milliseconds=milliseconds)
    offset = match.group(2)
    if offset:
        sign = 1 if offset[0] == "+" else -1
        minutes = int(offset[1:])
        moment = moment.astimezone(timezone(sign * timedelta(minutes=minutes)))
    return moment


def parse_time(value: str) -> time:
    """``PT08H30M00S`` (an ISO 8601 duration since midnight) -> time."""
    match = _DURATION_RE.match(value.strip())
    if not match:
        raise CPIParseError(f"not an OData v2 time: {value!r}")
    hours = int(match.group("hours") or 0)
    minutes = int(match.group("minutes") or 0)
    seconds = float(match.group("seconds") or 0)
    whole = int(seconds)
    return time(
        hour=hours % 24,
        minute=minutes,
        second=whole,
        microsecond=int(round((seconds - whole) * 1_000_000)),
    )


def coerce(value, edm_type: str):
    """Convert one wire value according to its declared EDM type.

    Unknown types and blanks pass through untouched: SAP represents an unset
    date as an empty string, and turning that into a fake epoch would be
    worse than leaving it alone.
    """
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    if not edm_type:
        return value

    try:
        if edm_type in ("Edm.DateTime", "Edm.DateTimeOffset"):
            return parse_datetime(value) if isinstance(value, str) else value
        if edm_type in ("Edm.Time", "Edm.Duration"):
            return parse_time(value) if isinstance(value, str) else value
        if edm_type in _DECIMAL_TYPES:
            return Decimal(str(value))
        if edm_type in _FLOAT_TYPES:
            return float(value)
        if edm_type in _INT_TYPES:
            return int(str(value).strip())
        if edm_type == "Edm.Boolean":
            if isinstance(value, bool):
                return value
            return str(value).strip().lower() in ("true", "x", "1")
    except (ValueError, InvalidOperation, TypeError) as exc:
        raise CPIParseError(f"cannot read {value!r} as {edm_type}: {exc}") from exc

    return value


def clean_entity(entity: dict, types: dict[str, str] | None, *, coerce_types: bool) -> dict:
    """Strip OData bookkeeping from one entity and optionally coerce values."""
    out: dict = {}
    for key, value in entity.items():
        if key in DROP_KEYS:
            continue
        if isinstance(value, dict):
            if "__deferred" in value:
                continue          # unfollowed navigation property
            if "results" in value:
                # An expanded to-many navigation property.
                out[key] = [
                    clean_entity(child, None, coerce_types=coerce_types)
                    for child in value["results"]
                ]
                continue
            out[key] = clean_entity(value, None, coerce_types=coerce_types)
            continue
        out[key] = coerce(value, (types or {}).get(key, "")) if coerce_types else value
    return out


def split_next_link(next_url: str) -> tuple[str, str]:
    """Turn SAP's ``__next`` URL into the (APIPath, APIQuery) the proxy needs.

    SAP points at its own host, which is not reachable from the client; only
    the CPI iFlow is. The path and query are all that matter, so they are
    lifted out and the host discarded. A relative link is returned as-is for
    the caller to re-anchor, since only it knows the service.
    """
    parts = urlsplit(next_url)
    path = (parts.path or "").lstrip("/")
    query = unquote(parts.query or "")

    if ODATA_ROOT in path:
        path = path[path.index(ODATA_ROOT):]
    return path, query


def parse_collection(
    body: str | dict,
    *,
    types: dict[str, str] | None = None,
    coerce_types: bool = True,
    keep_raw: bool = False,
) -> Page:
    """Unwrap a v2 JSON collection response into a Page of plain dicts."""
    if isinstance(body, str):
        text = body.strip()
        if not text:
            raise CPIParseError("empty response body where a collection was expected")
        if text.startswith("<"):
            raise CPIParseError(
                "response is XML, not JSON. Add $format=json to the APIQuery "
                "(Query(format_json=True) does this by default)."
            )
        try:
            payload = json.loads(text)
        except ValueError as exc:
            raise CPIParseError(f"response was not JSON: {text[:300]}") from exc
    else:
        payload = body

    if not isinstance(payload, dict):
        raise CPIParseError(f"expected a JSON object, got {type(payload).__name__}")

    envelope = payload.get("d", payload)

    if isinstance(envelope, list):
        entities = envelope                     # v4-style, tolerated
        next_link = None
        total = None
    elif isinstance(envelope, dict):
        if "results" in envelope:
            entities = envelope["results"]
        else:
            entities = [envelope]               # single entity, not a collection
        next_link = envelope.get("__next")
        total = envelope.get("__count")
    else:
        raise CPIParseError(f"unexpected envelope type {type(envelope).__name__}")

    if not isinstance(entities, list):
        raise CPIParseError("d.results was present but not a list")

    rows = [clean_entity(entity, types, coerce_types=coerce_types) for entity in entities]

    next_path = next_query = None
    if next_link:
        next_path, next_query = split_next_link(str(next_link))

    return Page(
        rows=rows,
        next_path=next_path or None,
        next_query=next_query or None,
        total=int(total) if total not in (None, "") else None,
        raw=payload if keep_raw else None,
    )


def to_csv_value(value) -> str:
    """Flatten a coerced value back to text for CSV output."""
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.date().isoformat() if value.timetz().replace(tzinfo=None) == time(0, 0) else value.isoformat()
    if isinstance(value, (date, time)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (list, dict)):
        return json.dumps(value, default=str)
    return str(value)
