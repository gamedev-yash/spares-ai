import type { ConsumptionRow } from "../data/types";

/** Derives the dataset-wide history window (every distinct "YYYY-MM" period present in
 * consumption_history.csv, oldest first) instead of hardcoding it -- the generator's
 * window is "the 24 months ending near generation time", which shifts every time the
 * seed data is regenerated. Every material shares the same window (it's a property of the
 * dataset, not of any one material), so this only needs to run once. */
export function deriveMonthWindow(consumptionHistory: ConsumptionRow[]): string[] {
  const months = new Set<string>();
  for (const row of consumptionHistory) months.add(row.period_month);
  return Array.from(months).sort();
}

export function monthIndex(window: string[], period: string): number {
  return window.indexOf(period);
}

/** Days between two "YYYY-MM-DD" ISO date strings. */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso + "T00:00:00Z").getTime();
  const to = new Date(toIso + "T00:00:00Z").getTime();
  return (to - from) / (1000 * 60 * 60 * 24);
}

/** "Today" for the purposes of this mockup is derived from the data itself (the day after
 * the last month in the consumption history window) rather than the browser clock -- the
 * seed data's dates are all relative to when it was generated, so this keeps "upcoming
 * maintenance" filtering correct even if the demo is opened long after generation. */
export function deriveReferenceNow(window: string[]): Date {
  if (window.length === 0) return new Date();
  const last = window[window.length - 1]; // "YYYY-MM"
  const [year, month] = last.split("-").map(Number);
  return new Date(Date.UTC(year, month, 1)); // first day of the month after the window ends
}

export function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
}
