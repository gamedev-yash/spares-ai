"""
APIPath and APIQuery construction.

CPI is a pass-through: one endpoint, and two parameters that carry the real
request.

    APIPath   where in SAP    sap/opu/odata/sap/{SERVICE}/{EntitySet}
    APIQuery  what to return  $filter=... & $select=... & $top=...

Two encoding traps live here, which is exactly why this is a module and not
an f-string at each call site:

  1. APIQuery is itself a query string travelling as a parameter *value*, so
     it must be encoded once - by the HTTP layer - and never pre-encoded here.
     Building it as a plain string and handing it to requests' ``params=``
     does the right thing; quoting it first would double-encode it.
  2. OData string literals are single-quoted, and a literal quote inside one
     is escaped by doubling it. ``literal()`` is the only correct way to put
     a caller-supplied value into a $filter.
"""

from __future__ import annotations

from dataclasses import dataclass, field

ODATA_ROOT = "sap/opu/odata/sap"


def build_api_path(service: str, entity_set: str = "", *, metadata: bool = False,
                   count: bool = False) -> str:
    """Build the SAP-side path that goes into the APIPath parameter.

    >>> build_api_path("ZVZI_KPI02_SHARED_SRV", "VendorSet")
    'sap/opu/odata/sap/ZVZI_KPI02_SHARED_SRV/VendorSet'
    >>> build_api_path("ZMM_KPI02_SRV", metadata=True)
    'sap/opu/odata/sap/ZMM_KPI02_SRV/$metadata'
    """
    if metadata and count:
        raise ValueError("metadata and count are mutually exclusive")
    path = f"{ODATA_ROOT}/{service}"
    if metadata:
        return f"{path}/$metadata"
    if not entity_set:
        raise ValueError("entity_set is required unless metadata=True")
    path = f"{path}/{entity_set}"
    return f"{path}/$count" if count else path


def literal(value) -> str:
    """Render a Python value as an OData v2 literal, safely quoted.

    >>> literal("O'Brien Mining")
    "'O''Brien Mining'"
    >>> literal(42)
    '42'
    """
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def eq(field_name: str, value) -> str:
    """One equality term for a $filter, with the value escaped."""
    return f"{field_name} eq {literal(value)}"


def and_(*terms: str) -> str:
    """Join non-empty terms with ``and``, parenthesising each."""
    kept = [t for t in terms if t]
    if len(kept) <= 1:
        return kept[0] if kept else ""
    return " and ".join(f"({t})" for t in kept)


@dataclass
class Query:
    """The OData system query options, rendered into one APIQuery string.

    ``format_json`` is on by default: OData v2 answers in XML unless asked
    otherwise, and $format is more reliable through a pass-through proxy than
    an Accept header, which the iFlow is free to rewrite.
    """

    filter: str | None = None
    select: list[str] | str | None = None
    top: int | None = None
    skip: int | None = None
    orderby: list[str] | str | None = None
    expand: list[str] | str | None = None
    inlinecount: bool = False
    skiptoken: str | None = None
    format_json: bool = True
    extra: dict[str, str] = field(default_factory=dict)

    def render(self) -> str:
        """Produce the raw APIQuery value. Not URL-encoded - see module docstring."""
        parts: list[str] = []

        def add(name: str, value) -> None:
            if value is None or value == "" or value == []:
                return
            if isinstance(value, (list, tuple)):
                value = ",".join(str(v) for v in value)
            parts.append(f"{name}={value}")

        add("$filter", self.filter)
        add("$select", self.select)
        add("$expand", self.expand)
        add("$orderby", self.orderby)
        if self.top is not None:
            add("$top", int(self.top))
        if self.skip is not None:
            add("$skip", int(self.skip))
        add("$skiptoken", self.skiptoken)
        if self.inlinecount:
            add("$inlinecount", "allpages")
        if self.format_json:
            add("$format", "json")
        for name, value in self.extra.items():
            add(name, value)

        return "&".join(parts)

    def with_(self, **changes) -> "Query":
        """A copy with fields replaced - used when walking pages."""
        merged = {
            "filter": self.filter,
            "select": self.select,
            "top": self.top,
            "skip": self.skip,
            "orderby": self.orderby,
            "expand": self.expand,
            "inlinecount": self.inlinecount,
            "skiptoken": self.skiptoken,
            "format_json": self.format_json,
            "extra": dict(self.extra),
        }
        merged.update(changes)
        return Query(**merged)

    def __str__(self) -> str:
        return self.render()
