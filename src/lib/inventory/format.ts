export function formatCurrency(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}₹${new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 }).format(abs)}`;
}

/** Abbreviated currency for portfolio-level aggregates (KPI cards, the Overview "Inventory
 * value" panel, the Detailed report table) -- same "keep big totals scannable" idea as the
 * mockup's Lakhs formatter, in the M/B convention. Individual-material figures (a single
 * recommendation's impact, the approval modal) stay full-precision -- see formatCurrency. */
export function formatCurrencyCompact(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${sign}₹${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}₹${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(0)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-ZA", { maximumFractionDigits: digits }).format(value);
}

export function formatDate(iso: string): string {
  if (!iso) return "--";
  const d = new Date(iso.length <= 7 ? `${iso}-01` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-ZA", { year: "numeric", month: "short", day: iso.length <= 7 ? undefined : "numeric" }).format(d);
}

/** Same as formatDate but with a time-of-day component -- for the audit ledger, where "when
 * exactly did this happen" matters (approvals.ts timestamps are full ISO datetimes). */
export function formatDateTime(iso: string): string {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-ZA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}
