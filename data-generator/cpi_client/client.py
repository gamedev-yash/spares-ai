"""
The client itself: the one object callers use.

    from cpi_client import CPIClient

    with CPIClient.from_env() as cpi:
        vendors = cpi.get_all("VendorSet")
        recent  = cpi.get("PurchaseOrderSet", filter="Bedat gt datetime'2026-01-01T00:00:00'")

Callers name an entity set. Which of the two services owns it, how the path
is built, whether a token is still valid, how a page is followed and how a
value is typed are all decided here.

Every request funnels through ``_request``, so authentication, retry, error
mapping and logging exist once rather than at each call site.
"""

from __future__ import annotations

import logging
from typing import Iterator

import requests

from .auth import TokenManager
from .config import CPIConfig
from .errors import CPIAuthError, CPIError, CPITransportError, from_response
from .models import Page, Schema
from .parser import parse_collection
from .query import Query, build_api_path
from .retry import DEFAULT_POLICY, RetryPolicy, run_with_retry

log = logging.getLogger("cpi_client")

# Guard against a malformed __next loop walking forever.
MAX_PAGES = 10_000


class CPIClient:
    def __init__(
        self,
        config: CPIConfig,
        *,
        schema: Schema | None = None,
        policy: RetryPolicy = DEFAULT_POLICY,
        session: requests.Session | None = None,
        coerce_types: bool = True,
    ) -> None:
        self.config = config
        self.schema = schema or Schema.load()
        self.policy = policy
        self.coerce_types = coerce_types
        self._session = session or requests.Session()
        self._auth = TokenManager(config, session=self._session)
        self.request_count = 0

    @classmethod
    def from_env(cls, *, env_file=None, discovery_dir=None, **kwargs) -> "CPIClient":
        return cls(
            CPIConfig.from_env(env_file=env_file),
            schema=Schema.load(discovery_dir),
            **kwargs,
        )

    def close(self) -> None:
        self._session.close()

    def __enter__(self) -> "CPIClient":
        return self

    def __exit__(self, *exc_info) -> None:
        self.close()

    # ---------------------------------------------------------------- transport

    def _request(self, api_path: str, api_query: str = "", *, accept: str,
                 raise_on_error: bool = True) -> requests.Response:
        """One authenticated GET through the CPI proxy, with retry.

        ``raise_on_error=False`` returns the failed response instead of
        raising, so the debug path can show what actually came back.

        The 401 path is deliberately not part of the retry policy: a rejected
        token is refreshed and re-sent exactly once inside a single attempt,
        because backing off would not make an expired token valid.
        """

        def attempt(number: int) -> requests.Response:
            token = self._auth.get_token()
            response = self._send(api_path, api_query, token=token, accept=accept)

            if response.status_code == 401:
                log.debug("401 on attempt %d - refreshing token and retrying once", number)
                self._auth.invalidate()
                token = self._auth.get_token(force=True)
                response = self._send(api_path, api_query, token=token, accept=accept)

            if raise_on_error and response.status_code >= 400:
                raise from_response(response, api_path=api_path, api_query=api_query)
            return response

        return run_with_retry(attempt, policy=self.policy, describe=f"GET {api_path}")

    def _send(self, api_path: str, api_query: str, *, token: str, accept: str) -> requests.Response:
        self.request_count += 1
        # APIQuery is handed over unencoded on purpose: requests encodes each
        # parameter value exactly once. Pre-encoding here would double-encode.
        params = {"APIPath": api_path}
        if api_query:
            params["APIQuery"] = api_query
        try:
            return self._session.get(
                self.config.endpoint,
                params=params,
                headers={"Authorization": f"Bearer {token}", "Accept": accept},
                timeout=self.config.request_timeout,
                verify=self.config.verify,
            )
        except requests.exceptions.RequestException as exc:
            raise CPITransportError(
                str(exc), api_path=api_path, api_query=api_query
            ) from exc

    # ------------------------------------------------------------------- reads

    def metadata(self, service: str) -> str:
        """Raw EDMX for a service. XML by definition - no $format here."""
        path = build_api_path(service, metadata=True)
        return self._request(path, accept="application/xml").text

    def count(self, entity_set: str, *, filter: str | None = None,  # noqa: A002
              service: str | None = None) -> int:
        """$count for an entity set.

        Some sets in this landscape reject an unbounded $count with HTTP 500
        (PurchaseRequisitionSet, GoodsMovementItemSet, PurchaseOrderItemSet).
        Pass a filter for those.
        """
        service = service or self.schema.service_for(entity_set)
        path = build_api_path(service, entity_set, count=True)
        query = f"$filter={filter}" if filter else ""
        response = self._request(path, query, accept="text/plain")
        text = (response.text or "").strip()
        try:
            return int(text)
        except ValueError:
            raise CPIError(
                f"$count returned {text[:200]!r} rather than a number",
                api_path=path, api_query=query,
            ) from None

    def get_page(
        self,
        entity_set: str,
        *,
        query: Query | None = None,
        service: str | None = None,
        keep_raw: bool = False,
        **query_kwargs,
    ) -> Page:
        """One page of an entity set.

        Accepts either a prepared Query or the same options as keywords:
        ``cpi.get_page("VendorSet", top=5, select=["Lifnr", "Name1"])``.
        """
        service = service or self.schema.service_for(entity_set)
        query = query or Query(**query_kwargs)
        path = build_api_path(service, entity_set)
        response = self._request(path, query.render(), accept="application/json")
        return parse_collection(
            response.text,
            types=self.schema.types_for(entity_set),
            coerce_types=self.coerce_types,
            keep_raw=keep_raw,
        )

    # ``get`` is the everyday name; it returns rows, not a Page.
    def get(self, entity_set: str, **kwargs) -> list[dict]:
        """Rows from a single page. Use ``get_all`` when you want everything."""
        return self.get_page(entity_set, **kwargs).rows

    def iter_pages(
        self,
        entity_set: str,
        *,
        query: Query | None = None,
        service: str | None = None,
        max_pages: int | None = None,
        page_size: int | None = None,
        **query_kwargs,
    ) -> Iterator[Page]:
        """Walk every page of an entity set.

        SAP pages server-side and returns ``__next``; that is followed when
        present. When it is absent but a page came back full, $skip paging
        takes over - some projections page one way, some the other, and a
        client that only knows one of them silently truncates.
        """
        service = service or self.schema.service_for(entity_set)
        query = query or Query(**query_kwargs)
        if page_size and query.top is None:
            query = query.with_(top=page_size)

        types = self.schema.types_for(entity_set)
        path = build_api_path(service, entity_set)
        api_query = query.render()
        limit = max_pages or MAX_PAGES
        skipped = query.skip or 0

        for index in range(limit):
            response = self._request(path, api_query, accept="application/json")
            page = parse_collection(
                response.text, types=types, coerce_types=self.coerce_types
            )
            yield page

            if page.has_next:
                path = page.next_path or path
                api_query = page.next_query or ""
                if query.format_json and "$format" not in api_query:
                    api_query = f"{api_query}&$format=json" if api_query else "$format=json"
                continue

            # No __next. Keep going only if the page looks full, which is the
            # signal that the projection uses client-side paging instead.
            if not page.rows or query.top is None or len(page.rows) < query.top:
                return
            skipped += len(page.rows)
            api_query = query.with_(skip=skipped).render()

        log.warning("stopped after %d pages of %s", limit, entity_set)

    def get_all(self, entity_set: str, **kwargs) -> list[dict]:
        """Every row, following pagination. Materialises the whole set in memory."""
        rows: list[dict] = []
        for page in self.iter_pages(entity_set, **kwargs):
            rows.extend(page.rows)
        return rows

    # ------------------------------------------------------------------ health

    def check(self) -> dict:
        """Prove the whole chain works: config, token, and one live call.

        Returns a summary rather than raising, so a caller can report on a
        partial failure. Uses $metadata because it costs SAP nothing and
        returns no business data.
        """
        result: dict = {"config": self.config.redacted(), "token": None,
                        "metadata": None, "ok": False}
        try:
            token = self._auth.get_token()
            held = self._auth.token
            result["token"] = {
                "acquired": True,
                "length": len(token),
                "expires_in": round(held.expires_in) if held else None,
            }
        except CPIError as exc:
            result["token"] = {"acquired": False, "error": str(exc)}
            return result

        service = next(iter(self.schema.services), "ZVZI_KPI02_SHARED_SRV")
        try:
            xml = self.metadata(service)
            result["metadata"] = {"service": service, "bytes": len(xml),
                                  "looks_like_edmx": "<edmx:Edmx" in xml[:400]}
            result["ok"] = bool(result["metadata"]["looks_like_edmx"])
        except CPIError as exc:
            result["metadata"] = {"service": service, "error": str(exc)}
        return result
