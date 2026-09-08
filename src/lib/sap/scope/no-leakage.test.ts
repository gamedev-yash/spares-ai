import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { describe, expect, it } from "vitest"

// W2.4's CI guard: the OAR identifiers must exist in exactly one place. When
// the rule changes again — and it already changed once, from Extwg to Dismm —
// the blast radius has to stay one config file. A stray reference anywhere
// else is the bug this test exists to catch.

const SRC = "./src"
const SCOPE_MODULE = join("src", "lib", "sap", "scope")

/** Field names that identify scope. Allowed only inside the scope module. */
const SCOPED_TOKENS = [/\bDismm\b/i, /\bMstae\b/i]

/** String literals carrying scope values. Allowed only inside the scope module. */
const SCOPED_LITERALS = [/(['"])ND\1/, /(['"])PD\1/, /(['"])01\1/]

/**
 * The withdrawn EXTWG rule (§1.6). Banned everywhere, scope module included —
 * a reference to it now is a stale assumption, not a placeholder. Banning the
 * field name also covers its old value "100", which cannot be used as an OAR
 * identifier without naming the field it belongs to.
 */
const WITHDRAWN_TOKENS = [/\bExtwg\b/i]

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full))
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

// This file necessarily contains every banned token, since it defines them.
const files = sourceFiles(SRC).filter((f) => !f.endsWith("no-leakage.test.ts"))
const isInScopeModule = (file: string) => relative(".", file).startsWith(SCOPE_MODULE + sep)

function offenders(patterns: RegExp[], candidates: string[]): string[] {
  return candidates.filter((file) => {
    const content = readFileSync(file, "utf-8")
    return patterns.some((p) => p.test(content))
  })
}

describe("scope identifier leakage", () => {
  it("finds source files to scan at all (guards against the walker silently matching nothing)", () => {
    expect(files.length).toBeGreaterThan(50)
    expect(files.some(isInScopeModule)).toBe(true)
  })

  it("no file outside the scope module names Dismm or Mstae", () => {
    expect(offenders(SCOPED_TOKENS, files.filter((f) => !isInScopeModule(f)))).toEqual([])
  })

  it("no file outside the scope module hard-codes the 'ND' / 'PD' / '01' literals", () => {
    expect(offenders(SCOPED_LITERALS, files.filter((f) => !isInScopeModule(f)))).toEqual([])
  })

  it("no file anywhere references the withdrawn Extwg identifier", () => {
    expect(offenders(WITHDRAWN_TOKENS, files)).toEqual([])
  })
})
