/**
 * Small, dependency-free statistics helpers.
 *
 * Everything here is pure and tolerant of empty/short input so the insight
 * engine can call it without guarding every call site.
 */

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Keeps only finite numbers. */
export function compact(values: readonly (number | null | undefined)[]): number[] {
  return values.filter(isFiniteNumber);
}

export function sum(values: readonly number[]): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return sum(values) / values.length;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle]!;
  return (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function min(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((acc, value) => (value < acc ? value : acc), Infinity);
}

export function max(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((acc, value) => (value > acc ? value : acc), -Infinity);
}

/** Population standard deviation. Returns 0 for a single sample. */
export function stdDev(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  if (values.length === 1) return 0;
  const avg = mean(values)!;
  const variance = sum(values.map((value) => (value - avg) ** 2)) / values.length;
  return Math.sqrt(variance);
}

/**
 * Coefficient of variation (stdDev / mean) as a percentage.
 * Useful to compare how *stable* two metrics are across a window.
 */
export function coefficientOfVariation(values: readonly number[]): number | null {
  return variationRatio(mean(values), stdDev(values));
}

/**
 * Coefficient of variation from pre-computed statistics.
 * Lets callers work with a `MetricSummary` instead of the raw series.
 */
export function variationRatio(average: number | null, deviation: number | null): number | null {
  if (average === null || deviation === null || average === 0) return null;
  return (deviation / Math.abs(average)) * 100;
}

export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const clamped = Math.min(100, Math.max(0, p));
  const sorted = [...values].sort((a, b) => a - b);
  const index = (clamped / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower]!;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (index - lower);
}

/** Least-squares fit of `y = slope * x + intercept`. */
export interface Regression {
  slope: number;
  intercept: number;
  /** Coefficient of determination in [0, 1]. */
  r2: number;
}

export function linearRegression(
  points: ReadonlyArray<{ x: number; y: number }>,
): Regression | null {
  const n = points.length;
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const point of points) {
    const dx = point.x - meanX;
    const dy = point.y - meanY;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }

  // A flat x-axis gives an undefined slope.
  if (sxx === 0) return null;

  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;
  // A constant y has no variance to explain, so nothing is fitted.
  const r2 = syy === 0 ? 0 : Math.min(1, Math.max(0, (sxy * sxy) / (sxx * syy)));

  return { slope, intercept, r2 };
}

/** Pearson product-moment correlation, or `null` when undefined. */
export function pearsonCorrelation(a: readonly number[], b: readonly number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 2) return null;

  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i += 1) {
    sumA += a[i]!;
    sumB += b[i]!;
  }
  const meanA = sumA / n;
  const meanB = sumB / n;

  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = a[i]! - meanA;
    const dy = b[i]! - meanB;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }

  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/**
 * Centred moving average over a numeric series.
 * `null` marks the positions where the window is not yet full.
 */
export function movingAverage(
  values: readonly (number | null | undefined)[],
  windowSize: number,
): (number | null)[] {
  if (windowSize <= 0) throw new RangeError('windowSize must be greater than 0');

  return values.map((_, index) => {
    if (index + 1 < windowSize) return null;
    const slice = values.slice(index + 1 - windowSize, index + 1).filter(isFiniteNumber);
    return mean(slice);
  });
}

export function clamp(value: number, lower: number, upper: number): number {
  return Math.min(upper, Math.max(lower, value));
}

/** Rounds to `digits` decimals, avoiding `-0` and float noise. */
export function round(value: number, digits = 1): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** digits;
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  return rounded === 0 ? 0 : rounded;
}

/** `12345` -> `"12,345"`. */
export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Rounds to a fixed number of decimals and renders with thousands separators. */
export function formatMetric(value: number | null | undefined, digits = 1): string {
  if (!isFiniteNumber(value)) return '—';
  return formatNumber(round(value, digits), digits);
}

export function formatSigned(value: number | null | undefined, digits = 1): string {
  if (!isFiniteNumber(value)) return '—';
  const rounded = round(value, digits);
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${formatNumber(rounded, digits)}`;
}