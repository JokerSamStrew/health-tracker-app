/**
 * Turning raw `DailyEntry[]` into ordered series and per-metric summaries.
 *
 * Kept free of React and storage so it can be unit-tested directly.
 */

import { daysBetween, fromISODate, toISODate } from './date.ts';
import {
  linearRegression,
  max,
  mean,
  median,
  min,
  stdDev,
  sum,
} from './stats.ts';
import type { DailyEntry, MetricKey, MetricSummary } from '../types.ts';
import { METRIC_KEYS, METRIC_UNITS } from '../types.ts';

export type MetricField = 'weightKg' | 'steps' | 'sleepQuality' | 'calories';

/** Which `DailyEntry` field backs each metric. */
export const METRIC_FIELD: Record<MetricKey, MetricField> = {
  weight: 'weightKg',
  steps: 'steps',
  sleep: 'sleepQuality',
  calories: 'calories',
};

/** Sensible display precision per metric. */
export const METRIC_DIGITS: Record<MetricKey, number> = {
  weight: 1,
  steps: 0,
  sleep: 1,
  calories: 0,
};

/** Entries sorted by date ascending, later duplicates (by `mergeEntries`) collapsed. */
export function sortEntries(entries: readonly DailyEntry[]): DailyEntry[] {
  return [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Merges entries by date. Values from `incoming` win; `undefined` fields keep
 * the existing value, so a partial edit never wipes data.
 */
export function mergeEntries(
  existing: readonly DailyEntry[],
  incoming: readonly DailyEntry[],
): DailyEntry[] {
  const byDate = new Map<string, DailyEntry>();
  for (const entry of existing) byDate.set(entry.date, { ...entry });
  for (const entry of incoming) {
    const current = byDate.get(entry.date);
    if (!current) {
      byDate.set(entry.date, { ...entry });
      continue;
    }
    byDate.set(entry.date, { ...current, ...stripUndefined(entry) });
  }
  return sortEntries([...byDate.values()]);
}

function stripUndefined(entry: DailyEntry): DailyEntry {
  const result: DailyEntry = { date: entry.date };
  if (entry.weightKg !== undefined) result.weightKg = entry.weightKg;
  if (entry.steps !== undefined) result.steps = entry.steps;
  if (entry.sleepQuality !== undefined) result.sleepQuality = entry.sleepQuality;
  if (entry.calories !== undefined) result.calories = entry.calories;
  if (entry.moods !== undefined) result.moods = [...entry.moods];
  return result;
}

/** Drops entries that carry no metric value at all. */
export function isEmptyEntry(entry: DailyEntry): boolean {
  return (
    entry.weightKg === undefined &&
    entry.steps === undefined &&
    entry.sleepQuality === undefined &&
    entry.calories === undefined &&
    (entry.moods?.length ?? 0) === 0
  );
}

/** All finite values for a metric, ordered by date ascending. */
export function metricSeries(entries: readonly DailyEntry[], key: MetricKey): number[] {
  const field = METRIC_FIELD[key];
  return sortEntries(entries)
    .map((entry) => entry[field])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

/**
 * Builds a dense `{ date, value }` series over `[start, end]`, filling gaps with
 * `null` so charts keep an even time axis.
 */
export function buildSeries(
  entries: readonly DailyEntry[],
  key: MetricKey,
  start: string,
  end: string,
): Array<{ date: string; value: number | null }> {
  const field = METRIC_FIELD[key];
  const byDate = new Map(entries.map((entry) => [entry.date, entry[field]]));
  const span = daysBetween(start, end);
  if (span === null || span < 0) return [];

  const series: Array<{ date: string; value: number | null }> = [];
  const cursor = fromISODate(start);
  if (!cursor) return [];
  for (let i = 0; i <= span; i += 1) {
    const date = toISODate(cursor);
    cursor.setDate(cursor.getDate() + 1);
    const value = byDate.get(date);
    series.push({ date, value: typeof value === 'number' && Number.isFinite(value) ? value : null });
  }
  return series;
}

export interface SummarizeOptions {
  /** First date of the window; used as x=0 for the trend regression. */
  windowStart?: string;
}

/** Descriptive statistics plus a least-squares trend for one metric. */
export function summarizeMetric(
  entries: readonly DailyEntry[],
  key: MetricKey,
  options: SummarizeOptions = {},
): MetricSummary {
  const field = METRIC_FIELD[key];
  const sorted = sortEntries(entries);
  const points = sorted
    .filter((entry) => typeof entry[field] === 'number' && Number.isFinite(entry[field]))
    .map((entry) => ({
      x: options.windowStart ? (daysBetween(options.windowStart, entry.date) ?? 0) : 0,
      y: entry[field] as number,
    }));

  const values = points.map((point) => point.y);
  const latest = values.length > 0 ? values[values.length - 1]! : null;
  const previous = values.length > 1 ? values[values.length - 2]! : null;

  let trendPerWeek: number | null = null;
  if (points.length >= 2) {
    const regression = linearRegression(points);
    // The regression is computed with x in days; scale it to a week.
    trendPerWeek = regression ? regression.slope * 7 : null;
  }

  return {
    key,
    unit: METRIC_UNITS[key],
    count: values.length,
    latest,
    previous,
    average: mean(values),
    median: median(values),
    min: min(values),
    max: max(values),
    stdDev: stdDev(values),
    change: values.length >= 2 ? latest! - values[0]! : null,
    trendPerWeek,
  };
}

/** Summaries for every metric in the given window. */
export function summarizeAll(
  entries: readonly DailyEntry[],
  windowStart: string,
): Record<MetricKey, MetricSummary> {
  const windowEntries = entries.filter(
    (entry) => daysBetween(windowStart, entry.date) !== null && entry.date >= windowStart,
  );
  const summaries = {} as Record<MetricKey, MetricSummary>;
  for (const key of METRIC_KEYS) {
    summaries[key] = summarizeMetric(windowEntries, key, { windowStart });
  }
  return summaries;
}

/** Total of an additive metric over the window (used for calorie/sstep totals). */
export function metricTotal(entries: readonly DailyEntry[], key: MetricKey): number {
  return sum(metricSeries(entries, key));
}