import type { ConsumptionRow, GoodsReceiptRow } from "../data/types";
import { daysBetween } from "./months";
import { mean } from "./stats";
import { fillMonthlySeries } from "./forecast";

export interface LeadTimeSpike {
  materialId: string;
  poNumber: string;
  vendor: string;
  actualDays: number;
  meanDays: number;
  ratio: number;
  goodsReceiptDate: string;
}

/** Any goods-receipt record whose actual lead time exceeds 1.5x that material's own mean
 * lead time (computed across all of its records, spike included) -- a per-material
 * outlier check, not a fleet-wide one. */
export function computeLeadTimeSpikes(goodsReceipt: GoodsReceiptRow[]): LeadTimeSpike[] {
  const byMaterial = new Map<string, GoodsReceiptRow[]>();
  for (const row of goodsReceipt) {
    const list = byMaterial.get(row.material_id) ?? [];
    list.push(row);
    byMaterial.set(row.material_id, list);
  }

  const spikes: LeadTimeSpike[] = [];
  for (const [materialId, rows] of byMaterial) {
    if (rows.length < 2) continue;
    const days = rows.map((r) => daysBetween(r.po_creation_date, r.goods_receipt_date));
    const meanDays = mean(days);
    rows.forEach((r, i) => {
      const actualDays = days[i];
      if (meanDays > 0 && actualDays > 1.5 * meanDays) {
        spikes.push({
          materialId,
          poNumber: r.po_number,
          vendor: r.vendor,
          actualDays,
          meanDays,
          ratio: actualDays / meanDays,
          goodsReceiptDate: r.goods_receipt_date,
        });
      }
    });
  }
  return spikes.sort((a, b) => b.ratio - a.ratio);
}

export interface DemandAnomaly {
  materialId: string;
  last3Avg: number;
  last12Avg: number;
  deviationPct: number; // signed: positive = recent spike up, negative = recent drop
}

/** Materials where the last-3-month average consumption deviates from the trailing
 * 12-month average by more than 40% in either direction. */
export function computeDemandAnomalies(window: string[], consumptionHistory: ConsumptionRow[]): DemandAnomaly[] {
  const byMaterial = new Map<string, ConsumptionRow[]>();
  for (const row of consumptionHistory) {
    const list = byMaterial.get(row.material_id) ?? [];
    list.push(row);
    byMaterial.set(row.material_id, list);
  }

  const last12Window = window.slice(-12);
  const last3Window = window.slice(-3);

  const anomalies: DemandAnomaly[] = [];
  for (const [materialId, rows] of byMaterial) {
    const last12Avg = mean(fillMonthlySeries(last12Window, rows));
    const last3Avg = mean(fillMonthlySeries(last3Window, rows));
    if (last12Avg <= 0) continue;
    const deviationPct = (last3Avg - last12Avg) / last12Avg;
    if (Math.abs(deviationPct) > 0.4) {
      anomalies.push({ materialId, last3Avg, last12Avg, deviationPct });
    }
  }
  return anomalies.sort((a, b) => Math.abs(b.deviationPct) - Math.abs(a.deviationPct));
}
