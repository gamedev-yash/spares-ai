"""
Terminal interface to the client. There is no application consuming this
library yet, so the CLI is how it gets exercised.

    python -m cpi_client selftest                     offline, no network
    python -m cpi_client check                        config + token + one call
    python -m cpi_client sets                         entity sets and owners
    python -m cpi_client count VendorSet
    python -m cpi_client get VendorSet --top 5
    python -m cpi_client get PurchaseOrderSet --filter "Bsart eq 'ZREP'" --top 3
    python -m cpi_client all VendorSet --out vendors.csv
    python -m cpi_client metadata ZMM_KPI02_SRV --out zmm.xml
    python -m cpi_client raw sap/opu/odata/sap/ZMM_KPI02_SRV/ChangeDocItemSet/$count \
        --query "$filter=Objectclas eq 'MATERIAL'"

``selftest`` is the one to run first: it proves query building, envelope
parsing, type coercion, error mapping and the retry schedule without
touching the network or needing credentials.
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import sys
from pathlib import Path

from .client import CPIClient
from .errors import CPIError
from .parser import to_csv_value


# ------------------------------------------------------------------ formatting

def _print_table(rows: list[dict], *, limit: int = 50, max_width: int = 28) -> None:
    if not rows:
        print("(no rows)")
        return
    columns: list[str] = []
    for row in rows:
        for key in row:
            if key not in columns:
                columns.append(key)

    shown = rows[:limit]
    cells = [[_clip(to_csv_value(r.get(c)), max_width) for c in columns] for r in shown]
    widths = [
        min(max_width, max(len(c), *(len(row[i]) for row in cells)) if cells else len(c))
        for i, c in enumerate(columns)
    ]

    print("  ".join(c[:w].ljust(w) for c, w in zip(columns, widths)))
    print("  ".join("-" * w for w in widths))
    for row in cells:
        print("  ".join(cell.ljust(w) for cell, w in zip(row, widths)))
    if len(rows) > limit:
        print(f"... {len(rows) - limit:,} more row(s) not shown")


def _clip(text: str, width: int) -> str:
    return text if len(text) <= width else text[: width - 1] + "…"


def _write_csv(path: Path, rows: list[dict]) -> None:
    columns: list[str] = []
    for row in rows:
        for key in row:
            if key not in columns:
                columns.append(key)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({c: to_csv_value(row.get(c)) for c in columns})


def _client(args) -> CPIClient:
    return CPIClient.from_env(
        env_file=args.env_file,
        discovery_dir=args.discovery_dir,
        coerce_types=not args.no_coerce,
    )


def _query_kwargs(args) -> dict:
    kwargs = {}
    for name in ("filter", "select", "top", "skip", "orderby", "expand"):
        value = getattr(args, name, None)
        if value is None:
            continue
        if name in ("select", "orderby", "expand"):
            value = [part.strip() for part in value.split(",") if part.strip()]
        kwargs[name] = value
    return kwargs


# -------------------------------------------------------------------- commands

def cmd_check(args) -> int:
    with _client(args) as cpi:
        result = cpi.check()
    if args.json:
        print(json.dumps(result, indent=2, default=str))
        return 0 if result["ok"] else 1

    print("configuration")
    for key, value in result["config"].items():
        print(f"  {key:20s} {value}")
    token = result["token"] or {}
    print("\ntoken")
    if token.get("acquired"):
        print(f"  acquired             yes ({token['length']} chars)")
        print(f"  expires_in           {token['expires_in']}s")
    else:
        print(f"  acquired             NO\n  error                {token.get('error')}")
        return 1
    meta = result["metadata"] or {}
    print("\nlive call ($metadata)")
    if "error" in meta:
        print(f"  {meta['service']:20s} FAILED: {meta['error']}")
    else:
        print(f"  {meta['service']:20s} {meta['bytes']:,} bytes, "
              f"EDMX={'yes' if meta['looks_like_edmx'] else 'no'}")
    print(f"\n{'OK' if result['ok'] else 'NOT OK'}")
    return 0 if result["ok"] else 1


def cmd_sets(args) -> int:
    with _client(args) as cpi:
        source = cpi.schema.source
        print(f"schema source: {source or '(built-in fallback - no discovery folder)'}\n")
        for service, names in cpi.schema.services.items():
            print(f"{service}  ({len(names)} sets)")
            for name in names:
                info = cpi.schema.get(name)
                keys = ";".join(info.keys) or "-"
                print(f"  {name:34s} {len(info.properties):>3} props  keys: {keys}")
            print()
    return 0


def cmd_count(args) -> int:
    with _client(args) as cpi:
        total = cpi.count(args.entity_set, filter=args.filter)
    print(f"{args.entity_set}: {total:,}")
    return 0


def cmd_get(args) -> int:
    with _client(args) as cpi:
        page = cpi.get_page(args.entity_set, keep_raw=args.raw_json, **_query_kwargs(args))
    if args.raw_json:
        print(json.dumps(page.raw, indent=2)[: args.raw_bytes])
        return 0
    if args.json:
        print(json.dumps(page.rows, indent=2, default=str))
        return 0
    print(f"{args.entity_set}: {len(page.rows)} row(s) in this page"
          + (f", total {page.total:,}" if page.total is not None else "")
          + (", more pages available" if page.has_next else ", last page"))
    print()
    _print_table(page.rows, limit=args.limit)
    if page.has_next:
        print(f"\nnext APIPath : {page.next_path}")
        print(f"next APIQuery: {page.next_query}")
    return 0


def cmd_all(args) -> int:
    rows: list[dict] = []
    with _client(args) as cpi:
        expected = None
        if args.verify_count:
            try:
                expected = cpi.count(args.entity_set, filter=args.filter)
                print(f"$count says {expected:,}")
            except CPIError as exc:
                print(f"$count unavailable ({exc}); continuing without verification")

        for index, page in enumerate(
            cpi.iter_pages(
                args.entity_set,
                max_pages=args.max_pages,
                page_size=args.page_size,
                **_query_kwargs(args),
            ),
            start=1,
        ):
            rows.extend(page.rows)
            print(f"  page {index:>4}  {len(page.rows):>6} rows  "
                  f"running total {len(rows):>8,}")
        print(f"\nfetched {len(rows):,} row(s) in {cpi.request_count} request(s)")

        if expected is not None:
            verdict = "MATCHES" if expected == len(rows) else "MISMATCH"
            print(f"$count {expected:,} vs fetched {len(rows):,} -> {verdict}")

    if args.out:
        path = Path(args.out)
        _write_csv(path, rows)
        print(f"wrote {path.resolve()}")
    elif rows:
        print()
        _print_table(rows, limit=args.limit)
    return 0


def cmd_metadata(args) -> int:
    with _client(args) as cpi:
        xml = cpi.metadata(args.service)
    if args.out:
        Path(args.out).write_text(xml, encoding="utf-8")
        print(f"wrote {Path(args.out).resolve()} ({len(xml):,} bytes)")
    else:
        print(xml[: args.raw_bytes])
    return 0


def cmd_raw(args) -> int:
    """Escape hatch: call an arbitrary APIPath/APIQuery and print what comes back."""
    with _client(args) as cpi:
        response = cpi._request(  # noqa: SLF001 - deliberate, this is the debug path
            args.api_path, args.query or "", accept=args.accept,
            raise_on_error=False,
        )
    print(f"HTTP {response.status_code}  {len(response.content):,} bytes  "
          f"content-type: {response.headers.get('Content-Type', '?')}\n")
    print(response.text[: args.raw_bytes])
    return 0


def cmd_selftest(args) -> int:
    from . import selftest
    return selftest.run(verbose=args.verbose)


# ---------------------------------------------------------------------- parser

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m cpi_client",
        description="Read SAP through the VZI CPI proxy.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--env-file", help="path to .env (default: searched near the package)")
    parser.add_argument("--discovery-dir", help="folder holding properties.csv")
    parser.add_argument("--no-coerce", action="store_true",
                        help="leave values as they arrive on the wire")
    parser.add_argument("--json", action="store_true", help="machine-readable output")
    parser.add_argument("--limit", type=int, default=25, help="rows to print (default 25)")
    parser.add_argument("--raw-bytes", type=int, default=4000,
                        help="truncate raw output at N characters")
    parser.add_argument("-v", "--verbose", action="store_true", help="debug logging")

    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("selftest", help="offline checks - no network, no credentials")
    p.set_defaults(func=cmd_selftest)

    p = sub.add_parser("check", help="config + token + one live $metadata call")
    p.set_defaults(func=cmd_check)

    p = sub.add_parser("sets", help="known entity sets and which service owns each")
    p.set_defaults(func=cmd_sets)

    p = sub.add_parser("count", help="$count for an entity set")
    p.add_argument("entity_set")
    p.add_argument("--filter")
    p.set_defaults(func=cmd_count)

    def add_query_options(sp) -> None:
        sp.add_argument("--filter")
        sp.add_argument("--select", help="comma-separated property names")
        sp.add_argument("--orderby", help="comma-separated")
        sp.add_argument("--expand", help="comma-separated navigation properties")

    p = sub.add_parser("get", help="one page of an entity set")
    p.add_argument("entity_set")
    add_query_options(p)
    p.add_argument("--top", type=int, default=10)
    p.add_argument("--skip", type=int)
    p.add_argument("--raw-json", action="store_true",
                   help="print SAP's envelope unparsed - use this to inspect the wire format")
    p.set_defaults(func=cmd_get)

    p = sub.add_parser("all", help="every page of an entity set")
    p.add_argument("entity_set")
    add_query_options(p)
    p.add_argument("--page-size", type=int, default=1000, help="$top per page (default 1000)")
    p.add_argument("--max-pages", type=int, help="stop after N pages")
    p.add_argument("--out", help="write rows to this CSV")
    p.add_argument("--verify-count", action="store_true",
                   help="compare the row total against $count")
    p.set_defaults(func=cmd_all)

    p = sub.add_parser("metadata", help="raw EDMX for a service")
    p.add_argument("service")
    p.add_argument("--out")
    p.set_defaults(func=cmd_metadata)

    p = sub.add_parser("raw", help="call an arbitrary APIPath - debugging escape hatch")
    p.add_argument("api_path")
    p.add_argument("--query", help="raw APIQuery, unencoded")
    p.add_argument("--accept", default="application/json")
    p.set_defaults(func=cmd_raw)

    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)-7s %(name)s: %(message)s",
    )
    try:
        return args.func(args)
    except CPIError as exc:
        print(f"\n{type(exc).__name__}: {exc}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("\ninterrupted", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
