/**
 * Chart data shaping.
 *
 * Recharts wants a dense, evenly spaced array. `buildChartData` fills the gaps
 * between logged days with `null` so a chart shows real time on the x-axis
 * instead of pretending missing days were consecutive.
 */

import { formatShortDate, lastNDays } from './date.ts';
import { sortEntries } from './series.ts';
import { movingAverage as rollingAverage } from './stats.ts';
import type { DailyEntry, MetricKey } from '../types.ts';

export interface ChartPoint {
  date: string;
  /** Short label for the x-axis tick. */
  label: string;
  weightKg: number | null;
  steps: number | null;
  sleepHours: number | null;
  calories: number | null;
  /** 7-day rolling averages, used as trend lines on the charts. */
  weightAvg7: number | null;
  stepsAvg7: number | null;
  sleepAvg7: number | null;
  caloriesAvg7: number | null;
  /** Calendar day of month, handy for the label column. */
  day: number;
}

const ROLLING_WINDOW = 7;

export function buildChartData(
  entries: readonly DailyEntry[],
  referenceDate: string,
  windowDays: number,
): ChartPoint[] {
  const dates = lastNDays(referenceDate, windowDays);
  const byDate = new Map(sortEntries(entries).map((entry) => [entry.date, entry]));

  const raw: ChartPoint[] = dates.map((date) => {
    const entry = byDate.get(date);
    const day = Number(date.slice(-2));
    return {
      date,
      label: formatShortDate(date),
      day,
      weightKg: entry?.weightKg ?? null,
      steps: entry?.steps ?? null,
      sleepHours: entry?.sleepHours ?? null,
      calories: entry?.calories ?? null,
      weightAvg7: null,
      stepsAvg7: null,
      sleepAvg7: null,
      caloriesAvg7: null,
    };
  });

  const weights = rollingAverage(
    raw.map((point) => point.weightKg),
    ROLLING_WINDOW,
  );
  const steps = rollingAverage(
    raw.map((point) => point.steps),
    ROLLING_WINDOW,
  );
  const sleep = rollingAverage(
    raw.map((point) => point.sleepHours),
    ROLLING_WINDOW,
  );
  const calories = rollingAverage(
    raw.map((point) => point.calories),
    ROLLING_WINDOW,
  );

  return raw.map((point, index) => ({
    ...point,
    weightAvg7: weights[index] ?? null,
    stepsAvg7: steps[index] ?? null,
    sleepAvg7: sleep[index] ?? null,
    caloriesAvg7: calories[index] ?? null,
  }));
}

/** Maps a metric to its chart data key, on the raw and the rolling average. */
export const CHART_KEYS: Record<MetricKey, { value: keyof ChartPoint; average: keyof ChartPoint }> = {
  weight: { value: 'weightKg', average: 'weightAvg7' },
  steps: { value: 'steps', average: 'stepsAvg7' },
  sleep: { value: 'sleepHours', average: 'sleepAvg7' },
  calories: { value: 'calories', average: 'caloriesAvg7' },
};

/**
 * Suggested y-axis domain, padded so points are not glued to the edge.
 *
 * `anchors` are extra values that should stay visible - in practice the goal
 * line. Recharts drops a `ReferenceLine` that falls outside the domain, so a
 * goal the user is nowhere near would silently vanish. An anchor only widens
 * the domain when it is within `maxStretch` of the data span, which stops a
 * distant target from squashing the actual data into a sliver.
 *
 * Returns `undefined` when there is nothing to plot, which tells Recharts to
 * fall back to its automatic domain.
 */
export function paddedDomain(
  values: ReadonlyArray<number | null>,
  paddingRatio = 0.15,
  anchors: ReadonlyArray<number | null | undefined> = [],
  maxStretch = 0.5,
): [number, number] | undefined {
  const finite = values.filter((value): value is number => typeof value === 'number');
  if (finite.length === 0) return undefined;

  let min = Math.min(...finite);
  let max = Math.max(...finite);
  const span = max - min;

  // A flat series gets a symmetric band to sit in; anchors may widen it too.
  const flatPad = Math.max(Math.abs(min) * 0.05, 1);
  const reach = span === 0 ? flatPad : span * maxStretch;

  for (const anchor of anchors) {
    if (typeof anchor !== 'number' || !Number.isFinite(anchor)) continue;
    const low = Math.min(min, anchor);
    const high = Math.max(max, anchor);
    if (Math.max(high - max, min - low) <= reach) {
      min = low;
      max = high;
    }
  }

  const finalSpan = max - min;
  if (finalSpan === 0) return [min - flatPad, max + flatPad];

  return [min - finalSpan * paddingRatio, max + finalSpan * paddingRatio];
}

/** True when every value is `null`; the chart then shows an empty state. */
export function isEmptySeries(values: ReadonlyArray<number | null>): boolean {
  return !values.some((value) => typeof value === 'number');
}

/** Values for one metric across the chart points, for domain calculation. */
export function metricValues(data: readonly ChartPoint[], key: MetricKey): Array<number | null> {
  const chartKey = CHART_KEYS[key].value;
  return data.map((point) => {
    const value = point[chartKey];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  });
}