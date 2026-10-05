import { describe, expect, it } from 'vitest';
import { buildSeries, isEmptyEntry, mergeEntries, metricSeries, metricTotal, sortEntries, summarizeAll, summarizeMetric } from '../lib/series.ts';
import type { DailyEntry } from '../types.ts';

const UNSORTED: DailyEntry[] = [
  { date: '2024-03-03', steps: 9000 },
  { date: '2024-03-01', steps: 8000, weightKg: 80 },
  { date: '2024-03-02', steps: 8500 },
];

describe('sortEntries', () => {
  it('orders by date ascending', () => {
    expect(sortEntries(UNSORTED).map((entry) => entry.date)).toEqual([
      '2024-03-01',
      '2024-03-02',
      '2024-03-03',
    ]);
  });

  it('does not mutate the input array', () => {
    const input = [...UNSORTED];
    sortEntries(input);
    expect(input.map((entry) => entry.date)).toEqual(['2024-03-03', '2024-03-01', '2024-03-02']);
  });

  it('handles an empty array', () => {
    expect(sortEntries([])).toEqual([]);
  });
});

describe('mergeEntries', () => {
  it('adds a new date', () => {
    const merged = mergeEntries([], [{ date: '2024-03-01', steps: 5000 }]);
    expect(merged).toEqual([{ date: '2024-03-01', steps: 5000 }]);
  });

  it('replaces a value for an existing date', () => {
    const merged = mergeEntries(
      [{ date: '2024-03-01', steps: 5000 }],
      [{ date: '2024-03-01', steps: 9000 }],
    );
    expect(merged).toEqual([{ date: '2024-03-01', steps: 9000 }]);
  });

  it('keeps untouched fields when merging partially', () => {
    const merged = mergeEntries(
      [{ date: '2024-03-01', steps: 5000, weightKg: 80 }],
      [{ date: '2024-03-01', weightKg: 79.5 }],
    );
    expect(merged).toEqual([{ date: '2024-03-01', steps: 5000, weightKg: 79.5 }]);
  });

  it('does not wipe a field set to undefined', () => {
    const merged = mergeEntries(
      [{ date: '2024-03-01', steps: 5000 }],
      [{ date: '2024-03-01', steps: undefined }],
    );
    expect(merged[0]!.steps).toBe(5000);
  });

  it('collapses duplicates within the incoming batch', () => {
    const merged = mergeEntries([], [
      { date: '2024-03-01', steps: 1 },
      { date: '2024-03-01', steps: 2 },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.steps).toBe(2);
  });

  it('returns sorted output', () => {
    const merged = mergeEntries([], [
      { date: '2024-03-05', steps: 1 },
      { date: '2024-03-01', steps: 2 },
    ]);
    expect(merged.map((entry) => entry.date)).toEqual(['2024-03-01', '2024-03-05']);
  });

  it('does not mutate the existing array', () => {
    const existing = [{ date: '2024-03-01', steps: 5000 }];
    mergeEntries(existing, [{ date: '2024-03-01', steps: 1 }]);
    expect(existing[0]!.steps).toBe(5000);
  });
});

describe('isEmptyEntry', () => {
  it('is true when nothing was measured', () => {
    expect(isEmptyEntry({ date: '2024-03-01' })).toBe(true);
  });

  it('is false when any metric is present', () => {
    expect(isEmptyEntry({ date: '2024-03-01', steps: 0 })).toBe(false);
    expect(isEmptyEntry({ date: '2024-03-01', weightKg: 0 })).toBe(false);
  });

  it('is false when only a note is present', () => {
    expect(isEmptyEntry({ date: '2024-03-01', note: 'sick' })).toBe(false);
  });
});

describe('metricSeries', () => {
  it('extracts finite values in date order', () => {
    expect(metricSeries(UNSORTED, 'steps')).toEqual([8000, 8500, 9000]);
  });

  it('ignores days where the metric is missing', () => {
    expect(metricSeries(UNSORTED, 'weight')).toEqual([80]);
  });

  it('ignores non-finite values', () => {
    const entries: DailyEntry[] = [{ date: '2024-03-01', steps: Number.NaN }];
    expect(metricSeries(entries, 'steps')).toEqual([]);
  });

  it('is empty when nothing is logged', () => {
    expect(metricSeries([], 'calories')).toEqual([]);
  });
});

describe('buildSeries', () => {
  it('fills gaps with null so the axis stays even', () => {
    const series = buildSeries(UNSORTED, 'steps', '2024-03-01', '2024-03-04');
    expect(series).toEqual([
      { date: '2024-03-01', value: 8000 },
      { date: '2024-03-02', value: 8500 },
      { date: '2024-03-03', value: 9000 },
      { date: '2024-03-04', value: null },
    ]);
  });

  it('is inclusive of both bounds', () => {
    expect(buildSeries([], 'steps', '2024-03-01', '2024-03-03')).toHaveLength(3);
  });

  it('returns an empty array when end precedes start', () => {
    expect(buildSeries([], 'steps', '2024-03-04', '2024-03-01')).toEqual([]);
  });

  it('returns an empty array for an invalid window', () => {
    expect(buildSeries([], 'steps', 'bad', '2024-03-01')).toEqual([]);
  });
});

describe('summarizeMetric', () => {
  const entries: DailyEntry[] = [
    { date: '2024-03-01', weightKg: 80 },
    { date: '2024-03-02', weightKg: 79.5 },
    { date: '2024-03-03', weightKg: 79 },
    { date: '2024-03-04' },
  ];

  it('computes count, latest, previous and change', () => {
    const summary = summarizeMetric(entries, 'weight');
    expect(summary.count).toBe(3);
    expect(summary.latest).toBe(79);
    expect(summary.previous).toBe(79.5);
    expect(summary.change).toBeCloseTo(-1, 10);
  });

  it('computes descriptive statistics', () => {
    const summary = summarizeMetric(entries, 'weight');
    expect(summary.average).toBeCloseTo((80 + 79.5 + 79) / 3, 10);
    expect(summary.median).toBe(79.5);
    expect(summary.min).toBe(79);
    expect(summary.max).toBe(80);
    expect(summary.stdDev).not.toBeNull();
  });

  it('reports a negative weekly trend for a falling series', () => {
    const summary = summarizeMetric(entries, 'weight', { windowStart: '2024-03-01' });
    expect(summary.trendPerWeek!).toBeLessThan(0);
  });

  it('has no trend when the window start is unknown (all x equal)', () => {
    expect(summarizeMetric(entries, 'weight').trendPerWeek).toBeNull();
  });

  it('reports change as null with a single value', () => {
    const summary = summarizeMetric([{ date: '2024-03-01', weightKg: 80 }], 'weight');
    expect(summary.count).toBe(1);
    expect(summary.change).toBeNull();
    expect(summary.previous).toBeNull();
    expect(summary.trendPerWeek).toBeNull();
  });

  it('is all null for an empty metric', () => {
    const summary = summarizeMetric(entries, 'steps');
    expect(summary.count).toBe(0);
    expect(summary.latest).toBeNull();
    expect(summary.average).toBeNull();
    expect(summary.change).toBeNull();
    expect(summary.trendPerWeek).toBeNull();
  });

  it('exposes the unit', () => {
    expect(summarizeMetric(entries, 'weight').unit).toBe('kg');
    expect(summarizeMetric(entries, 'sleep').unit).toBe('h');
    expect(summarizeMetric(entries, 'calories').unit).toBe('kcal');
    expect(summarizeMetric(entries, 'steps').unit).toBe('steps');
  });

  it('scales the trend per week using the window start as day 0', () => {
    const summary = summarizeMetric(entries, 'weight', { windowStart: '2024-03-01' });
    // -0.5 kg per day -> -3.5 kg per week.
    expect(summary.trendPerWeek).toBeCloseTo(-3.5, 5);
  });
});

describe('summarizeAll', () => {
  it('returns a summary for every metric', () => {
    const summaries = summarizeAll(UNSORTED, '2024-03-01');
    expect(Object.keys(summaries).sort()).toEqual(['calories', 'sleep', 'steps', 'weight']);
  });

  it('excludes entries before the window start', () => {
    const entries: DailyEntry[] = [
      { date: '2024-02-28', steps: 100 },
      { date: '2024-03-02', steps: 9000 },
    ];
    expect(summarizeAll(entries, '2024-03-01').steps.count).toBe(1);
  });
});

describe('metricTotal', () => {
  it('sums an additive metric', () => {
    expect(metricTotal(UNSORTED, 'steps')).toBe(25500);
  });

  it('is 0 when nothing is logged', () => {
    expect(metricTotal([], 'calories')).toBe(0);
  });
});