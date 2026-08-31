import { mean, sampleStdev } from "./stats";
import type { ConsumptionRow } from "../data/types";

/** Zero-fills a material's sparse consumption rows into a full series aligned to the
 * dataset-wide month window -- consumption_history.csv only stores non-zero months, so a
 * missing month means zero consumption, not missing data. */
export function fillMonthlySeries(window: string[], rows: ConsumptionRow[]): number[] {
  const byPeriod = new Map(rows.map((r) => [r.period_month, r.qty_consumed]));
  return window.map((period) => byPeriod.get(period) ?? 0);
}

export interface StatisticalForecast {
  method: "Statistical";
  dAvg: number; // mean monthly demand across the full window, zeros included
  sigmaD: number; // sample stdev across the full window, zeros included
}

/** Step 2 (Smooth/Erratic path) -- plain mean/stdev over all months in the window,
 * including the zero months a sparse table implies. */
export function forecastStatistical(window: string[], rows: ConsumptionRow[]): StatisticalForecast {
  const series = fillMonthlySeries(window, rows);
  return { method: "Statistical", dAvg: mean(series), sigmaD: sampleStdev(series) };
}

export interface SbaForecast {
  method: "SBA";
  pFinal: number | null; // smoothed mean inter-demand interval, in months
  zFinal: number | null; // smoothed mean demand size per occurrence
  forecastPerMonth: number | null; // (1 - alpha/2) * zFinal / pFinal
}

/** Step 2 (Intermittent/Lumpy path) -- Syntetos-Boylan Approximation: Croston's method
 * (separately exponentially-smooth the inter-arrival interval and the demand size) with
 * the (1 - alpha/2) bias correction. Smoothing runs in chronological order over the
 * material's non-zero occurrences within the window; the first occurrence seeds both
 * estimates (interval = its position in the window + 1, i.e. months since window start). */
export function forecastSBA(window: string[], rows: ConsumptionRow[], alpha: number): SbaForecast {
  const byPeriod = new Map(rows.map((r) => [r.period_month, r.qty_consumed]));
  const nonZeroIndices = window
    .map((period, idx) => ({ idx, qty: byPeriod.get(period) ?? 0 }))
    .filter((r) => r.qty > 0);

  if (nonZeroIndices.length === 0) {
    return { method: "SBA", pFinal: null, zFinal: null, forecastPerMonth: null };
  }

  let pEstimate = nonZeroIndices[0].idx + 1;
  let zEstimate = nonZeroIndices[0].qty;
  let lastIdx = nonZeroIndices[0].idx;

  for (let i = 1; i < nonZeroIndices.length; i++) {
    const { idx, qty } = nonZeroIndices[i];
    const interval = idx - lastIdx;
    pEstimate = pEstimate + alpha * (interval - pEstimate);
    zEstimate = zEstimate + alpha * (qty - zEstimate);
    lastIdx = idx;
  }

  const forecastPerMonth = pEstimate > 0 ? (1 - alpha / 2) * (zEstimate / pEstimate) : 0;
  return { method: "SBA", pFinal: pEstimate, zFinal: zEstimate, forecastPerMonth };
}
