# cpi_client

One reusable way to read SAP through the VZI CPI proxy. Covers W2.1: OAuth
client-credentials token handling, APIPath/APIQuery construction, OData v2
envelope parsing, retry and error mapping.

No dependencies beyond `requests`. No backend, no service — a library plus a
CLI, living next to the data generator that already proved the endpoint works.

## The one thing to know about this endpoint

CPI here is **not** an OData service. It is a single pass-through iFlow, and
the real SAP request travels as two query parameters:

```
GET {CPI_BASE_URL}/http/SAPECC/OdataConsumption
    ?APIPath=sap/opu/odata/sap/{SERVICE}/{EntitySet}
    &APIQuery=$filter=...&$select=...&$top=...
Authorization: Bearer {token}
```

`APIPath` is *where* in SAP; `APIQuery` is *what* to return. Two services sit
behind it — `ZVZI_KPI02_SHARED_SRV` (14 sets) and `ZMM_KPI02_SRV` (7 sets) —
and the client resolves which one owns an entity set for you, so callers name
the set and nothing else.

## Quick start

```powershell
cd "…\spares-ai\data-generator"
python -m cpi_client selftest     # offline, no credentials, no network
python -m cpi_client check        # config + token + one live $metadata call
python -m cpi_client sets         # what you can ask for
python -m cpi_client count VendorSet
python -m cpi_client get VendorSet --top 5
```

## Library use

```python
from cpi_client import CPIClient, Query, eq

with CPIClient.from_env() as cpi:
    print(cpi.count("VendorSet"))                       # 227

    rows = cpi.get("MaterialSet", top=10, select=["Matnr", "Mtart"])

    repairs = cpi.get_all(
        "PurchaseOrderItemSet",
        filter=eq("Pstyp", "3"),                        # value is escaped for you
        page_size=1000,
    )

    for page in cpi.iter_pages("MaterialDocumentHeaderSet", page_size=1000):
        load(page.rows)                                 # 40k rows, streamed
```

`get` returns one page of rows, `get_all` follows pagination and returns
everything, `iter_pages` streams page by page so a large set never has to fit
in memory at once.

## Credentials

Four environment variables, never hard-coded, never on the command line:

```
CPI_CLIENT_ID
CPI_CLIENT_SECRET
CPI_TOKEN_URL
CPI_BASE_URL
```

Locally they come from a `.env`. The search order is `cpi_client/.env`, then
`data-generator/.env`, then `spares-ai/.env` — the last of which is where the
file currently sits, so it works as-is. `CPI_ENV_FILE` or `--env-file`
overrides the search; real environment variables always win over the file.

On Azure, supply the same four names as App Service settings or Key Vault
references and change nothing else.

`CPI_VERIFY` can point at a CA bundle if you are behind TLS interception —
though `pip install pip-system-certs` is the cleaner fix, since it makes
Python trust the Windows certificate store.

## CLI reference

| Command | What it does |
|---|---|
| `selftest` | 93 offline checks: query building, parsing, coercion, errors, retry, pagination. No network. |
| `check` | Prints redacted config, acquires a token, calls `$metadata`. Start here when something is wrong. |
| `sets` | Every known entity set, its owning service, property count and keys. |
| `count <Set> [--filter …]` | `$count`. |
| `get <Set> [--top N] [--filter …] [--select a,b]` | One page, as a table. `--raw-json` prints SAP's envelope unparsed. |
| `all <Set> [--out f.csv] [--verify-count]` | Every page. `--verify-count` compares the row total against `$count`. |
| `metadata <SERVICE> [--out f.xml]` | Raw EDMX. |
| `raw <APIPath> [--query …]` | Arbitrary call, unparsed response. Debugging escape hatch. |

Global: `--env-file`, `--discovery-dir`, `--no-coerce`, `--json`, `--limit`,
`-v`.

## How values arrive

OData v2 puts non-string types on the wire in forms that surprise JSON
consumers. The client converts them using the **declared** type from
`discovery/properties.csv` — never guessed from the value:

| EDM type | On the wire | You get |
|---|---|---|
| `Edm.DateTime` | `/Date(1757280000000)/` | `datetime` (offsets are *minutes*: `+0330` is IST) |
| `Edm.Time` | `PT08H30M00S` | `time` |
| `Edm.Decimal` | `"1234.56"` (a string, to protect precision) | `Decimal` |
| `Edm.Int*` | `"42"` or `42` | `int` |
| `Edm.Boolean` | `true` / `"X"` | `bool` |

