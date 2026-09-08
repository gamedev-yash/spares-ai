"""
Offline checks. No network, no credentials.

The pieces this library adds on top of the proven prototype - collection
parsing, pagination, type coercion, error mapping - are exactly the pieces
that cannot be verified by looking at a successful $metadata call. So they
are verified here against recorded payloads and a fake HTTP session, which
means a regression shows up on a laptop with no CPI access at all.

    python -m cpi_client selftest
"""

from __future__ import annotations

import json
import logging
from datetime import time as dt_time
from decimal import Decimal

from .auth import TokenManager
from .client import CPIClient
from .config import CPIConfig
from .errors import (
    CPIAuthError,
    CPIBadRequestError,
    CPIForbiddenError,
    CPINotFoundError,
    CPIRateLimitError,
    CPIServerError,
    CPIServiceUnavailableError,
    from_response,
)
from .models import EntitySetInfo, Schema
from .parser import coerce, parse_collection, parse_datetime, parse_time, split_next_link
from .query import Query, and_, build_api_path, eq, literal
from .retry import RetryPolicy, run_with_retry


# --------------------------------------------------------------- tiny harness

class Results:
    def __init__(self, verbose: bool) -> None:
        self.passed = 0
        self.failed: list[str] = []
        self.verbose = verbose

    def check(self, name: str, actual, expected=True) -> None:
        ok = (actual == expected) if expected is not True else bool(actual)
        if ok:
            self.passed += 1
            if self.verbose:
                print(f"  pass  {name}")
        else:
            self.failed.append(f"{name}: expected {expected!r}, got {actual!r}")
            print(f"  FAIL  {name}: expected {expected!r}, got {actual!r}")

    def raises(self, name: str, exception_type, callable_, *args, **kwargs) -> None:
        try:
            callable_(*args, **kwargs)
        except exception_type:
            self.passed += 1
            if self.verbose:
                print(f"  pass  {name}")
            return
        except BaseException as exc:  # noqa: BLE001
            self.failed.append(f"{name}: raised {type(exc).__name__}, wanted {exception_type.__name__}")
            print(f"  FAIL  {name}: raised {type(exc).__name__}, wanted {exception_type.__name__}")
            return
        self.failed.append(f"{name}: nothing raised")
        print(f"  FAIL  {name}: nothing raised, wanted {exception_type.__name__}")


# ------------------------------------------------------------- fake transport

class FakeResponse:
    def __init__(self, status=200, text="", headers=None):
        self.status_code = status
        self.text = text
        self.headers = headers or {}

    @property
    def content(self) -> bytes:
        return self.text.encode()

    def json(self):
        return json.loads(self.text)


class FakeSession:
    """Replays a scripted list of responses and records what was asked for."""

    def __init__(self, responses: list[FakeResponse], token_ttl: int = 3600):
        self.responses = list(responses)
        self.calls: list[dict] = []
        self.token_calls = 0
        self.token_ttl = token_ttl

    def post(self, url, data=None, auth=None, timeout=None, verify=None):
        self.token_calls += 1
        return FakeResponse(
            200,
            json.dumps({
                "access_token": f"token-{self.token_calls}",
                "token_type": "Bearer",
                "expires_in": self.token_ttl,
            }),
        )

    def get(self, url, params=None, headers=None, timeout=None, verify=None):
        self.calls.append({
            "url": url,
            "params": dict(params or {}),
            "authorization": (headers or {}).get("Authorization"),
        })
        if not self.responses:
            return FakeResponse(500, "fake session ran out of scripted responses")
        return self.responses.pop(0)

    def close(self):
        pass


def _config() -> CPIConfig:
    return CPIConfig(
        client_id="id", client_secret="secret",
        token_url="https://auth.example/oauth/token",
        base_url="https://cpi.example",
    )


