# WS2 Phase Summary (plain-English log)

This file tracks what got done in each phase of `docs-eng/WS2_INTEGRATION_PLAN.md`'s
[order of work](WS2_INTEGRATION_PLAN.md#11-order-of-work), in plain language — no
SAP jargon required to follow along. Each phase = one commit named `phase-N: ...`.

---

## Phase 0 — The three `Dismm` counts (2026-09-08)

**What we were trying to find out:** The team lead said "a material is OAR
(on-demand ordered) if its MRP Type is `ND` or `PD`." Before building anything
on that rule, the plan wanted three quick checks against the real SAP system to
make sure that rule actually makes sense for the real data — not just the
made-up test data.

**What we did:**
- Connected to the real SAP system (via CPI) from this machine — it worked.
- Instead of just checking `ND`, `PD`, `VB` like the plan suggested, we counted
  **every single value** that actually shows up on the 2,177 real material/plant
  records. Checking only the three guessed values would have hidden anything
  unexpected — and something unexpected was there.
- Along the way we hit a real SAP quirk: combining two "not equal to" filters
  with "and" silently returns everything unfiltered instead of erroring. Worth
  remembering if anyone writes SAP filters by hand later.
- Also checked the *other* field the OAR rule depends on (`Mstae`, the
  "obsolete" flag on `MaterialSet`).

**What we found — and why it matters:**

| Value | Count | % of all 2,177 |
|---|---|---|
| *(blank — not set)* | 1,023 | 47.0% |
| `PD` | 827 | 38.0% |
| `ND` | 184 | 8.5% |
| `V1` | 79 | 3.6% |
| `VB` | 45 | 2.1% |
| `M0` | 13 | 0.6% |
| `RP` | 3 | 0.1% |
| `VI`, `VH`, `V2` | 1 each | 0.0% |

Three things this changes:

1. **Almost half of all material/plant records (47%) have no MRP Type set at
   all.** Nobody anticipated that. Those records can't be honestly called
   "OAR" or "not OAR" — they're **unknown**, and the code we build must treat
   them that way rather than quietly lumping them into "not OAR."
2. **`ND` + `PD` together = 46.4% of the catalogue** — not the "clear minority"
   the plan hoped for (its own rule of thumb was "under ~40% is fine"), but
   also nowhere near "basically everything." It's a genuine judgment call.
3. **Six MRP Type codes exist (`V1`, `M0`, `RP`, `VI`, `VH`, `V2`) that nobody
   — not the plan, not the team lead's ruling — ever mentioned.** We don't know
   what they mean for OAR scope.

We also made this check permanent: `cpi_discovery.py` now has a repeatable
"value distribution" scan (writes `data-generator/discovery/value_domains.csv`)
that anyone can re-run in the future instead of guessing which values might
show up.

**What we could not decide ourselves, and why:** Whether 46.4% counts as "in
scope" and what the six unknown codes mean are business calls, not technical
ones — the plan itself says this is "the team lead's call, not ours to
assume." Guessing wrong here would silently mis-scope every OAR screen in I07
and I13.

**What we built anyway:** Phase 1 (`W2.4`, the scope config module) does not
need this question answered to be built — the plan explicitly designed it so
the rule is a config value, not code. So we proceeded to build it with the
current best-guess rule, clearly marked as unconfirmed, so swapping it later
is a one-line change, not a rewrite.

**Your action item:** Take the table above back to the team lead and ask:
1. Do the 1,023 blank records count as OAR, not-OAR, or "needs a different
   answer entirely"?
2. Is 46.4% an acceptable OAR population, or does the rule need narrowing?
3. What do `V1`, `M0`, `RP`, `VI`, `VH`, `V2` mean, and should any count as OAR?

Nothing is blocked while you do this — we kept building. But the scope config's
default rule should be revisited once you have answers.

**Files touched:** `data-generator/cpi_discovery.py`,
`data-generator/discovery/value_domains.csv`, `data-generator/discovery/run-*.log`,
`data-generator/README.md`, `.gitignore`.

---

## Phase 1 — W2.4: "which materials count as OAR?" as a config file (2026-09-08)

**What this is:** Right now, "is this material OAR (on-demand ordered)?" is
answered in different, hard-coded ways scattered across the app (e.g.
`src/features/initiative-13/selectors/oar-lookup.ts` just checks a hand-typed
list). The plan calls this the single highest-value piece of WS2, because the
identifying SAP field has already changed once (from `Extwg` to `Dismm`)
without any of our code needing a rewrite — because nothing was hard-coded
even before this phase. This phase gives it a real home with real behaviour,
still not wired into the UI yet (that's a later phase).

**What we built:** `src/lib/sap/scope/` — one small library, four files:
- **`config.ts`** — the actual rule, as data, not code: "OAR = `Dismm` is `ND`
  or `PD`, AND `Mstae` (obsolete flag) is not `01`." This is the *only* place
  in the whole app allowed to mention those literal SAP codes.
- **`predicate.ts`** — runs that rule against one material+plant row and
  returns one of **three** answers, never just yes/no: `in-scope`,
  `not-in-scope`, or **`cannot-determine`**. That third answer matters a lot
  given Phase 0's finding — a material with no `Dismm` set at all must never
  be silently reported as "not OAR," because we don't actually know.
- **`odata-filter.ts`** — turns the same rule into a real SAP query filter
  (`$filter=Dismm eq 'ND' or Dismm eq 'PD'`), so large tables can be filtered
  *at SAP* instead of downloading everything and filtering here. Also encodes
  the "and-chained `ne` is silently broken" SAP quirk from Phase 0, so nobody
  accidentally builds a filter that looks right but quietly returns everything.
- **`index.ts`** — the three functions anything else in the app is allowed to
  call: `isInScope` (one material, one plant), `isMaterialInScope` (rolled up
  across every plant a material sits in — only when that rollup question is
  even allowed to be asked), and `toODataFilter`.

**The one thing this phase deliberately did NOT decide:** whether a material
that's OAR in one plant and not in another counts as "OAR" overall. The plan
is explicit that's the team lead's call, not ours (§1.6(a)). So the module
defaults to `rollup: "per-plant-only"` — meaning it refuses to answer the
material-level question at all (it throws a clear error telling the caller to
ask about a specific plant instead) until someone decides. Changing that
decision later is a one-line config edit, not a rewrite.

**How we know it's right:** Ran it against the same synthetic data
`generate.py` already produces, and it reproduced the plan's own documented
numbers exactly — 492 rows under the naive rule, 383 under the refined one.
No test framework exists yet (that's next), so this was checked by hand this
time; Phase 2 turns this into a real, permanent automated test.

**Known gap, not fixed here:** the synthetic (fake) data always has *some*
`Dismm` value set — it never leaves it blank. Real SAP leaves it blank 47% of
the time (Phase 0). So today, nothing in our test data exercises the
"cannot-determine" answer at all. Worth teaching `generate.py` to produce some
blank rows later so that case gets exercised too — flagged for whoever picks
up the fake-gateway phase (W2.6a).

**Your action item:** none yet — this phase needed no decision from you. The
Phase 0 questions (what do the blank/unexpected `Dismm` values mean) are still
open and should still go to the team lead when you get the chance; this
module is built so that answer slots in as a config change whenever it lands.

**Files touched:** `src/lib/sap/scope/config.ts`, `predicate.ts`,
`odata-filter.ts`, `index.ts`, `types.ts` (all new).

---

## Phase 2 — A test runner, and CI that runs it (2026-09-08)

**Why this mattered:** Until now this repo had **no way to run a test at all**
— no test framework, no CI. The plan's argument for fixing that is a real
incident: SAP silently changed two field types (`Netpr`/`Netwr`) from number
to text between two checks four hours apart, and the only reason anyone
noticed was a human eyeballing a file diff. Tests are how that becomes a red
build instead of a bug discovered in UAT.

**What we did:**
- Installed **Vitest** and wired up `npm test` (single run, CI-friendly) and
  `npm run test:watch` (re-runs while you edit).
- Added **GitHub Actions CI** (`.github/workflows/ci.yml`) — runs the test
  suite on every push to `main` and every pull request.
- Wrote **55 real tests** for the Phase 1 scope module, turning the by-hand
  check from Phase 1 into something permanent. They cover: each rule operator,
  the three-way in/out/unknown answers, all three roll-up policies, the exact
  SAP filter strings we generate, and the behaviour of the module against the
  real synthetic data files.
- Added a **leakage guard** the plan specifically asked for: an automated
  check that scans the entire `src/` folder and fails if any file outside the
  scope module mentions the OAR field names or hard-codes their values, or if
  *any* file still references the withdrawn `Extwg` rule. We deliberately
  tested the guard itself by planting a fake violation and confirming it
  caught it — a guard that silently passes is worse than none.

**A deliberate choice about the fixture tests:** the plan warned not to write
tests that assert fixed row counts, because the synthetic data gets
regenerated and those tests would break for no real reason. So instead of
"expect 383 rows", they assert *behaviour* — "everything selected genuinely
satisfies both halves of the rule", "the refined rule is always a subset of
the loose one", "the rows removed are exactly the obsolete ones". Those stay
true after any regeneration.

**One thing left deliberately out:** CI runs the tests but does **not** run
the linter yet, because the linter currently reports 3 pre-existing errors in
the app's React components (unrelated to any of this work — they're about
`setState` inside effects). Turning it on today would mean CI is red from day
one, which trains everyone to ignore it. The workflow file has a note saying
to add the lint step in whatever change clears those 3 errors.

**Your action item:** two small ones, neither urgent:
1. Those 3 lint errors in `src/components/materials/materials-explorer.tsx`
   and related files — someone who knows that UI should fix them, then the
   lint step gets switched on in CI.
2. Nothing about CI works until this branch is pushed to GitHub. The workflow
   will start running automatically once it is.

**Files touched:** `package.json`, `vitest.config.mts`,
`.github/workflows/ci.yml`, and four new test files in `src/lib/sap/scope/`.

---

## Phase 3 — W2.5: locking down what SAP actually gives us (2026-09-08)

**The problem in one sentence:** SAP can change a field's name, type, or key
at any time, without telling anyone, and today we'd find out when a screen
breaks in front of a user. This phase makes SAP changes fail a build instead.

**The concrete incident behind it:** between two checks four hours apart, SAP
changed two purchase-order price fields from *number* to *text*. Nothing
announced it. It was caught only because a human happened to compare two
files by eye. Any code doing arithmetic on those fields would have silently
produced garbage.

**What we built** (`src/lib/sap/contract/`):
- **A written-down contract of all 21 SAP tables and all 229 fields**
  (`generated-contract.ts`), produced automatically from the discovery sweep
  by `npm run contract:generate` and committed to git on purpose — it's the
  reference copy that everything else gets compared against.
- **A drift detector.** It re-reads SAP's raw schema files and compares them
  to that reference copy, reporting differences in plain language:
  `PurchaseOrderItemSet.Netpr: type changed Edm.Decimal -> Edm.String`. Not
  "expected 229, got 228" — the actual field, and what actually changed.
- **Proof the detector works.** We deliberately corrupted the schema four
  different ways (changed a type, renamed a field, changed a key, deleted a
  table) and confirmed each produces the right, specifically-worded failure.
  A drift detector nobody has tried to fool is just decoration.
- **A "known conditions" list** — every quirk of the current live system
  written down as a test: which tables are broken, which return zero rows,
  which fields exist, which don't yet. These fail **in both directions**: if
  a table that returns zero rows suddenly returns 40,000, that's just as much
  of a signal as the reverse, and someone needs to know.
- **Safe value decoding.** SAP sends dates as `/Date(1757280000000)/`, times
  as `PT14H16M00S`, and decimals as text. We decode strictly by the *declared*
  type, never by guessing from the value's shape — which is precisely what
  keeps a text field holding "1234.56" from being silently turned into a
  number, and keeps material number `000000000012345` from losing its leading
  zeros and never matching anything again.
- **A per-initiative needs list** — what I07, I08 and I13 each require from
  SAP, checked against reality. This is the check that catches the
  `Value_old` vs `ValueOld` class of mistake, which was a *real* wrong
  assumption held until the last sweep corrected it.

**One correction we made to the plan itself:** the plan expected `Dismm` to
only ever hold `VB`, `ND` or `PD`, and said to fail the build on anything
else. That expectation was written *before* anyone measured it. Phase 0
measured it, and reality has ten values including blanks. So the check now
records **measured reality** and fails when a genuinely *new* value shows up.
There's a comment in the file warning the next person not to "fix" it back to
the plan's three values.

**A nice moment worth recording:** the leakage guard from Phase 2 caught two
mistakes *in this phase's own code* — including one where the plan says the
old `Extwg` rule should be retired entirely, and I had written a check that
kept tracking it. The guard was right and the new code was wrong, twice. That
is exactly what it's for.

**Your action item:** none. This phase is self-contained and needed no
decisions.

**Files touched:** 11 new files in `src/lib/sap/contract/`,
`scripts/generate-sap-contract.mts`, `package.json`
(`fast-xml-parser`, `npm run contract:generate`).

---