Driving this from the declared type matters: `PurchaseOrderItemSet.Netpr` and
`.Netwr` were re-declared from `Edm.Decimal` to `Edm.String` by the service, so
a parser that guessed from the value would keep converting fields the contract
now says are text. Pass `--no-coerce` (or `coerce_types=False`) to see the raw
wire values.

Because the type map is read from `discovery/properties.csv` at run time, a
fresh `cpi_discovery.py` run updates the client with no code change — the same
arrangement `generate.py` uses.

## Pagination

SAP pages server-side and returns `d.__next`. That link points at the **SAP
host**, which is not reachable from here — only the CPI proxy is — so the
client splits it back into `APIPath` + `APIQuery` and re-issues it through the
proxy. If a projection returns no `__next` but hands back a full page, the
client falls back to `$top`/`$skip` paging: some projections page one way, some
the other, and a client that knows only one of them silently truncates.

Verify a full read against `$count` before trusting it:

```powershell
python -m cpi_client all VendorSet --verify-count --out vendors.csv
```

## Errors

| HTTP | Exception | Retried |
|---|---|---|
| 400 | `CPIBadRequestError` | no — usually a bad `$filter` or property name |
| 401 | `CPIAuthError` | token refreshed and retried once, transparently |
| 403 | `CPIForbiddenError` | no |
| 404 | `CPINotFoundError` | no |
| 429 | `CPIRateLimitError` | yes, honouring `Retry-After` |
| 5xx | `CPIServerError` | yes |
| 503/504 | `CPIServiceUnavailableError` | yes |
| network/TLS | `CPITransportError` | yes |
| bad payload | `CPIParseError` | no |

SAP's own error envelope is unwrapped onto `sap_code` and `sap_message` when
one is present.

**Measured caveat:** this iFlow does not forward it. A bad `$filter` comes back
as `HTTP 400` with a **zero-byte body** — SAP's `code`/`message` are discarded
at the proxy. So `sap_message` is empty in practice and the status code is all
you get. Two consequences: check property names against `python -m cpi_client
sets` rather than guessing, and treat "pass the error body through" as a request
for the CPI team, since it costs real debugging time.

Retries use exponential backoff with jitter — without the jitter, several
workers hitting one 503 retry in lockstep and recreate the overload.

### A landscape quirk worth knowing

`$count` **without a filter returns HTTP 500** on `PurchaseRequisitionSet`,
`GoodsMovementItemSet` and `PurchaseOrderItemSet`, while the other eleven sets
answer normally. Confirmed against the live tenant: the same set answers fine
*with* a filter —

```
python -m cpi_client count PurchaseRequisitionSet                      -> HTTP 500
python -m cpi_client count PurchaseRequisitionSet --filter "Werks eq '1000'" -> 0
```

— so it is those projections rejecting unbounded queries, not a transient
fault, and retrying will not help. The client still retries it (5xx is
retryable in general), which costs ~3s before the error surfaces.

## Layout

```
config.py   settings, .env loading, the CPI_PATH constant
auth.py     OAuth client-credentials, token caching with expiry and a lock
query.py    build_api_path, Query, literal escaping for $filter
parser.py   d.results unwrapping, __next re-splitting, EDM coercion
retry.py    RetryPolicy, backoff, which failures are worth another try
errors.py   HTTP status -> typed exception, SAP error envelope
models.py   entity-set registry read from discovery/properties.csv
client.py   the facade: get / get_all / iter_pages / count / metadata / check
cli.py      terminal interface
selftest.py offline checks
```

## Two encoding traps, documented so nobody re-derives them

1. **`APIQuery` must be encoded exactly once.** It is a query string travelling
   as a parameter *value*. Building it as a plain string and handing it to
   `requests`' `params=` is correct; pre-encoding it double-encodes it and SAP
   sees a literal `%24filter`.
2. **OData string literals are single-quoted, and an embedded quote is doubled.**
   `literal()` is the only correct way to put a caller-supplied value into a
   `$filter` — `literal("O'Brien")` gives `'O''Brien'`.

## Not covered

Read-only by design: no POST/PUT/DELETE, no `$batch`, no CSRF token handling.
Those are a separate piece of work if the platform ever needs to write back to
SAP.
