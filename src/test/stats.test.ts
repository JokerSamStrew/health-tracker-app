import { describe, expect, it } from 'vitest';
import {
  clamp,
  coefficientOfVariation,
  compact,
  formatMetric,
  formatNumber,
  formatSigned,
  isFiniteNumber,
  linearRegression,
  max,
  mean,
  median,
  min,
  movingAverage,
  pearsonCorrelation,
  percentile,
  round,
  stdDev,
  sum,
  variationRatio,
} from '../lib/stats.ts';

describe('compact', () => {
  it('drops null, undefined and non-finite values', () => {
    expect(compact([1, null, undefined, Number.NaN, Infinity, 2])).toEqual([1, 2]);
  });

  it('returns an empty array for empty input', () => {
    expect(compact([])).toEqual([]);
  });
});

describe('isFiniteNumber', () => {
  it('rejects NaN and Infinity', () => {
    expect(isFiniteNumber(Number.NaN)).toBe(false);
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber(-Infinity)).toBe(false);
  });

  it('accepts finite numbers including zero', () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(-3.5)).toBe(true);
  });

  it('rejects non-numbers', () => {
    expect(isFiniteNumber('5')).toBe(false);
    expect(isFiniteNumber(null)).toBe(false);
    expect(isFiniteNumber({})).toBe(false);
  });
});

describe('sum', () => {
  it('adds values', () => {
    expect(sum([1, 2, 3])).toBe(6);
  });

  it('is 0 for an empty array', () => {
    expect(sum([])).toBe(0);
  });
});

describe('mean', () => {
  it('averages values', () => {
    expect(mean([2, 4, 6])).toBe(4);
  });

  it('returns null for an empty array', () => {
    expect(mean([])).toBeNull();
  });
});

describe('median', () => {
  it('returns the middle value for an odd count', () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it('averages the two middle values for an even count', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('does not mutate the input', () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });

  it('returns null for an empty array', () => {
    expect(median([])).toBeNull();
  });
});

describe('min / max', () => {
  it('finds the extremes', () => {
    expect(min([4, -2, 7])).toBe(-2);
    expect(max([4, -2, 7])).toBe(7);
  });

  it('returns null for an empty array', () => {
    expect(min([])).toBeNull();
    expect(max([])).toBeNull();
  });

  it('handles a single value', () => {
    expect(min([9])).toBe(9);
    expect(max([9])).toBe(9);
  });
});

describe('stdDev', () => {
  it('is 0 for a single sample', () => {
    expect(stdDev([42])).toBe(0);
  });

  it('is 0 for identical values', () => {
    expect(stdDev([7, 7, 7])).toBe(0);
  });

  it('computes the population standard deviation', () => {
    // Population (not sample) standard deviation of [2,4,4,4,5,5,7,9] is 2.
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
  });

  it('returns null for an empty array', () => {
    expect(stdDev([])).toBeNull();
  });
});

describe('coefficientOfVariation / variationRatio', () => {
  it('is 0 for constant values', () => {
    expect(coefficientOfVariation([5, 5, 5])).toBe(0);
  });

  it('matches stdDev / mean as a percentage', () => {
    const values = [10, 12, 8, 10];
    const expected = ((stdDev(values)! / mean(values)!) * 100);
    expect(coefficientOfVariation(values)).toBeCloseTo(expected, 10);
  });

  it('returns null when the mean is 0', () => {
    expect(coefficientOfVariation([-2, 2])).toBeNull();
    expect(variationRatio(0, 4)).toBeNull();
  });

  it('returns null when either input is null', () => {
    expect(variationRatio(null, 4)).toBeNull();
    expect(variationRatio(4, null)).toBeNull();
  });

  it('uses the absolute mean so negative values stay positive', () => {
    expect(variationRatio(-10, 5)).toBe(50);
  });
});

describe('percentile', () => {
  it('returns the median at p=50', () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
  });

  it('returns the minimum at p=0 and maximum at p=100', () => {
    expect(percentile([1, 2, 3, 4, 5], 0)).toBe(1);
    expect(percentile([1, 2, 3, 4, 5], 100)).toBe(5);
  });

  it('interpolates between values', () => {
    // index = 0.25 * 3 = 0.75 -> between 1 and 2
    expect(percentile([1, 2, 3, 4], 25)).toBeCloseTo(1.75, 10);
  });

  it('clamps p outside 0-100', () => {
    expect(percentile([1, 2, 3], -50)).toBe(1);
    expect(percentile([1, 2, 3], 500)).toBe(3);
  });

  it('returns null for an empty array', () => {
    expect(percentile([], 50)).toBeNull();
  });
});

