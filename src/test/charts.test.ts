import { describe, expect, it } from 'vitest';
import {
  buildChartData,
  CHART_KEYS,
  isEmptySeries,
  metricValues,
  paddedDomain,
} from '../lib/charts.ts';
import type { DailyEntry } from '../types.ts';

const REFERENCE = '2024-03-08';

const ENTRIES: DailyEntry[] = [
  { date: '2024-03-01', weightKg: 80, steps: 9000, sleepQuality: 3, calories: 2400 },
  { date: '2024-03-03', weightKg: 79.5, steps: 11000, sleepQuality: 4, calories: 2500 },
  { date: '2024-03-08', weightKg: 79, steps: 8000, sleepQuality: 4.5, calories: 2300 },
];

describe('buildChartData', () => {
  it('produces one point per day in the window', () => {
    expect(buildChartData(ENTRIES, REFERENCE, 8)).toHaveLength(8);
  });

  it('ends on the reference date', () => {
    const data = buildChartData(ENTRIES, REFERENCE, 8);
    expect(data.at(-1)!.date).toBe(REFERENCE);
  });

  it('fills gaps with null instead of dropping days', () => {
    const data = buildChartData(ENTRIES, REFERENCE, 8);
    expect(data.find((point) => point.date === '2024-03-02')!.weightKg).toBeNull();
  });

  it('places logged values on the right dates', () => {
    const data = buildChartData(ENTRIES, REFERENCE, 8);
    expect(data[0]!.weightKg).toBe(80);
    expect(data[2]!.weightKg).toBe(79.5);
    expect(data.at(-1)!.weightKg).toBe(79);
  });

  it('ignores entries outside the window', () => {
    const data = buildChartData(
      [...ENTRIES, { date: '2024-01-01', weightKg: 999 }],
      REFERENCE,
      8,
    );
    expect(data.some((point) => point.weightKg === 999)).toBe(false);
  });

  it('adds a rolling average only once the window is full', () => {
    const data = buildChartData(ENTRIES, REFERENCE, 8);
    // The first logged weight is on day 0, so day 6 is the first full window.
    expect(data[0]!.weightAvg7).toBeNull();
    expect(data[5]!.weightAvg7).toBeNull();
    expect(data[6]!.weightAvg7).not.toBeNull();
  });

  it('averages only the logged values inside the rolling window', () => {
    const data = buildChartData(ENTRIES, REFERENCE, 8);
    // The 7-day window ending on the reference date (Mar 8) covers Mar 2-8 and
    // holds only 79.5 (Mar 3) and 79 (Mar 8); Mar 1's 80 falls outside it.
    expect(data.at(-1)!.weightAvg7).toBeCloseTo((79.5 + 79) / 2, 10);
  });

  it('averages every logged value once they all fall inside the rolling window', () => {
    // The rolling window is fixed at 7 days regardless of how long the chart
    // is, so a value logged on Mar 1 never reaches the average on Mar 8.
    const dense: DailyEntry[] = [
      { date: '2024-03-03', weightKg: 80 },
      { date: '2024-03-05', weightKg: 79.5 },
      { date: '2024-03-08', weightKg: 79 },
    ];
    const data = buildChartData(dense, REFERENCE, 30);
    expect(data.at(-1)!.weightAvg7).toBeCloseTo((80 + 79.5 + 79) / 3, 10);
  });

  it('keeps a rolling average null when the window has no data', () => {
    const data = buildChartData([{ date: '2024-03-01', weightKg: 80 }], REFERENCE, 8);
    expect(data.at(-1)!.weightAvg7).toBeNull();
  });

  it('returns all nulls for an empty data set', () => {
    const data = buildChartData([], REFERENCE, 5);
    expect(data).toHaveLength(5);
    expect(data.every((point) => point.weightKg === null)).toBe(true);
  });

  it('exposes a short label and the day of month', () => {
    const data = buildChartData(ENTRIES, REFERENCE, 8);
    expect(data[0]!.label).toBe('Mar 1');
    expect(data[0]!.day).toBe(1);
  });
});

describe('CHART_KEYS', () => {
  it('maps every metric to a raw and rolling-average key', () => {
    expect(CHART_KEYS.weight).toEqual({ value: 'weightKg', average: 'weightAvg7' });
    expect(CHART_KEYS.steps).toEqual({ value: 'steps', average: 'stepsAvg7' });
    expect(CHART_KEYS.sleep).toEqual({ value: 'sleepQuality', average: 'sleepAvg7' });
    expect(CHART_KEYS.calories).toEqual({ value: 'calories', average: 'caloriesAvg7' });
  });
});

describe('paddedDomain', () => {
  it('is undefined for an all-null series', () => {
    expect(paddedDomain([null, null])).toBeUndefined();
  });

  it('is undefined for an empty series', () => {
    expect(paddedDomain([])).toBeUndefined();
  });

  it('pads below the minimum and above the maximum', () => {
    const [low, high] = paddedDomain([10, 20]) as [number, number];
    expect(low).toBeLessThan(10);
    expect(high).toBeGreaterThan(20);
  });

  it('keeps the observed range inside the domain', () => {
    const [low, high] = paddedDomain([100, 200, 300]) as [number, number];
    expect(low).toBeLessThanOrEqual(100);
    expect(high).toBeGreaterThanOrEqual(300);
  });

  it('handles a flat series without collapsing the axis', () => {
    const [low, high] = paddedDomain([50, 50, 50]) as [number, number];
    expect(low).toBeLessThan(50);
    expect(high).toBeGreaterThan(50);
  });

  it('handles zero values', () => {
    const [low, high] = paddedDomain([0, 0]) as [number, number];
    expect(low).toBeLessThan(0);
    expect(high).toBeGreaterThan(0);
  });

  it('keeps a nearby anchor inside the domain', () => {
    // Recharts discards a reference line outside the domain, so a goal just
    // under the data has to stay visible.
    const [low, high] = paddedDomain([100, 110], 0.15, [95]) as [number, number];
    expect(low).toBeLessThanOrEqual(95);
    expect(high).toBeGreaterThanOrEqual(110);
  });

  it('ignores an anchor far outside the data', () => {
    const without = paddedDomain([100, 110]) as [number, number];
    const withFarAnchor = paddedDomain([100, 110], 0.15, [60]) as [number, number];
    expect(withFarAnchor).toEqual(without);
  });

  it('ignores non-numeric anchors', () => {
    const without = paddedDomain([100, 110]) as [number, number];
    expect(paddedDomain([100, 110], 0.15, [null, undefined, Number.NaN])).toEqual(without);
  });

  it('is undefined for an all-null series even with anchors', () => {
    expect(paddedDomain([null, null], 0.15, [100])).toBeUndefined();
  });
});

describe('isEmptySeries', () => {
  it('is true when every value is null', () => {
    expect(isEmptySeries([null, null])).toBe(true);
    expect(isEmptySeries([])).toBe(true);
  });

  it('is false when any value is present', () => {
    expect(isEmptySeries([null, 0])).toBe(false);
    expect(isEmptySeries([12])).toBe(false);
  });
});

describe('metricValues', () => {
  it('pulls the matching field out of chart points', () => {
    const data = buildChartData(ENTRIES, REFERENCE, 8);
    const values = metricValues(data, 'weight');
    expect(values).toHaveLength(8);
    expect(values.filter((value) => value !== null)).toHaveLength(3);
  });

  it('returns nulls when the metric is not logged', () => {
    const data = buildChartData([{ date: REFERENCE, weightKg: 80 }], REFERENCE, 3);
    expect(metricValues(data, 'calories').every((value) => value === null)).toBe(true);
  });
});