def _schema() -> Schema:
    return Schema(
        {
            "VendorSet": EntitySetInfo(
                "VendorSet", "ZVZI_KPI02_SHARED_SRV",
                {"Lifnr": "Edm.String", "Name1": "Edm.String"}, ["Lifnr"],
            ),
            "PurchaseOrderItemSet": EntitySetInfo(
                "PurchaseOrderItemSet", "ZVZI_KPI02_SHARED_SRV",
                {"Ebeln": "Edm.String", "Menge": "Edm.Decimal", "Netpr": "Edm.String"},
                ["Ebeln"],
            ),
            "ChangeDocHeaderSet": EntitySetInfo(
                "ChangeDocHeaderSet", "ZMM_KPI02_SRV",
                {"Changenr": "Edm.String", "Udate": "Edm.DateTime", "Utime": "Edm.Time"},
                ["Changenr"],
            ),
        },
        None,
    )


def _fake_client(responses, *, policy=None) -> tuple[CPIClient, FakeSession]:
    session = FakeSession(responses)
    client = CPIClient(
        _config(),
        schema=_schema(),
        session=session,
        policy=policy or RetryPolicy(attempts=3, base_delay=0.0, jitter=0.0),
    )
    return client, session


# -------------------------------------------------------------------- suites

def test_query(r: Results) -> None:
    print("\nAPIPath / APIQuery construction")
    r.check(
        "build_api_path entity set",
        build_api_path("ZVZI_KPI02_SHARED_SRV", "VendorSet"),
        "sap/opu/odata/sap/ZVZI_KPI02_SHARED_SRV/VendorSet",
    )
    r.check(
        "build_api_path $metadata",
        build_api_path("ZMM_KPI02_SRV", metadata=True),
        "sap/opu/odata/sap/ZMM_KPI02_SRV/$metadata",
    )
    r.check(
        "build_api_path $count",
        build_api_path("ZMM_KPI02_SRV", "ChangeDocItemSet", count=True),
        "sap/opu/odata/sap/ZMM_KPI02_SRV/ChangeDocItemSet/$count",
    )
    r.check("literal doubles quotes", literal("O'Brien"), "'O''Brien'")
    r.check("literal leaves numbers bare", literal(42), "42")
    r.check("literal booleans", literal(True), "true")
    r.check("eq escapes the value", eq("Name1", "O'Brien"), "Name1 eq 'O''Brien'")
    r.check(
        "and_ parenthesises",
        and_("A eq 1", "B eq 2"),
        "(A eq 1) and (B eq 2)",
    )
    r.check("and_ passes a single term through", and_("A eq 1"), "A eq 1")
    r.check(
        "Query renders every option",
        Query(filter="Werks eq '1000'", select=["Matnr", "Werks"], top=5, skip=10).render(),
        "$filter=Werks eq '1000'&$select=Matnr,Werks&$top=5&$skip=10&$format=json",
    )
    r.check("Query defaults to JSON", "$format=json" in Query().render())
    r.check("Query can drop $format", Query(format_json=False).render(), "")
    r.check("Query.with_ replaces one field", Query(top=5).with_(skip=100).skip, 100)


def test_types(r: Results) -> None:
    print("\nEDM type coercion")
    # 1757280000000 ms since the epoch is 2025-09-07T21:20:00Z.
    moment = parse_datetime("/Date(1757280000000)/")
    r.check("Edm.DateTime epoch millis", moment.isoformat(), "2025-09-07T21:20:00+00:00")
    # The v2 offset is a count of MINUTES, not HHMM: 330 is IST, +05:30.
    r.check("Edm.DateTime offset is minutes",
            parse_datetime("/Date(1757280000000+0330)/").utcoffset().total_seconds(), 19800.0)
    r.check("Edm.DateTime accepts ISO too",
            parse_datetime("2026-09-08T00:00:00").year, 2026)
    r.check("Edm.Time duration", parse_time("PT08H30M00S"), dt_time(8, 30))
    r.check("Edm.Time midnight", parse_time("PT00H00M00S"), dt_time(0, 0))
    r.check("Edm.Decimal keeps precision",
            coerce("1234.567890", "Edm.Decimal"), Decimal("1234.567890"))
    r.check("Edm.Int32", coerce("42", "Edm.Int32"), 42)
    r.check("Edm.Boolean from string", coerce("true", "Edm.Boolean"), True)
    r.check("Edm.Boolean from SAP X flag", coerce("X", "Edm.Boolean"), True)
    r.check("blank becomes None", coerce("", "Edm.DateTime"), None)
    r.check("unknown type passes through", coerce("anything", ""), "anything")
    # The regression this guards: Netpr/Netwr were re-declared Edm.String.
    r.check("declared Edm.String is not silently numified",
            coerce("1234.56", "Edm.String"), "1234.56")