describe('linearRegression', () => {
  it('recovers a known slope and intercept', () => {
    const points = [0, 1, 2, 3].map((x) => ({ x, y: 3 * x + 7 }));
    const result = linearRegression(points)!;
    expect(result.slope).toBeCloseTo(3, 10);
    expect(result.intercept).toBeCloseTo(7, 10);
    expect(result.r2).toBeCloseTo(1, 10);
  });

  it('reports a negative slope for a falling series', () => {
    const result = linearRegression([
      { x: 0, y: 10 },
      { x: 1, y: 9 },
      { x: 2, y: 8 },
    ])!;
    expect(result.slope).toBeCloseTo(-1, 10);
  });

  it('is 0 for a flat series', () => {
    const result = linearRegression([
      { x: 0, y: 5 },
      { x: 1, y: 5 },
    ])!;
    expect(result.slope).toBe(0);
    expect(result.r2).toBe(0);
  });

  it('returns null for fewer than two points', () => {
    expect(linearRegression([])).toBeNull();
    expect(linearRegression([{ x: 1, y: 1 }])).toBeNull();
  });

  it('returns null when all x are identical (undefined slope)', () => {
    expect(
      linearRegression([
        { x: 3, y: 1 },
        { x: 3, y: 2 },
      ]),
    ).toBeNull();
  });

  it('gives r2 in [0,1] for noisy data', () => {
    const result = linearRegression([
      { x: 0, y: 1 },
      { x: 1, y: 5 },
      { x: 2, y: 2 },
      { x: 3, y: 8 },
    ])!;
    expect(result.r2).toBeGreaterThanOrEqual(0);
    expect(result.r2).toBeLessThanOrEqual(1);
  });
});

describe('pearsonCorrelation', () => {
  it('is 1 for a perfectly linear relationship', () => {
    expect(pearsonCorrelation([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 10);
  });

  it('is -1 for an inversely linear relationship', () => {
    expect(pearsonCorrelation([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 10);
  });

  it('is 0 when there is no linear relationship', () => {
    // Centred around zero mean with no linear trend.
    expect(pearsonCorrelation([-1, 0, 1], [-1, 1, -1])).toBeCloseTo(0, 10);
  });

  it('is positive for a moderately rising pair', () => {
    expect(pearsonCorrelation([1, 2, 3, 4, 5], [2, 1, 4, 3, 5])).toBeGreaterThan(0);
  });

  it('returns null when there are fewer than two pairs', () => {
    expect(pearsonCorrelation([1], [2])).toBeNull();
  });

  it('returns null when a series is constant', () => {
    expect(pearsonCorrelation([1, 1, 1], [1, 2, 3])).toBeNull();
  });

  it('uses the shorter of the two series', () => {
    expect(pearsonCorrelation([1, 2, 3, 4], [1, 2, 3])).toBeCloseTo(1, 10);
  });
});

describe('movingAverage', () => {
  it('returns null until the window is full', () => {
    expect(movingAverage([1, 2, 3], 3)).toEqual([null, null, 2]);
  });

  it('averages each full window', () => {
    expect(movingAverage([2, 4, 6, 8], 2)).toEqual([null, 3, 5, 7]);
  });

  it('handles a window of 1 as identity', () => {
    expect(movingAverage([1, 2, 3], 1)).toEqual([1, 2, 3]);
  });

  it('skips gaps inside the window', () => {
    // Last window is [null, 6] -> mean of the only finite value.
    expect(movingAverage([null, null, 6], 2)).toEqual([null, null, 6]);
  });

  it('returns all nulls for an empty series', () => {
    expect(movingAverage([], 3)).toEqual([]);
  });

  it('throws for a non-positive window size', () => {
    expect(() => movingAverage([1, 2], 0)).toThrow(RangeError);
    expect(() => movingAverage([1, 2], -1)).toThrow(RangeError);
  });
});

describe('clamp', () => {
  it('bounds values on both sides', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('round', () => {
  it('rounds to the requested decimals', () => {
    expect(round(1.2345, 2)).toBe(1.23);
    expect(round(1.2355, 2)).toBe(1.24);
    expect(round(10)).toBe(10);
  });

  it('never returns negative zero', () => {
    expect(round(-0.0001, 2)).toBe(0);
    expect(Object.is(round(-0.0001, 2), -0)).toBe(false);
  });

  it('passes through non-finite values', () => {
    expect(round(Number.NaN)).toBeNaN();
    expect(round(Infinity)).toBe(Infinity);
  });
});

describe('formatNumber / formatMetric / formatSigned', () => {
  it('groups thousands', () => {
    expect(formatNumber(12345)).toBe('12,345');
  });

  it('renders a fixed number of decimals', () => {
    expect(formatNumber(1234.5, 1)).toBe('1,234.5');
  });

  it('renders a dash for missing values', () => {
    expect(formatMetric(null)).toBe('—');
    expect(formatMetric(undefined)).toBe('—');
    expect(formatMetric(Number.NaN)).toBe('—');
  });

  it('adds an explicit plus sign for positive changes', () => {
    expect(formatSigned(1.5, 1)).toBe('+1.5');
    expect(formatSigned(-1.5, 1)).toBe('-1.5');
    expect(formatSigned(0, 1)).toBe('0.0');
  });

  it('renders a dash for missing signed values', () => {
    expect(formatSigned(null)).toBe('—');
  });
});