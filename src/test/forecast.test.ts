import { describe, expect, it } from 'vitest';
import { addDays } from '../lib/date.ts';
import { FORECAST_LIMITS, forecastWeightGoal, lastWeighInDate } from '../lib/forecast.ts';
import { summarizeAll } from '../lib/series.ts';
import type { DailyEntry } from '../types.ts';

const REFERENCE = '2024-03-14';
const WINDOW_DAYS = 14;
const WINDOW_START = addDays(REFERENCE, -(WINDOW_DAYS - 1));

/** One weight per day across the whole window, changing by `perDay` kg. */
function makeWeights(perDay: number, start = 80): DailyEntry[] {
  return Array.from({ length: WINDOW_DAYS }, (_, i) => ({
    date: addDays(WINDOW_START, i),
    weightKg: start + perDay * i,
  }));
}

function summarize(entries: DailyEntry[]): ReturnType<typeof summarizeAll> {
  return summarizeAll(entries, WINDOW_START);
}

describe('forecastWeightGoal', () => {
  it('projects a steady loss onto days and a calendar date', () => {
    // -0.1 kg/day = -0.7 kg/week; the latest weigh-in is 78.7 kg and the
    // target 75 kg sits 3.7 kg away: 3.7 / 0.7 * 7 = 37 days.
    const forecast = forecastWeightGoal({ targetWeightKg: 75 }, summarize(makeWeights(-0.1)), REFERENCE);
    expect(forecast).not.toBeNull();
    expect(forecast!.daysToGoal).toBe(37);
    expect(forecast!.projectedDate).toBe('2024-04-20');
    expect(forecast!.gapKg).toBeCloseTo(-3.7, 10);
    expect(forecast!.trendKgPerWeek).toBeCloseTo(-0.7, 10);
  });

  it('projects a gain towards a higher target', () => {
    // +0.2 kg/day = +1.4 kg/week; latest 80.6 kg, target 85 kg: 22 days.
    const forecast = forecastWeightGoal({ targetWeightKg: 85 }, summarize(makeWeights(0.2, 78)), REFERENCE);
    expect(forecast!.daysToGoal).toBe(22);
    expect(forecast!.projectedDate).toBe('2024-04-05');
    expect(forecast!.gapKg).toBeCloseTo(4.4, 10);
  });

  it('rounds fractional days up to the first day at or past the target', () => {
    // -0.15 kg/day: latest 78.05 kg, 3.05 kg gap at 1.05 kg/week
    // is 20.33 days, so the arrival is day 21.
    const forecast = forecastWeightGoal({ targetWeightKg: 75 }, summarize(makeWeights(-0.15)), REFERENCE);
    expect(forecast!.daysToGoal).toBe(21);
    expect(forecast!.projectedDate).toBe('2024-04-04');
  });

  it('counts the days from the anchor date it is given', () => {
    // Same series as the 37-day case, counted from a week later.
    const forecast = forecastWeightGoal(
      { targetWeightKg: 75 },
      summarize(makeWeights(-0.1)),
      '2024-03-21',
    );
    expect(forecast!.daysToGoal).toBe(37);
    expect(forecast!.projectedDate).toBe('2024-04-27');
  });

  it('projects up to the horizon but not past it', () => {
    // -0.01 kg/day = -0.07 kg/week: above the noise floor but slow. A 7.3 kg
    // gap lands exactly on the 730-day horizon; a 19.87 kg gap runs past it.
    const slowLoss = summarize(makeWeights(-0.01));
    const atHorizon = forecastWeightGoal(
      { targetWeightKg: 72.57 },
      slowLoss,
      REFERENCE,
    );
    expect(atHorizon!.daysToGoal).toBe(FORECAST_LIMITS.maxHorizonDays);

    const beyondHorizon = forecastWeightGoal({ targetWeightKg: 60 }, slowLoss, REFERENCE);
    expect(beyondHorizon).toBeNull();
  });

  it('returns null without a target weight', () => {
    expect(forecastWeightGoal({}, summarize(makeWeights(-0.1)), REFERENCE)).toBeNull();
  });

  it('returns null for a non-finite target weight', () => {
    expect(
      forecastWeightGoal({ targetWeightKg: Number.NaN }, summarize(makeWeights(-0.1)), REFERENCE),
    ).toBeNull();
  });

  it('returns null below the trend data threshold', () => {
    const few = Array.from({ length: 3 }, (_, i) => ({
      date: addDays(WINDOW_START, i),
      weightKg: 80 - 0.2 * i,
    }));
    expect(forecastWeightGoal({ targetWeightKg: 75 }, summarize(few), REFERENCE)).toBeNull();
  });

  it('returns null when the trend is flat', () => {
    expect(forecastWeightGoal({ targetWeightKg: 75 }, summarize(makeWeights(0)), REFERENCE)).toBeNull();
  });

  it('returns null when the trend moves away from the target', () => {
    // Losing weight while the target sits above: no arrival date exists.
    expect(forecastWeightGoal({ targetWeightKg: 85 }, summarize(makeWeights(-0.1)), REFERENCE)).toBeNull();
    // And the mirror image: gaining while the target sits below.
    expect(forecastWeightGoal({ targetWeightKg: 75 }, summarize(makeWeights(0.1)), REFERENCE)).toBeNull();
  });
});

describe('lastWeighInDate', () => {
  it('finds the newest entry that carries a weight', () => {
    const entries: DailyEntry[] = [
      { date: '2024-03-05' },
      { date: '2024-03-02', weightKg: 80 },
      { date: '2024-03-03', weightKg: 79 },
    ];
    expect(lastWeighInDate(entries)).toBe('2024-03-03');
  });

  it('returns null when no entry carries a weight', () => {
    expect(lastWeighInDate([{ date: '2024-03-02', steps: 9000 }])).toBeNull();
    expect(lastWeighInDate([])).toBeNull();
  });

  it('ignores non-finite weights', () => {
    // Sanitized storage never yields these, but the helper stays defensive.
    const entries: DailyEntry[] = [
      { date: '2024-03-02', weightKg: Number.NaN },
      { date: '2024-03-01', weightKg: 80 },
    ];
    expect(lastWeighInDate(entries)).toBe('2024-03-01');
  });
});

describe('FORECAST_LIMITS', () => {
  it('exposes the limits the forecast is bounded by', () => {
    expect(FORECAST_LIMITS.minTrendKgPerWeek).toBeGreaterThan(0);
    expect(FORECAST_LIMITS.maxHorizonDays).toBeGreaterThan(0);
  });
});
