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
