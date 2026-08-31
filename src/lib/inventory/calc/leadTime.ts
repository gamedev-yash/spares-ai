import { daysBetween } from "./months";
import { mean, sampleStdev } from "./stats";
import { DAYS_PER_MONTH } from "./config";
import type { GoodsReceiptRow, MaterialRow } from "../data/types";

export interface LeadTimeResult {
  ltAvgMonths: number;
  sigmaLtMonths: number;
  recordCount: number;
  usedFallback: boolean;
}

/** Step 3 -- lead-time mean/variability from goods_receipt.csv (actual PO-creation ->
 * goods-receipt deltas), converted to months to match the demand-rate time unit used
 * throughout the rest of the pipeline. Falls back to materials.lead_time_days (the
 * original, planned-only column) when fewer than 2 real records exist -- with no
 * variability signal in that case (sigmaLtMonths = 0), which Step 7 penalizes via the
 * confidence grade. */
export function computeLeadTime(material: MaterialRow, goodsReceiptRows: GoodsReceiptRow[]): LeadTimeResult {
  if (goodsReceiptRows.length >= 2) {
    const monthsList = goodsReceiptRows.map(
      (r) => daysBetween(r.po_creation_date, r.goods_receipt_date) / DAYS_PER_MONTH,
    );
    return {
      ltAvgMonths: mean(monthsList),
      sigmaLtMonths: sampleStdev(monthsList),
      recordCount: goodsReceiptRows.length,
      usedFallback: false,
    };
  }

  return {
    ltAvgMonths: material.lead_time_days / DAYS_PER_MONTH,
    sigmaLtMonths: 0,
    recordCount: goodsReceiptRows.length,
    usedFallback: true,
  };
}
