// Small, dependency-free descriptive-statistics helpers shared across the calculation
// engine. All "stdev" functions are SAMPLE standard deviation (n-1 denominator), the
// conventional choice for demand/lead-time variability estimated from a limited history.

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function sampleVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const sumSq = values.reduce((sum, v) => sum + (v - m) ** 2, 0);
  return sumSq / (values.length - 1);
}

export function sampleStdev(values: number[]): number {
  return Math.sqrt(sampleVariance(values));
}

/** Rounds up to the nearest whole unit -- every stock-level figure the engine surfaces
 * (SS/ROP/Max/EOQ) must be a purchasable whole quantity. */
export function roundUp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.ceil(value - 1e-9));
}