def test_parser(r: Results) -> None:
    print("\nOData v2 envelope parsing")
    body = json.dumps({
        "d": {
            "results": [
                {
                    "__metadata": {"id": "x", "uri": "y", "type": "Z.Vendor"},
                    "Lifnr": "0000001000",
                    "Name1": "Gamsberg Supplies",
                    "ToItems": {"__deferred": {"uri": "..."}},
                },
                {
                    "__metadata": {"id": "x2"},
                    "Lifnr": "0000001001",
                    "Name1": "BMM Spares",
                    "ToItems": {"__deferred": {"uri": "..."}},
                },
            ],
            "__next": "https://sap.internal/sap/opu/odata/sap/ZVZI_KPI02_SHARED_SRV/VendorSet?$skiptoken=%270000001001%27",
            "__count": "227",
        }
    })
    page = parse_collection(body, types={"Lifnr": "Edm.String"})
    r.check("unwraps d.results", len(page.rows), 2)
    r.check("__metadata removed", "__metadata" not in page.rows[0])
    r.check("__deferred removed", "ToItems" not in page.rows[0])
    r.check("keeps real fields", page.rows[0]["Name1"], "Gamsberg Supplies")
    r.check("reads $inlinecount", page.total, 227)
    r.check("detects another page", page.has_next)
    r.check("re-splits __next into APIPath",
            page.next_path, "sap/opu/odata/sap/ZVZI_KPI02_SHARED_SRV/VendorSet")
    r.check("re-splits __next into APIQuery",
            page.next_query, "$skiptoken='0000001001'")

    last = parse_collection(json.dumps({"d": {"results": []}}))
    r.check("empty page is not an error", len(last.rows), 0)
    r.check("empty page has no next", last.has_next, False)

    single = parse_collection(json.dumps({"d": {"Lifnr": "0000001000"}}))
    r.check("single entity becomes one row", len(single.rows), 1)

    expanded = parse_collection(json.dumps({
        "d": {"results": [{
            "Ebeln": "4500000001",
            "ToItems": {"results": [{"Ebelp": "00010"}, {"Ebelp": "00020"}]},
        }]}
    }))
    r.check("expanded navigation kept as a list",
            len(expanded.rows[0]["ToItems"]), 2)

    r.check("relative __next survives",
            split_next_link("VendorSet?$skiptoken='1'"), ("VendorSet", "$skiptoken='1'"))

    from .errors import CPIParseError
    r.raises("XML body reports the $format fix", CPIParseError,
             parse_collection, "<?xml version='1.0'?><feed/>")
    r.raises("garbage body raises", CPIParseError, parse_collection, "not json")


def test_errors(r: Results) -> None:
    print("\nerror mapping")
    cases = [
        (400, CPIBadRequestError), (401, CPIAuthError), (403, CPIForbiddenError),
        (404, CPINotFoundError), (429, CPIRateLimitError), (500, CPIServerError),
        (502, CPIServerError), (503, CPIServiceUnavailableError),
        (504, CPIServiceUnavailableError),
    ]
    for status, expected in cases:
        error = from_response(FakeResponse(status, ""))
        r.check(f"{status} -> {expected.__name__}", isinstance(error, expected))

    r.check("403 is not retryable", from_response(FakeResponse(403, "")).retryable, False)
    r.check("500 is retryable", from_response(FakeResponse(500, "")).retryable, True)
    r.check("429 is retryable", from_response(FakeResponse(429, "")).retryable, True)

    sap_json = json.dumps({"error": {
        "code": "SY/530",
        "message": {"lang": "en", "value": "Property 'Nope' not found in type"},
    }})
    error = from_response(FakeResponse(400, sap_json))
    r.check("reads SAP error code", error.sap_code, "SY/530")
    r.check("reads SAP error message",
            error.sap_message, "Property 'Nope' not found in type")

    sap_xml = ("<error xmlns='http://schemas.microsoft.com/ado/2007/08/dataservices/metadata'>"
               "<code>SY/531</code><message>Filter not supported</message></error>")
    error = from_response(FakeResponse(500, sap_xml))
    r.check("reads XML error code", error.sap_code, "SY/531")
    r.check("reads XML error message", error.sap_message, "Filter not supported")

    error = from_response(FakeResponse(429, "", {"Retry-After": "7"}))
    r.check("honours Retry-After", error.retry_after, 7.0)


