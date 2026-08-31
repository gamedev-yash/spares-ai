import type { RiskBand } from "./types";

/** current ROP as a fraction of the statistically recommended ROP (E[LTD] + SS) --
 * a simple heuristic for "how far off is the naive/judgment-based ROP from what the data
 * actually supports", not a stockout-probability calculation (that's the Exceptions
 * page's job, using current_inventory.csv against the same recommended ROP). */
export function riskFromRopRatio(currentROP: number, recommendedROP: number): RiskBand {
  if (recommendedROP <= 0) return currentROP > 0 ? "Low" : "Critical";
  const ratio = currentROP / recommendedROP;
  if (ratio >= 1) return "Low";
  if (ratio >= 0.75) return "Medium";
  if (ratio >= 0.5) return "High";
  return "Critical";
}
