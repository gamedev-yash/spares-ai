// Adjustable constants for the calculation engine. Everything here is either an explicit
// mockup convenience (EOQ cost inputs) or an ILLUSTRATIVE placeholder standing in for a
// number that actually requires Vedanta business sign-off (the Z-factors) -- see
// criticality_policy.csv, which ships with every target/z_factor blank and
// status="PENDING_SIGNOFF" for exactly this reason. Never present ILLUSTRATIVE_Z_FACTORS
// as approved policy in the UI; always label it "illustrative, pending sign-off".

import type { Criticality } from "../data/types";

/** EOQ ordering cost per order (S), in the same currency as materials.last_po_price (ZAR). */
export const DEFAULT_ORDERING_COST = 2000;

/** EOQ annual holding cost rate (H), as a fraction of unit price held per year. */
export const DEFAULT_HOLDING_RATE = 0.25;

/** Classification thresholds (Syntetos-Boylan). */
export const ADI_THRESHOLD = 1.32;
export const CV2_THRESHOLD = 0.49;

/** SBA (Syntetos-Boylan Approximation) smoothing constant. */
export const SBA_ALPHA = 0.1;

/** History gate: below either of these, a material is routed to the OAR/cold-start path
 * regardless of its oar_flag column (see classification.ts). */
export const MIN_NONZERO_MONTHS = 5;
export const MIN_HISTORY_MONTHS = 6;

/** Confidence-grade thresholds (Step 7). */
export const HIGH_CONFIDENCE_MONTHS = 24;
export const MEDIUM_CONFIDENCE_MONTHS = 12;
export const HIGH_CONFIDENCE_GR_COUNT = 5;
export const MEDIUM_CONFIDENCE_GR_COUNT = 2;

/** Illustrative-only Z-factors, standing in for the (currently blank) service-level policy.
 * Mapped from this dataset's actual criticality labels (CRITICAL/HIGH/MEDIUM), not the
 * generic "A/B/C" the requirement sheet uses. */
export const ILLUSTRATIVE_Z_FACTORS: Record<Criticality, number> = {
  CRITICAL: 2.05,
  HIGH: 1.65,
  MEDIUM: 1.28,
};

/** Max Stock Option B review-period T (months), by criticality. */
export const REVIEW_PERIOD_MONTHS: Record<Criticality, number> = {
  CRITICAL: 3,
  HIGH: 6,
  MEDIUM: 12,
};

/** Average calendar days per month, used to convert goods-receipt day-deltas into months
 * so lead time and demand-rate figures share one time unit throughout the pipeline. */
export const DAYS_PER_MONTH = 30.4368;

/** OAR similarity: how many nearest neighbors to average over. */
export const OAR_NEIGHBOR_COUNT = 5;
