# WS2 — SAP Integration and Data Contract (W2.1 → W2.7)

**Scope:** initiatives I07, I08, I13.
**Situation:** no Azure instance yet. CPI *is* reachable from a workstation.
**Goal of this phase:** build and test everything that does *not* require the live
environment, behind seams that are swapped — not rewritten — on the day Azure lands.

> **Status: W2.7 has been run.** Discovery re-swept **08-Sep 14:16** after the SAP
> team's fixes. `ZMM_KPI02_SRV` is now registered and the gate is **passed**. Six
> of the seven facts in the previous version of this doc are obsolete; §1 and §8
> are rewritten against measured results, and §9 is now a repeat-run runbook
> rather than a first-run one.

> **How to read this doc.** Every task has the same five headings:
> *What it means*, *What we do now*, *What we cannot do*, *Mock or placeholder*,
> *How we test it*. If you only read one section, read
> [§11 Order of work](#11-order-of-work).

---

## 1. Where we actually stand

Measured facts from `data-generator/discovery/`, swept **08-Sep 14:16**.

| Fact | Evidence | Change since 12:08 |
|---|---|---|
| **All 21 entity sets are exposed** | `entity_sets.csv` — 14 on `ZVZI_KPI02_SHARED_SRV` + 7 on `ZMM_KPI02_SRV`, 229 properties total | **was 14 of 21** |
| **`ZMM_KPI02_SRV` is registered** | `metadata_ZMM_KPI02_SRV.xml` now **19,129 bytes**, 7 sets, 75 properties | **was 0 bytes** |
| **3 sets return zero rows** | `counts.csv` — `ReservationItemSet` **0**, `MaterialValuationSet` **0**, `MonthlyMovementStatisticSet` **0** | **new blocker** |
| **2 sets cannot report `$count`** | `PurchaseRequisitionSet`, `GoodsMovementItemSet` — HTTP 500 | **was 3** |
| **`PurchaseOrderItemSet` `$count` is fixed** | now returns **11,074** | **was HTTP 500** |
| **FR-9 is feasible** | `fr9_check.txt` — `MATERIAL` **26,405** · `MATERIAL`+`MARC` **7,220** · `BANF` **2,912** | **was 3× HTTP 500** |
| **Change documents are large** | `ChangeDocItemSet` **929,151** · `ChangeDocHeaderSet` **241,685** | newly visible |
| **`MARA.EXTWG` is still not exposed** | `MaterialSet` still 7 properties: `Matnr`, `Lvorm`, `Mtart`, `Matkl`, `Bismt`, `Meins`, `Mstae` | **unchanged** |

### 1.1 The gates

1. **ZMM_KPI02_SRV registration — CLOSED.** Service responds, all 7 sets present
   with real keys and types. Every property name we had guessed is now measured.
2. **EXTWG exposure — STILL OPEN.** `MARA.EXTWG` is absent from the
   `MaterialSet` projection. This remains the single blocking dependency for the
   I13 material scope and the I07 OAR flag. **W2.4's bet paid off** — because
   scope was never hard-coded, this is still a config change when it lands.
3. **Empty reservations — NEW, and now the top blocker.** See §1.3.

### 1.2 What the sweep confirmed, and what it corrected

Our assumed property names were mostly right. Three were not.

| Assumption | Reality | Impact |
|---|---|---|
| `ChangeDocItemSet.ValueOld` / `ValueNew` | **`Value_old` / `Value_new`** — underscored | Our guess was wrong. Any code written against the CamelCase form would have failed. This is exactly what the gate existed to catch |
| `ChangeDocItemSet` key = 5 fields incl. `Tabname`, `Fname` | Key is **3 fields only**: `Objectclas`, `Objectid`, `Changenr`. `Tabname` and `Fname` are **non-key** | **The OData key is not row-unique.** One change document touching several fields returns several rows sharing one key. Any dedup or upsert keyed on the entity key will collapse real rows — see §1.4 |
| `ReservationItemSet.Zzaisession` exists | **Absent.** Not designated | Placeholder survives. Candidates still `SGTXT`, `WEMPF`, `ABLAD` or a Z-append |
| `Objectclas`, `Tabname` filterable | **Confirmed** — FR-9 filters return real counts | FR-9 (did the recommendation get applied in SAP?) is feasible. Assumption retired |
| `ReservationItemSet` core fields (`Rsnum`, `Rspos`, `Bdter`, `Bdmng`, `Enmng`, `Banfn`, `Bnfpo`, `Bwart`, `Wempf`…) | **All confirmed**, correct names and types | I08/I13 reservation logic can now be written against real names |
| `MaterialValuationSet` all 9 fields | **All confirmed** exactly | I07 valuation logic is safe |
| `ChangeDocHeaderSet` all 7 fields | **All confirmed**. Note `Utime` is **`Edm.Time`** | A third date/time type to handle in the parser — not `Edm.DateTime` |

**Two properties we did not know about** appeared on `ReservationItemSet`:
`Umwrk` and `Umlgo` (receiving plant and storage location on a transfer).
These are directly useful to I13 redeployment — worth a look before building
that screen around anything else.

**One type regression on a live set.** `PurchaseOrderItemSet.Netpr` and
`.Netwr` changed from **`Edm.Decimal` → `Edm.String`**. Prices and net values
now arrive as strings. Nothing else on the 14 shared sets changed. This is a
silent-corruption risk if anything does arithmetic without parsing, and it is
the single best argument for the W2.5 contract tests.

### 1.3 The new blocker: registered but empty

`ReservationItemSet` and `MaterialValuationSet` respond correctly and return
**zero rows**. `MonthlyMovementStatisticSet` likewise.

This is worse for planning than the dead service was, because it *looks* fixed:

- **`ReservationItemSet` = 0.** Reservations are the backbone of I13 consumption
  plans and the anchor for the I08 repair session. With no rows, neither
  initiative can be validated against live data at all.
- **`MaterialValuationSet` = 0.** I07's stock value and value-of-avoided-purchase
  figures have no live source.
- **`MonthlyMovementStatisticSet` = 0.** Not used by the three initiatives; ignore.

**Raise this with the SAP team as a distinct question from registration.** The
likely causes are a dev client genuinely holding no reservation or valuation
data, an authorisation filter on the CPI user, or a projection returning nothing
without a mandatory filter. Ask which — they need different fixes, and only the
first is "wait for a fuller client".

Note the contrast: `ChangeDocHeaderSet` (241,685) and `BatchStockSet` (26,889)
return plenty on the same service, so the service and its auth are fine. The
emptiness is per-set.

### 1.4 Volume, newly visible

`ChangeDocItemSet` holds **929,151** rows and `ChangeDocHeaderSet` **241,685**.
At 1,000 rows per page that is 930 requests for a full extract of one set.

**Never bulk-extract these.** I07 reads change documents to answer a narrow
question — "was this recommendation applied in SAP?" — which is a filtered
lookup, not an extract. The FR-9 counts show the filters work and cut hard:
`Objectclas eq 'MATERIAL' and Tabname eq 'MARC'` reduces 929,151 to **7,220**.

Design the change-document reader as filter-first from the start. And note the
key problem from §1.2: with `Tabname`/`Fname` non-key, filter on them at SAP
and treat `(Objectclas, Objectid, Changenr, Tabname, Fname)` as the *composite
identity* in our own storage, regardless of what OData calls the key.

### 1.5 Generator state

`generate.py` was updated correctly alongside the sweep:

- `NOT_EXPOSED_SETS` and `NOT_EXPOSED_KEYS` are now **`{}`** — all four
  previously-mocked sets now take their definitions from discovery
  automatically, as designed.
- `PENDING_FIELDS` correctly retains the three fields SAP still does not
  expose: `MaterialSet.Extwg`, `MaterialSet.Sernp`, `ReservationItemSet.Zzaisession`.
- Generated CSVs picked up the corrections without hand-editing:
  `ChangeDocItemSet.csv` now has `Value_new,Value_old`; `ReservationItemSet.csv`
  gained `Umwrk,Umlgo`.
- Three new files appeared — `BatchStockSet.csv`,
  `MonthlyMovementStatisticSet.csv`, `StockMovementStatisticSet.csv` — with
  **correct headers and 0 rows**, because the generator has no fabrication logic
  for sets no initiative reads. That is correct behaviour, not a bug. Leave them.

**One stale comment to clean up.** The block above `NOT_EXPOSED_SETS` in
`generate.py` still reads *"service ZMM_KPI02_SRV, which was unreachable during
discovery (metadata came back empty)"*. That is no longer true and will mislead
the next reader. Reword to describe the mechanism, not the outage.

**Rule for this phase, revised:** property names on all 21 sets are now
measured, so build against them directly. The remaining assumptions are three
*fields* (`Extwg`, `Sernp`, `Zzaisession`) and four *business constants*
(`OAR_EXTWG`, `REPAIR_DOC_TYPE`, `REPAIR_ITEM_CATEGORY`, and the movement-type
set). Keep exactly those behind config.

---

## 2. W2.1 — CPI client library

> OAuth client-credentials token handling, `APIPath`/`APIQuery` construction,
> OData v2 envelope parsing, retry and error mapping.
> *Plan note: "already proven against the live endpoint from a workstation, so
> this is codification rather than discovery."*

### What it means
One reusable module that knows how to talk to SAP through CPI, so no feature
code ever builds a URL or handles a token itself. Every call goes through it.

The shape is proven twice over now — `cpi_discovery.py` has completed two live
sweeps. W2.1 is turning that working Python into a proper TypeScript library.

### What we do now
Build it **completely**. This needs no Azure — it is pure code.

- **Token handling.** Client-credentials POST to `CPI_TOKEN_URL`, cache the
  token in memory, refresh on expiry *and* re-fetch once on a `401`.
  `cpi_discovery.py` already does the retry-once-on-401 dance — copy it.
- **Request construction.** All calls go to `{CPI_BASE_URL}/http/SAPECC/OdataConsumption`
  with two query params: `APIPath` (e.g. `sap/opu/odata/sap/ZVZI_KPI02_SHARED_SRV/MaterialSet`)
  and `APIQuery` (e.g. `$filter=...&$top=1000`). This double-envelope is easy
  to get wrong — hide it entirely inside the client.
- **Response parsing.** OData **v2**, not v4. Payloads are wrapped as
  `{ "d": { "results": [...] } }`. Three scalar types need explicit handling,
  now confirmed from live metadata:
  - `Edm.DateTime` → `/Date(1757280000000)/`
  - **`Edm.Time`** → ISO-8601 duration form (`PT14H16M00S`). `ChangeDocHeaderSet.Utime`
    is the one that uses it. Do not feed it to a date parser.
  - `Edm.Decimal` → arrives as a **string** (`"1234.56"`).
  Parse from the **generated contract**, not from guesswork — which also means
  `PurchaseOrderItemSet.Netpr`/`.Netwr`, now declared `Edm.String`, get flagged
  rather than silently coerced. See §1.2.
- **Retry and error mapping.** Exponential backoff on `5xx`, one retry on
  `401`, no retry on `4xx`. Map to typed errors: `AuthError`,
  `TransientError`, `NotFoundError`, `ContractError`.
- **Config, not constants.** Service names, the CPI path and credentials all
  come from environment variables. Nothing hard-coded.
- **Distinguish empty from broken.** Given §1.3, a zero-row response must be a
  distinct, reportable outcome — never conflated with a failed call or an
  unfiltered default. Three live sets return zero today; the client must make
  that visible rather than returning a bland empty array.

### What we cannot do
Prove it against the real endpoint *from inside Azure*. Retry timing under real
CPI latency and TLS behaviour from within the VNet are W2.2. Note the client
itself **can** now be smoke-tested against live CPI from a workstation — worth
doing once the parser is written.

### Mock or placeholder
Point the client's base URL at a **local fake CPI server** that speaks the same
double-envelope protocol and returns OData v2 payloads built from
`data-generator/generated/sap/*.csv`. That is W2.6, and it is what makes W2.1
testable in CI. One environment variable chooses fake or real.

### How we test it
- Token cache reused within expiry; refreshed after; re-fetched once on `401`.
- `APIPath`/`APIQuery` encoding for filters containing spaces and quotes.
- `/Date(...)/` → date; `PT14H16M00S` → time; `"1234.56"` → number; `null` → null.
- A field declared `Edm.String` that holds a numeric value is **not** silently
  turned into a number (the `Netpr` case).
- Backoff fires on `500`, does **not** fire on `404`.
- Zero rows → explicit empty result, distinguishable from an error.

### Done when
Every `generated/sap/*.csv` set reads end-to-end through the client from the
fake gateway, with zero SAP-specific code outside the library.

---

## 3. W2.2 — Connectivity smoke test from VZI

> Auth, TLS, paging against the CPI endpoint from inside the VZI environment.
> *Depends on W1.2 (environment provisioned) and W2.1.*

### What it means
The first real proof that our code, running **inside Azure**, can reach CPI —
not just from a laptop. It catches firewall rules, private endpoints, TLS
inspection and IP allow-listing.

### What we do now
Only the *inside-Azure* half is blocked. Write the test now so that on Azure day
it is a five-minute answer instead of a half-day investigation.

The smoke test should:
1. Fetch a token and print its expiry — **never the token itself.**
2. Fetch `$metadata` for both services; print HTTP status and byte count.
   Expect ~37,800 and ~19,100 bytes — a large deviation is itself a signal.
3. Read one page of `MaterialSet` (`$top=10`); print row count.
4. Read two pages to prove paging works.
5. Print the resolved endpoint hostname and TLS certificate issuer.
6. **Assert the known-conditions set** from §1 — 2 `$count` failures, 3 zero-row
   sets, `Extwg` absent. Report each as *still true* or *changed*.
7. Exit non-zero on any failure, with the failing step named.

Step 6 turns the smoke test into a live re-verification, so W2.7 becomes a
command anyone can run rather than a scheduled event.

### What we cannot do
Anything about the network itself: private endpoints, DNS resolution inside the
VNet, CPI-side IP allow-listing. **Add one item to the W1.1 access checklist
now:** confirm with VZI IT whether CPI restricts inbound by IP, and if so get
the Azure egress IP or NAT gateway address allow-listed *before* W2.2 runs.
That single question, asked late, costs a day.

### Mock or placeholder
The fake gateway stands in for CPI in CI. Steps 5 and 6 report localhost values
locally — expected, and the test should say so rather than fail.

### How we test it
The test *is* the test. Verify it passes against the fake gateway and against
live CPI from the workstation, and that it fails loudly and specifically when
pointed at a wrong URL or given a bad secret.

### Done when
`npm run smoke:cpi` passes against both the fake gateway and live CPI from a
workstation, and is documented as the first command to run on Azure.

---

## 4. W2.3 — Pagination with a fallback

> Page-until-short-page where `$count` is unavailable
> (~~`PurchaseRequisitionSet`, `GoodsMovementItemSet`, `PurchaseOrderItemSet`~~
> — **now two sets**, see below).

### What it means
Normally you ask SAP "how many rows?" then loop until you have them all. On
**two** sets that question still returns HTTP 500, so the extractor needs a
second strategy: keep asking for pages until a page comes back smaller than the
page size, then stop.

**Updated from the sweep.** `PurchaseOrderItemSet.$count` is **fixed** (11,074).
Still broken: `PurchaseRequisitionSet` and `GoodsMovementItemSet`. Both remain
business-critical — requisitions drive I07's PR-to-PO view, goods movements
drive consumption everywhere — so the fallback is still a main path, not an edge
case.

### What we do now
Build both modes fully.

- **Counted mode:** `GET .../$count` → loop `$skip`/`$top` until total reached.
- **Fallback mode:** loop `$skip`/`$top` until a page returns fewer than
  `$top` rows. Never trust an empty first page as "no data" without one retry —
  and given §1.3, log a zero-row result as a distinct, reportable outcome.
- **Per-set configuration**, not a hard-coded list. Each set is marked
  `countMode: "counted" | "fallback" | "auto"`. `"auto"` tries `$count` once and
  demotes itself to fallback on `5xx`, logging the demotion. The
  `PurchaseOrderItemSet` fix is proof this pays for itself: with `"auto"` that
  set self-promoted with **no code change at all**.
- **Filter-first for the change-document sets.** §1.4 — 929,151 and 241,685
  rows. Mark these `extract: "filtered-only"` in config and make an unfiltered
  full extract *impossible*, not merely discouraged.
- **A safety ceiling.** Max pages and max rows per extraction. With a 929k-row
  set now reachable, this is no longer theoretical.
- **Stable ordering.** `$skip`/`$top` paging without `$orderby` on the entity
  key can silently skip or duplicate rows. Add `$orderby` for every paged read.
  **Caveat from §1.2:** on `ChangeDocItemSet` the declared key is not row-unique,
  so ordering by key alone is not deterministic — order by
  `Objectclas,Objectid,Changenr,Tabname,Fname` there.

### What we cannot do
Confirm real page-size limits, CPI timeout behaviour on large pages, or whether
`$skip` beyond a certain depth degrades. Make page size configurable per set and
start conservative (1,000). The 929k-row set is where deep-`$skip` degradation
would first show — test it against live CPI from the workstation before Azure.

### Mock or placeholder
The fake gateway must reproduce the *current* state deliberately: serve `$count`
for the 12 working sets and **return HTTP 500 for `$count` on exactly
`PurchaseRequisitionSet` and `GoodsMovementItemSet`**, so the fallback path is
exercised by default and not only in a unit test.

### How we test it
- Counted mode over a set whose size is known from the CSV row count.
- Fallback mode over the two broken sets — total rows must equal CSV rows.
- Row count exact when total is an exact multiple of page size (the classic
  off-by-one: does it make one extra empty call and stop cleanly?).
- No duplicate and no missing keys across page boundaries — including on
  `ChangeDocItemSet` with its non-unique key.
- An unfiltered read of a `filtered-only` set is **refused**.
- Safety ceiling trips and reports rather than hanging.

### Done when
All 21 sets extract to the correct row count through the fake gateway, two via
fallback, with zero key duplication and the change-document sets filter-gated.

---

## 5. W2.4 — Material-scope filter as configuration

> OAR selection expressed as a config-driven predicate on the external material
> group, not hard-coded.
> **CRITICAL SEQUENCING ITEM** — built before EXTWG is exposed so the fix is a
> configuration change rather than rework across I07 and I13.

**This section is unchanged by the sweep, and that is the point.** `MARA.EXTWG`
is still absent and `OAR_EXTWG = "100"` is still unconfirmed. Everything below
stands. Meanwhile the `PurchaseOrderItemSet` `$count` fix and the four
newly-confirmed ZMM sets demonstrate the same principle working in the small:
config-driven behaviour absorbed a SAP-side change with no code edit.

### What it means
"Which materials are in scope?" is asked in dozens of places across I07 and
I13. The answer depends on `MARA.EXTWG`, which **is still not exposed**, and on
a candidate value of `100` that **VZI has still not confirmed** (see
`generate.py:111`, `OAR_EXTWG = "100"`).

If that question is answered inline — `if (material.extwg === "100")` — then
when SAP exposes the field and confirms the real value, we edit dozens of
files. If it is answered by one configured predicate, we edit one line.

This is still the highest-leverage task in WS2 and it still has **no
dependencies.** Do it first.

### What we do now
Build it completely — it is pure configuration design.

- **One scope module** exposing something like `isInScope(material, scope)`.
  Nothing outside it may reference `Extwg` or the literal `"100"`.
- **Config-driven, declarative.** A scope is data, not code:
  `{ field: "Extwg", op: "in", values: ["100"] }`. Support `in`, `notIn`,
  `startsWith` and `and`/`or` — VZI may well answer "it's a range" or
  "it's these four groups".
- **Named scopes**, because the three initiatives do not share one definition:
  `oar` (I13 whole scope, I07 OAR flag), `repairable` (I08 — 80-series
  materials, a different rule entirely), and `all`.
- **Pushdown where possible.** The same config should generate an OData
  `$filter` for server-side filtering *and* an in-memory predicate for
  post-filtering. When EXTWG is exposed we filter at SAP and move far less data.
  The same pushdown machinery is what §1.4's change-document filters need — build
  it once, use it for both.
- **An explicit unavailable state.** `Extwg` still does not exist on live
  `MaterialSet`. The module must distinguish "not in scope" from
  **"cannot determine scope — field unavailable"**, and the app must show that
  honestly rather than rendering an empty list that looks like real zero.
  §1.3 makes this urgent rather than theoretical: three live sets return zero
  rows *right now*, so "empty" and "unavailable" will both occur in the same
  screens and must not look alike.
- **A documented fallback rule** for the interim. `generate.py:726` notes OAR
  materials share the same MRP type as the general population, so MRP type
  cannot substitute. Record explicitly that there is *no* usable proxy, and that
  interim behaviour is "unavailable", not "guess".

### What we cannot do
Confirm the field name is `Extwg` on the projection, or that `100` is the right
value, or whether OAR is one value or several. All three are still open VZI
questions — the one substantive item the sweep did **not** resolve.

### Mock or placeholder
`generated/sap/MaterialSet.csv` **still carries the `Extwg` column** (header:
`Matnr,Lvorm,Mtart,Matkl,Bismt,Meins,Mstae,Extwg,Sernp`), appended by
`generate.py` under `PENDING_FIELDS` precisely for this. The full scope path is
testable today against synthetic data. Keep `100` in config, clearly marked
unconfirmed.

### How we test it
- Config with one value, several values, and a `startsWith` rule.
- Generated `$filter` string is correct OData v2 and URL-encodes properly.
- In-memory predicate and pushdown filter select the **same** material set —
  this equivalence test is what makes the eventual switch to server-side
  filtering safe.
- Field absent → `unavailable`, not `false`.
- `grep` test in CI: the literal `"100"` and the token `Extwg` appear **only**
  in the config file and the scope module. This test is what actually enforces
  the whole point of W2.4.

### Done when
Changing one config value re-scopes I07 and I13 end to end, and the grep test
proves no leakage.

---

## 6. W2.5 — Contract tests from live `$metadata`

> Set names, entity keys, property names and types, pagination and `$count`
> behaviour. Wired into CI; records the known `$count` failures as expected
> conditions.

### What it means
A test suite that reads the saved `$metadata` and asserts "the fields our code
expects are the fields SAP actually has." When SAP changes something, a test
fails with a clear message instead of a feature breaking in UAT.

**The sweep just proved the case for this task.** Between two runs four hours
apart, SAP changed `Netpr` and `Netwr` from `Edm.Decimal` to `Edm.String` on a
live set. Nothing announced it; it surfaced only from a `git diff` of
`properties.csv`. Had contract tests existed, that would have been a red build
with a precise message. It is the cheapest possible catch and we very nearly
missed it.

### What we do now
Build it fully from the saved metadata — no live access needed.

- **Generate a typed contract** from `discovery/properties.csv` and
  `entity_sets.csv`: per set, its properties, types, nullability and keys. All
  **21 sets and 229 properties** are now real, so the whole contract is measured
  — no `source: "assumed"` tagging is needed any more. Check the generated file
  into git; it is the baseline to diff against.
- **Assert what our code needs.** Per initiative, declare required fields and
  test each exists with a compatible type. This is what catches the `Value_old`
  vs `ValueOld` class of error — which was a *real* wrong assumption we held
  until 14:16 today.
- **Known-conditions file, rewritten against measured state.** Each entry
  asserts the condition still holds and **fails loudly when it changes, in
  either direction**:

  | Condition | State as of 08-Sep 14:16 |
  |---|---|
  | `$count` HTTP 500 on `PurchaseRequisitionSet`, `GoodsMovementItemSet` | expected-broken |
  | `$count` on `PurchaseOrderItemSet` | **expected-working** (11,074) — was broken, guard the regression |
  | `ReservationItemSet` count | expected **0** — flip to a hard failure once SAP answers §1.3 |
  | `MaterialValuationSet` count | expected **0** — same |
  | `MonthlyMovementStatisticSet` count | expected **0**, unused |
  | `Extwg` on `MaterialSet` | expected **absent** |
  | `Sernp` on `MaterialSet` | expected **absent** |
  | `Zzaisession` on `ReservationItemSet` | expected **absent** |
  | `ChangeDocItemSet` key | expected **3 fields**, `Tabname`/`Fname` non-key |
  | `PurchaseOrderItemSet.Netpr` / `.Netwr` | expected **`Edm.String`** — assert deliberately, so a revert to `Decimal` is also caught |
  | `ChangeDocHeaderSet.Utime` | expected **`Edm.Time`** |
  | `ChangeDocItemSet` / `ChangeDocHeaderSet` volume | expected > 100,000 — filter-only sets |

  *Retired conditions* (no longer applicable): `ZMM_KPI02_SRV` unreachable;
  `Bnfpo` not a key — it is a plain non-key property on `ReservationItemSet`,
  which matches the dictionary note; the `NOT_EXPOSED_SETS` assumed-property set.
- **Type-mapping tests.** `Edm.DateTime` → date, `Edm.Time` → time-of-day,
  `Edm.Decimal` → number-from-string, `Edm.String` with leading zeros stays a
  string (SAP material numbers are zero-padded — parsing `000000000012345` as a
  number is a classic data-loss bug).
- **A metadata-drift test.** Diff the live `$metadata` against the checked-in
  contract and fail on any unannounced change. This is the `Netpr` catch,
  automated. Run it in the W2.2 smoke test too.
- **CI wiring.** There is **still no test runner and no `.github/` in this
  repo.** Add Vitest and a GitHub Actions workflow as part of this task; without
  it, "wired into CI" cannot be satisfied.

### What we cannot do
Nothing significant any more. The suite runs against a snapshot of *real*
metadata for all 21 sets, and the drift test covers the live comparison.

### Mock or placeholder
None needed for the contract itself — that is the sweep's biggest gift to this
task. The three still-unexposed *fields* (`Extwg`, `Sernp`, `Zzaisession`) are
declared as pending and asserted absent.

### How we test it
Meta-test the suite: feed it a deliberately altered metadata XML — renamed
property, changed key, changed type — and confirm each mutation produces a
failure naming the set, the property and the nature of the change. Use the real
`Netpr` `Decimal`→`String` change as the first fixture; we know the answer.

### Done when
`npm test` runs green in CI against the snapshot, every row of the
known-conditions table is asserted, and a mutated metadata file produces clear,
specific failures.

---

## 7. W2.6 — Reduced mock gateway

> For the eight items not yet available: the seven `ZMM_KPI02_SRV` sets plus a
> stubbed external material group field.
> *Scope cut sharply from the original synthetic-data plan: 14 of 21 sets are
> live, so only the gap is mocked.*

### What it means
A local server that pretends to be CPI, so the whole app runs with no SAP at all.

**The sweep shrank this task's mocking scope to almost nothing.** The plan's
"eight items" were 7 ZMM sets + EXTWG. All 7 sets are now real, so the true gap
is **three fields**: `Extwg`, `Sernp`, `Zzaisession`. What remains is a *volume*
gap rather than a *schema* gap — three live sets return zero rows (§1.3), so
synthetic data is still how I07, I08 and I13 get exercised end to end.

So the gateway is still needed, and still serves all 21 sets — but as a
**test-and-development fixture**, no longer as a stand-in for missing schema.

### The problem this task must actually solve

This remains the most important finding in this document, and the sweep did not
touch it.

The data generator produces **14 MB of SAP-shaped CSVs across 28 files** (21 SAP
+ 7 platform). The app is fed by **hand-written TypeScript fixtures** in
`src/lib/mock-data.ts` (1,161 lines) and `src/features/*/data/*.ts`.

**Nothing in `src/` reads a single generated CSV.** The two datasets have never
met. SAP-shaped data no code consumes; UI-shaped data SAP will never produce. On
Azure day that gap surfaces all at once.

**Closing it is the real deliverable of W2.6.** Everything else in WS2 is
insurance; this is the integration itself. It is now also the *largest*
remaining task, since the mocking half just got much smaller.

### What we do now
1. **Fake CPI server.** Reads `generated/sap/*.csv`, serves the CPI
   double-envelope contract (`APIPath` + `APIQuery`), returns OData v2 JSON with
   `/Date(...)/` timestamps, `Edm.Time` durations and numeric-strings —
   *deliberately reproducing SAP's awkward formats,* because a mock that returns
   clean JSON tests nothing. Type each field from the generated contract, so
   `Netpr` comes back as a string exactly as live CPI now does.
2. **Support the query surface we actually use:** `$top`, `$skip`, `$filter`
   (eq, and, or), `$orderby`, `$select`, `$count`. `$filter` on `Objectclas` and
   `Tabname` is now a first-class requirement, not a nice-to-have — §1.4.
3. **Reproduce the current known state on purpose.** `$count` → HTTP 500 on the
   two broken sets, working on the rest. And a mode that makes
   `ReservationItemSet` and `MaterialValuationSet` return **zero rows**, so we
   can prove the app degrades honestly against the live condition that exists
   today. Being able to simulate §1.3 is what stops it becoming an Azure-day
   surprise.
4. **Per-set routing.** Config decides, per entity set, `mock` or `live`. All 21
   sets can now go `live` for schema purposes, while the three zero-row sets stay
   `mock` for data. **This is the single most valuable artefact in WS2** — it
   turns go-live from a cutover into a per-set dial, and it is what makes the
   §1.3 blocker survivable rather than blocking.
5. **Build the mapping layer.** Transform SAP-shaped rows into the view models
   the UI already uses — an explicit mapper per initiative — then **replace the
   hand-written fixtures with mapper output.** Where a fixture holds data no SAP
   field can produce, that is a finding: log it as a gap, do not invent a source.
   Write the mappers against the **real** property names now available for all
   21 sets; there is no longer any excuse for guessing.
6. **Mark synthetic data visibly.** Every response from a mocked set carries a
   flag, and the UI shows a persistent "synthetic data" banner. With schema now
   real but reservation data empty, the risk of demoing synthetic numbers as real
   has gone *up*, not down.

### What we cannot do
Validate the mapping for fields we have never seen populated — which, thanks to
§1.3, still includes **every reservation and valuation field**. Their names and
types are confirmed; their real values, distributions and edge cases are not.
And the calibration gap stands: ~2,034 dev materials against **>45,000 in
production**, so synthetic volumes prove function, not performance.

### Mock or placeholder
Placeholders remaining, now a short list:
- **`MaterialSet.Extwg`** — not exposed. Behind the W2.4 scope config.
- **`MaterialSet.Sernp`** — not exposed. Only needed for a future serial-grain
  repair register; no current initiative blocks on it.
- **`ReservationItemSet.Zzaisession`** — the AI-session field is **still not
  designated** (candidates `SGTXT`, `WEMPF`, `ABLAD`, or a Z-append). Keep it
  behind a single config key naming the field, so it is a one-line change.
  Confirmed absent by the sweep, so this is now a known-open item rather than a
  guess.
- **`REPAIR_DOC_TYPE = "ZREP"` and `REPAIR_ITEM_CATEGORY = "3"`** — I08 decision
  D7, **still pending SAP confirmation**. Move both to config alongside the
  scope rules.
- **W2.9 lead-time source** — `MARC.PLIFZ` is live on `MaterialPlantSet`. Put
  lead time behind a provider interface with one implementation reading `Plifz`;
  if the I11 Z-program writes to a Z-table instead, only the provider changes.

### How we test it
- Every set, all rows, correct types, through the real client (W2.1).
- The two `$count` 500s trigger fallback paging (W2.3).
- Zero-row mode on reservations and valuation → app renders honest
  "no data" states, distinct from "unavailable", with no crash and no silent zeros.
- Per-set routing: with all sets on `mock` the app is fully functional; flipping
  one set to `live` against an unreachable URL fails **only that set**.
- Mapper round-trip: SAP-shaped row → view model → the fields the UI renders.
- A filtered `ChangeDocItemSet` read returns the expected subset; an unfiltered
  one is refused.

### Done when
The app runs entirely off the fake gateway with the hand-written fixtures
deleted, and one config file switches any set between mock and live.

---

## 8. W2.7 — Re-verify after the SAP fixes — **RUN 08-Sep 14:16**

> **GATE.** Re-run the discovery sweep, confirm EXTWG is exposed and
> `ZMM_KPI02_SRV` responds, capture the real property names on `ChangeDocItem`
> and `ReservationItem`.

### Result: passed on two of three objectives

| Objective | Result |
|---|---|
| `ZMM_KPI02_SRV` responds | ✅ **Yes.** 19,129 bytes, 7 sets, 75 properties |
| Real property names on `ChangeDocItem` and `ReservationItem` | ✅ **Captured.** One assumption corrected (`Value_old`/`Value_new`), one key structure corrected, two new fields found (`Umwrk`, `Umlgo`) |
| `EXTWG` exposed | ❌ **No.** `MaterialSet` unchanged at 7 properties |

**Bonus findings the sweep was not looking for:** `PurchaseOrderItemSet.$count`
fixed; FR-9 proven feasible; `Netpr`/`Netwr` type regression; change-document
volumes; and the three zero-row sets — the last of which is now the top blocker.
Full detail in §1.

### What this unblocks, immediately
- **Write against real names.** All 229 properties on all 21 sets are measured.
  No mapper needs to guess.
- **FR-9 is buildable.** `Objectclas` and `Tabname` filter correctly and cut
  929,151 rows to 7,220. I07 can verify whether a recommendation was applied.
- **`NOT_EXPOSED_SETS` is empty.** The generator's schema is fully
  discovery-driven, exactly as designed.
- **W2.5 has a real contract for every set** — no assumed-source tagging.

### What is still open
1. **EXTWG exposure and the confirmed OAR value** — chase VZI. Blocks the I13
   material scope and the I07 OAR flag. W2.4 keeps it to a config change.
2. **Zero rows on `ReservationItemSet` and `MaterialValuationSet`** (§1.3) —
   **raise this now, as a separate question from registration.** It is the
   largest remaining unknown in WS2.
3. **`Zzaisession` designation** — SAP/NTT decision, tied to W2.8.
4. **`ZREP` / item-category 3** — I08 decision D7 confirmation.
5. **The entity dictionary xlsx** — still absent, so `dictionary_gaps.csv` still
   cannot be produced (§9.4).

### Follow-up actions
- Ask the SAP team **why** the three sets are empty: no dev data, an auth filter,
  or a projection needing a mandatory filter? Different fixes.
- Ask whether the `Netpr`/`Netwr` type change to `Edm.String` was intentional,
  and whether more are planned. Then assert it in W2.5 either way.
- Confirm the `ChangeDocItemSet` key is intentionally 3 fields, and that
  `(Objectclas, Objectid, Changenr, Tabname, Fname)` is the right composite
  identity for our own storage.
- Reword the stale `NOT_EXPOSED_SETS` comment in `generate.py` (§1.5).
- Commit the discovery outputs, the regenerated CSVs and `generate.py` as one
  commit, so the schema baseline is traceable to this sweep.

### Next re-verification
There is no longer a single scheduled gate. Fold the checks into the W2.2 smoke
test (step 6) so the known-conditions set is verified on demand, and re-run the
full sweep when SAP announces a fix — specifically on EXTWG exposure or a
reservation-data answer.

---

## 9. Runbook: re-running `cpi_discovery.py`

The 08-Sep 14:16 run went through cleanly, so this is now a repeat-run
procedure. §9.1's blockers are resolved; the rest still applies.

### 9.1 Prerequisites — resolved, keep them that way

Both first-run blockers are cleared: `requests` and `openpyxl` are installed,
and the `.env` path is resolved. Two small items are still worth doing so the
next person does not rediscover them:

```powershell
cd c:\Users\varad\OneDrive\Desktop\spares-ai\data-generator
pip freeze | Out-File -Encoding utf8 requirements.txt
```

- **Pin the dependencies** (above) — `requirements.txt` still does not exist.
- **Create `.env.example`** — key names only, no values. The README references
  it and it still does not exist. Required keys: `CPI_CLIENT_ID`,
  `CPI_CLIENT_SECRET`, `CPI_TOKEN_URL`, `CPI_BASE_URL`.

Note the script defaults to `.env` *next to itself* (`data-generator/.env`)
while the real file is at the **repo root**. Whichever way it was resolved this
run, `--env-file ..\.env` is the form that always works:

```powershell
python cpi_discovery.py --env-file ..\.env --out .\discovery
```

**Never print or commit the secret.** `.gitignore:34` covers `.env*`.

### 9.2 Before the next run — archive, do not delete

**Do not delete `discovery/`.** `generate.py` reads
`discovery/properties.csv` as its schema source, and the value of a re-run is
the **diff** — which is exactly how the `Netpr` type change was caught.

```powershell
cd c:\Users\varad\OneDrive\Desktop\spares-ai\data-generator
$stamp = Get-Date -Format "yyyyMMdd-HHmm"
Copy-Item -Recurse .\discovery ".\discovery-baseline-$stamp"
Write-Host "baseline saved to discovery-baseline-$stamp"
```

**Better still: commit the current `discovery/` first.** With the outputs in git,
`git diff` alone answers "what changed" and no archive copy is needed. That is
the recommended workflow from here — this sweep's results are uncommitted right
now, and committing them is the cheapest way to make the next diff trivial.

The script uses `mkdir(exist_ok=True)` and overwrites each output, so no cleanup
is needed. One caveat: **stale files are not removed.** If a set disappears from
`$metadata`, its rows vanish from the CSVs — the diff catches it, a glance at
the folder does not.

### 9.3 The run

Dry-run first, without the `$count` sweep — proves auth, TLS and both
`$metadata` calls in seconds:

```powershell
python cpi_discovery.py --env-file ..\.env --out .\discovery --skip-counts
```

Expected output as of this sweep:

- `token OK`
- `[ZVZI_KPI02_SHARED_SRV] 14 entity sets in $metadata; expected 14`
- `[ZMM_KPI02_SRV] 7 entity sets in $metadata; expected 7`
- **No** `MISSING vs technical list` or `EXTRA in $metadata` lines

Any deviation from that is the finding. Then the full run with counts:

```powershell
python cpi_discovery.py --env-file ..\.env --out .\discovery | Tee-Object -FilePath ".\discovery\run-$stamp.log"
```

Keep the log — it is the only record of *when* a sweep ran and what `$count`
returned. **The 14:16 run was not logged;** start doing this from the next one.

### 9.4 The dictionary gap report — still unavailable

`--dictionary` needs `VZI_Entity_Dictionary_I07_I08_I13_v1_*.xlsx`, which is
**still not in this repo** — `docs/` holds only `VZI_AI_Dev_Plan_v2.4.xlsx`.
Get it from the SAP/BA team, then:

```powershell
python cpi_discovery.py --env-file ..\.env --out .\discovery --dictionary ..\docs\VZI_Entity_Dictionary_I07_I08_I13_v1_2.xlsx
```

`dictionary_gaps.csv` is the field-by-field FRS-vs-SAP comparison. It matters
more now, not less: with all 229 properties measured, it would tell us in one
pass which FRS fields have no SAP home — a question we currently answer by hand.

### 9.5 Reading the results

```powershell
cd c:\Users\varad\OneDrive\Desktop\spares-ai\data-generator

# 1. Both services present, with set counts
Import-Csv .\discovery\entity_sets.csv | Group-Object service | Select-Object Count, Name

# 2. Is EXTWG exposed yet?  (expect 7 rows, no Extwg)
Import-Csv .\discovery\properties.csv | Where-Object { $_.entity_set -eq "MaterialSet" } | Select-Object property, type

# 3. $count failures  (expect PurchaseRequisitionSet, GoodsMovementItemSet)
Import-Csv .\discovery\counts.csv | Where-Object { $_.count -like "HTTP*" }

# 4. Zero-row sets  (expect ReservationItemSet, MaterialValuationSet, MonthlyMovementStatisticSet)
Import-Csv .\discovery\counts.csv | Where-Object { $_.count -eq "0" }

# 5. ZMM property names and keys
Import-Csv .\discovery\properties.csv | Where-Object { $_.service -eq "ZMM_KPI02_SRV" } | Format-Table entity_set, property, type, is_key

# 6. FR-9 feasibility  (expect real counts, not HTTP 500)
Get-Content .\discovery\fr9_check.txt

# 7. What changed - the single most valuable command here
git diff data-generator/discovery/
```

Query 7 is what caught the `Netpr` type change. Run it every time.

### 9.6 Improve the script — still worth doing

Three small changes, all still outstanding:

1. **Write metadata only on success, and always record the failure.** The
   response body is written before the status is checked — which is how a
   0-byte file ended up on disk this morning with no error recorded anywhere.
   Write a `run_summary.json` with timestamp, per-service HTTP status, set counts
   and the missing/extra lists. Then "what happened at 12:08?" has an answer
   other than a file size.
2. **Distinguish zero from failed in `counts.csv`.** Right now `0` and a real
   count look alike, and a dead service is *absent* rather than reported dead.
   Given §1.3 is now our top blocker, this column needs three states: a count,
   `EMPTY`, or an error.
3. **Add a `--baseline <dir>` diff mode** printing added, removed and changed
   properties per set. `git diff` covers this once `discovery/` is committed, so
   this is the lower-priority of the three.

### 9.7 After a sweep

```powershell
# Regenerate synthetic data from the new schema
cd c:\Users\varad\OneDrive\Desktop\spares-ai\data-generator
python generate.py

# Confirm row counts and column changes
Get-ChildItem .\generated\sap\*.csv | ForEach-Object { "{0,-34} {1}" -f $_.Name, ((Get-Content $_.FullName | Measure-Object -Line).Lines - 1) }

# Re-run contract tests - known-condition failures are GOOD NEWS
npm test
```

Then **check `PENDING_FIELDS` and `NOT_EXPOSED_SETS`.** `generate.py` warns when
a `PENDING_FIELDS` entry is no longer pending, or when a `NOT_EXPOSED_SETS`
entry is now discovered — read those warnings, they are the handover from SAP's
fix to our config. This sweep's handover was done correctly:
`NOT_EXPOSED_SETS` went to `{}` and three fields remain pending.

Commit the discovery outputs, the regenerated CSVs, `generate.py` and the run
log as **one commit**, so the schema baseline is traceable. `docs/` is gitignored
(`.gitignore:44`) but `data-generator/` and `docs-eng/` are not.

---

## 10. Things not in the plan that I would add

1. **Wire the app to the generated CSVs.** Covered in W2.6, restated because it
   is the largest real risk and the sweep did not touch it: 14 MB of SAP-shaped
   data and 1,161 lines of hand-written fixtures that have never met. Everything
   else in WS2 is preparation; this is the integration.
2. **Chase the zero-row answer** (§1.3). Now the top open question. Registration
   without data is not a fixed dependency, and it is easy to mistake for one.
3. **Add a test runner and CI.** Still no Vitest/Jest and no `.github/`. The
   `Netpr` type change is the concrete argument: a silent contract change slipped
   through in four hours and only a manual diff caught it.
4. **Commit `discovery/` on every sweep.** Makes `git diff` the drift detector
   and removes the need for archive copies.
5. **Ask about CPI inbound IP restrictions now** (see W2.2). A late answer costs
   a day of Azure time.
6. **Chase the entity dictionary xlsx** (§9.4). Worth more now that all 229
   properties are known.
7. **Put every unconfirmed business constant in one config file.** `OAR_EXTWG`,
   `REPAIR_DOC_TYPE`, `REPAIR_ITEM_CATEGORY`, `SCRAPPING`, `OVERDUE_GRACE_DAYS`,
   `PLAN_GRACE_DAYS` and the movement types are constants in `generate.py` and
   will be re-declared in the app. One shared `sap-contract.config.ts` with a
   `confirmed: true|false` flag per value makes the assumption surface visible in
   one screen — and reviewable by VZI.
8. **Zero-padding discipline.** SAP material numbers are zero-padded strings
   (`000000000012345`). Decide once whether the app stores padded or unpadded,
   normalise at the client boundary, and test it. Getting this wrong late causes
   joins that silently match nothing. Note `Matnr` is `Edm.String` on every set
   that carries it — confirmed across all 21.
9. **Treat calibration as a known limitation, not a task.** ~2,034 dev materials
   vs >45,000 production. Synthetic volumes prove correctness, never performance.
   Add one load test against 45,000 synthetic materials so the first encounter
   with production scale is not in UAT. The 929k-row `ChangeDocItemSet` is a
   second, already-real scale case.
10. **Reset the dates.** The plan runs 08-Sep to 25-Sep 2026 with W2.7 gated on
    11-Sep. W2.7 in fact ran on **08-Sep**, three days early — so re-baseline
    against the actual Azure date rather than carrying dead dates either way.
11. **Keep a per-set readiness table in the repo** — set, live/mock, `$count`
    mode, row count, pending fields, blocking dependency. One page answering
    "what works today?" without reading code. With 21 sets in three distinct
    states (working / count-broken / empty) this is now genuinely needed, and it
    becomes the go-live checklist.

---

## 11. Order of work

Sequenced by dependency and by how much risk each item removes.

| # | Task | Why here | Needs Azure? |
|---|---|---|---|
| — | ~~**W2.7** discovery sweep~~ | ✅ **Done 08-Sep 14:16.** Gate passed; see §8 | — |
| 1 | **W2.4** scope config | No dependencies. EXTWG is still the one unresolved dependency, so this is still the highest-leverage task | No |
| 2 | Test runner + CI | Everything after this is testable. The `Netpr` change is the argument | No |
| 3 | **W2.5** contract tests | **Moved up.** All 21 sets are now real, so this is fully buildable — and it locks the schema before mappers are written against it | No |
| 4 | **W2.1** CPI client | Foundation for W2.2, W2.3, W2.6. Parses from the W2.5 contract | No |
| 5 | **W2.6a** fake gateway | Makes W2.1 and W2.3 verifiable; simulates the §1.3 zero-row state | No |
| 6 | **W2.3** paging | Needs client + gateway to test both modes and the filter-only gate | No |
| 7 | **W2.6b** mapping layer, fixtures replaced | The actual integration. Now the largest remaining task | No |
| 8 | **W2.2** smoke test | Write it, pass it against the gateway **and against live CPI from the workstation** | No |
| 9 | Per-set flip to live | Config dial, set by set | **Yes** |

**Why W2.5 moved ahead of W2.1.** Before the sweep, seven sets had no real
metadata, so a contract built then would have been part guesswork. Now all 229
properties are measured — so generating the contract first means the client and
every mapper parse from measured truth rather than from a developer's reading of
a CSV.

Items 1–8 need no Azure. Only the per-set flip to live does, and by then it is a
config change plus a smoke test.

---

## 12. Out of scope for this phase

The WS2 tasks beyond W2.7, and why they are not detailed here:

- **W2.8** Reservation-entry BAdI launch contract — a design/contract note with
  the SAP team and NTT; no ABAP stream exists today. The assistant is designed to
  run on demand without it. **Now partly urgent:** the sweep confirmed
  `Zzaisession` is absent, so the session-field designation is a live open item
  rather than a future one.
- **W2.9** I11 lead-time source — `MARC.PLIFZ` is live on `MaterialPlantSet`, so
  if the Z-program updates it in place there is no work. If it writes to a
  Z-table, that table must be exposed. Handle behind the provider interface in
  W2.6.
- **W2.10** PR event listener — off the critical path, blocked on a Stream 2
  payload schema that has not been shared.