def test_retry(r: Results) -> None:
    print("\nretry policy")
    policy = RetryPolicy(attempts=4, base_delay=1.0, multiplier=2.0, jitter=0.0)
    r.check("first retry waits base", policy.delay_for(2), 1.0)
    r.check("second retry doubles", policy.delay_for(3), 2.0)
    r.check("third retry doubles again", policy.delay_for(4), 4.0)
    r.check("capped at max_delay",
            RetryPolicy(base_delay=100, max_delay=30, jitter=0.0).delay_for(5), 30.0)
    r.check("Retry-After overrides the schedule",
            policy.delay_for(2, retry_after=5.0), 5.0)

    slept: list[float] = []
    attempts: list[int] = []

    def flaky(attempt: int) -> str:
        attempts.append(attempt)
        if attempt < 3:
            raise from_response(FakeResponse(503, ""))
        return "recovered"

    result = run_with_retry(
        flaky,
        policy=RetryPolicy(attempts=3, base_delay=0.0, jitter=0.0),
        sleep=slept.append,
    )
    r.check("retries until success", result, "recovered")
    r.check("made three attempts", attempts, [1, 2, 3])
    r.check("slept between attempts", len(slept), 2)

    def forbidden(attempt: int):
        attempts.append(attempt)
        raise from_response(FakeResponse(403, ""))

    attempts.clear()
    r.raises("403 is not retried", CPIForbiddenError, run_with_retry, forbidden,
             policy=RetryPolicy(attempts=3, base_delay=0.0), sleep=slept.append)
    r.check("403 tried exactly once", attempts, [1])


def test_auth(r: Results) -> None:
    print("\ntoken handling")
    session = FakeSession([])
    manager = TokenManager(_config(), session=session)
    first = manager.get_token()
    for _ in range(20):
        manager.get_token()
    r.check("token reused across calls", session.token_calls, 1)
    r.check("token value is the cached one", manager.get_token(), first)
    r.check("expiry is tracked", manager.token.expires_in > 3000)

    manager.invalidate()
    manager.get_token()
    r.check("invalidate forces one refresh", session.token_calls, 2)

    short = FakeSession([], token_ttl=30)
    expiring = TokenManager(_config(), session=short)   # skew is 60s > ttl
    expiring.get_token()
    expiring.get_token()
    r.check("a token inside the skew window is refreshed", short.token_calls, 2)


