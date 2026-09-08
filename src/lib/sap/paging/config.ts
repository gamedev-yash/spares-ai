// W2.3 — per-set paging configuration (§4).
//
// Deliberately configuration rather than a hard-coded list of broken sets.
// PurchaseOrderItemSet is the proof this pays for itself: its `$count` was
// broken, then SAP fixed it, and a set on "auto" picks that up with no code
// change at all.

import { SAP_CONTRACT } from "../contract/generated-contract"

export type CountMode =
  /** Ask `$count`, then page to that total. */
  | "counted"
  /** Never ask `$count`; page until a short page. For sets where it 500s. */
  | "fallback"
  /** Try `$count` once; demote to fallback on a 5xx, and log the demotion. */
  | "auto"

export type ExtractMode =
  | "full"
  /** An unfiltered extract is refused outright, not merely discouraged. */
  | "filtered-only"

export interface SetPagingConfig {
  countMode: CountMode
  extract: ExtractMode
  pageSize?: number
  /**
   * Ordering for stable paging. Defaults to the declared key, but the key is
   * not always row-unique — see ChangeDocItemSet (§1.2/§1.4), where ordering
   * by key alone is not deterministic and pages can skip or duplicate rows.
   */
  orderBy?: string[]
}

const DEFAULT_CONFIG: SetPagingConfig = { countMode: "auto", extract: "full" }

export const SET_PAGING: Record<string, SetPagingConfig> = {
  // $count really is broken on these two today. "auto" would work, but naming
  // them explicitly documents a known condition rather than rediscovering it
  // through a failed call on every extraction.
  PurchaseRequisitionSet: { countMode: "fallback", extract: "full" },
  GoodsMovementItemSet: { countMode: "fallback", extract: "full" },

  // 929,151 and 241,685 rows. A full extract is never the right operation:
  // I07 asks these a narrow question ("was this recommendation applied?"),
  // which is a filtered lookup (§1.4).
  ChangeDocItemSet: {
    countMode: "auto",
    extract: "filtered-only",
    // The declared OData key is only 3 fields and is NOT row-unique. The
    // composite identity below is what actually distinguishes a row.
    orderBy: ["Objectclas", "Objectid", "Changenr", "Tabname", "Fname"],
  },
  ChangeDocHeaderSet: { countMode: "auto", extract: "filtered-only" },
}

export function pagingConfigFor(entitySet: string): SetPagingConfig {
  return SET_PAGING[entitySet] ?? DEFAULT_CONFIG
}

/** Ordering fields for a paged read: the configured identity, else the declared key. */
export function orderByFor(entitySet: string): string[] {
  const configured = pagingConfigFor(entitySet).orderBy
  if (configured) return configured
  const contract = SAP_CONTRACT[entitySet]
  return contract ? [...contract.keys] : []
}

/** Safety ceilings. With a 929k-row set reachable, these are not theoretical. */
export const SAFETY_LIMITS = {
  maxPages: 1000,
  maxRows: 250_000,
}