def test_client(r: Results) -> None:
    print("\nclient end to end (fake transport)")

    page_one = json.dumps({"d": {
        "results": [{"Lifnr": "0000001000", "Name1": "A"},
                    {"Lifnr": "0000001001", "Name1": "B"}],
        "__next": "https://sap.internal/sap/opu/odata/sap/ZVZI_KPI02_SHARED_SRV/VendorSet?$skiptoken=%270000001001%27",
    }})
    page_two = json.dumps({"d": {"results": [{"Lifnr": "0000001002", "Name1": "C"}]}})

    client, session = _fake_client([FakeResponse(200, page_one), FakeResponse(200, page_two)])
    rows = client.get_all("VendorSet")
    r.check("pagination concatenates pages", len(rows), 3)
    r.check("rows keep their order", [row["Lifnr"][-1] for row in rows], ["0", "1", "2"])
    r.check("resolved the owning service",
            "ZVZI_KPI02_SHARED_SRV" in session.calls[0]["params"]["APIPath"])
    r.check("sent a bearer token",
            session.calls[0]["authorization"], "Bearer token-1")
    r.check("APIQuery is passed unencoded for the HTTP layer to encode",
            "$format=json" in session.calls[0]["params"]["APIQuery"])
    r.check("second call followed __next",
            "$skiptoken='0000001001'" in session.calls[1]["params"]["APIQuery"])

    # ZMM set: proves service resolution picks the other service.
    client, session = _fake_client([FakeResponse(200, json.dumps({"d": {"results": []}}))])
    client.get("ChangeDocHeaderSet")
    r.check("ZMM set routed to ZMM service",
            "ZMM_KPI02_SRV" in session.calls[0]["params"]["APIPath"])

    # Typed values arrive typed.
    typed = json.dumps({"d": {"results": [
        {"Changenr": "0000123456", "Udate": "/Date(1757280000000)/", "Utime": "PT08H30M00S"}
    ]}})
    client, _ = _fake_client([FakeResponse(200, typed)])
    row = client.get("ChangeDocHeaderSet")[0]
    r.check("DateTime coerced by declared type",
            row["Udate"].isoformat(), "2025-09-07T21:20:00+00:00")
    r.check("Time coerced by declared type", row["Utime"], dt_time(8, 30))

    # A 401 mid-stream refreshes the token and retries once, transparently.
    client, session = _fake_client([
        FakeResponse(401, "token expired"),
        FakeResponse(200, json.dumps({"d": {"results": [{"Lifnr": "1"}]}})),
    ])
    rows = client.get("VendorSet")
    r.check("401 recovered without surfacing", len(rows), 1)
    r.check("re-authenticated once", session.token_calls, 2)
    r.check("retried with the new token",
            session.calls[1]["authorization"], "Bearer token-2")

    # 503 then success: the retry policy carries it.
    client, session = _fake_client([
        FakeResponse(503, "overloaded"),
        FakeResponse(200, json.dumps({"d": {"results": [{"Lifnr": "1"}]}})),
    ])
    r.check("503 retried to success", len(client.get("VendorSet")), 1)

    # 403 surfaces immediately, unretried.
    client, session = _fake_client([FakeResponse(403, "")])
    r.raises("403 surfaces to the caller", CPIForbiddenError, client.get, "VendorSet")
    r.check("403 not retried over the wire", len(session.calls), 1)

    # $count, including the unbounded-500 case this landscape has.
    client, _ = _fake_client([FakeResponse(200, "227")])
    r.check("count parses plain text", client.count("VendorSet"), 227)
    client, _ = _fake_client([FakeResponse(500, "")])
    r.raises("count 500 raises a server error", CPIServerError, client.count, "VendorSet")

    # An unknown entity set fails before any network call.
    client, session = _fake_client([])
    r.raises("unknown entity set rejected locally", CPINotFoundError,
             client.get, "NoSuchSet")
    r.check("no request was made for an unknown set", len(session.calls), 0)

    # Client-side paging fallback for a projection with no __next.
    full = json.dumps({"d": {"results": [{"Lifnr": "1"}, {"Lifnr": "2"}]}})
    partial = json.dumps({"d": {"results": [{"Lifnr": "3"}]}})
    client, session = _fake_client([FakeResponse(200, full), FakeResponse(200, partial)])
    rows = client.get_all("VendorSet", page_size=2)
    r.check("falls back to $skip paging when __next is absent", len(rows), 3)
    r.check("second page skipped correctly",
            "$skip=2" in session.calls[1]["params"]["APIQuery"])


def run(verbose: bool = False) -> int:
    print("cpi_client selftest - offline, no credentials required")
    if not verbose:
        # Several suites provoke 503/500 on purpose; their retry warnings are
        # expected output, not information.
        logging.getLogger("cpi_client.retry").setLevel(logging.ERROR)
    r = Results(verbose)
    for suite in (test_query, test_types, test_parser, test_errors,
                  test_retry, test_auth, test_client):
        suite(r)

    total = r.passed + len(r.failed)
    print(f"\n{'-' * 60}")
    if r.failed:
        print(f"{len(r.failed)} of {total} checks FAILED:")
        for line in r.failed:
            print(f"  - {line}")
        return 1
    print(f"all {total} checks passed")
    return 0
