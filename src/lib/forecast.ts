/**
 * Weight-goal forecasting.
 *
 * Extends the observed weight trend into the future to answer two questions:
 * how many days it takes to reach the profile's target weight, and on which
 * calendar date that lands. Pure like the rest of `lib/`: the trend comes from
 * a summary computed elsewhere and the countdown starts on an injected anchor
 * date, so nothing here reads the clock.
 *
 * The projection is a straight line and nothing more. It assumes the window's
 * least-squares trend continues unchanged from the latest weigh-in, which is
 * honest about what a short log can support. Callers decide how close to the
 * target still counts as "already there"; this module only does the geometry.
 */

import { addDays } from './date.ts';
import { MIN_DAYS_FOR_TREND } from './health.ts';
import { sortEntries } from './series.ts';
import type { DailyEntry, MetricKey, MetricSummary, Profile } from '../types.ts';

/** Bounds that keep a forecast from pretending to be precise. */
export const FORECAST_LIMITS = {
  /**
   * Weekly trends flatter than this are noise, so no arrival date exists.
   * Mirrors `THRESHOLDS.weightTrendNegligibleKgPerWeek` in insights.ts; keep
   * the two in sync.
   */
  minTrendKgPerWeek: 0.05,
  /** The trend line is never projected further than two years out. */
  maxHorizonDays: 730,
} as const;

/** Result of projecting the window's weight trend onto the target weight. */
export interface WeightGoalForecast {
  /** Target the line is projected towards. */
  targetKg: number;
  /** Latest logged weight in the window; the projection's anchor. */
  latestKg: number;
  /** Signed distance from `latestKg` to `targetKg`. */
  gapKg: number;
  /** Signed least-squares slope of the window, in kg per week. */
  trendKgPerWeek: number;
  /** Whole days from the anchor date until the line reaches the target. */
  daysToGoal: number;
  /** Calendar date the line reaches the target: `anchorDate + daysToGoal`. */
  projectedDate: string;
}

/** Date of the last finite weight in `entries` (any order), or `null`. */
export function lastWeighInDate(entries: readonly DailyEntry[]): string | null {
  const sorted = sortEntries(entries);
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const weight = sorted[i]!.weightKg;
    if (typeof weight === 'number' && Number.isFinite(weight)) return sorted[i]!.date;
  }
  return null;
}

/**
 * Projects the window's weight trend onto `profile.targetWeightKg`.
 *
 * Returns `null` - never a guess - when there is no target, fewer than
 * `MIN_DAYS_FOR_TREND` weigh-ins, a trend too flat to mean anything, a trend
 * pointing away from the target, or an arrival beyond `FORECAST_LIMITS`.
 */
export function forecastWeightGoal(
  profile: Profile,
  summaries: Record<MetricKey, MetricSummary>,
  anchorDate: string,
): WeightGoalForecast | null {
  const target = profile.targetWeightKg;
  const { count, latest, trendPerWeek } = summaries.weight;
  if (target === undefined || !Number.isFinite(target)) return null;
  if (count < MIN_DAYS_FOR_TREND || latest === null || trendPerWeek === null) return null;

  const gap = target - latest;
  // A trend flatter than the noise floor never gets anywhere, and a trend
  // pointing away from the target has no arrival date at all.
  if (Math.abs(trendPerWeek) < FORECAST_LIMITS.minTrendKgPerWeek) return null;
  if (Math.sign(trendPerWeek) !== Math.sign(gap)) return null;

  // kg per week -> kg per day. Gap and trend share a sign, so days are positive.
  const exactDays = (gap / trendPerWeek) * 7;
  // First whole day at or past the target; the epsilon keeps float noise
  // (56.999999999) from buying an extra day.
  const daysToGoal = Math.ceil(exactDays - 1e-6);
  if (daysToGoal > FORECAST_LIMITS.maxHorizonDays) return null;

  return {
    targetKg: target,
    latestKg: latest,
    gapKg: gap,
    trendKgPerWeek: trendPerWeek,
    daysToGoal,
    projectedDate: addDays(anchorDate, daysToGoal),
  };
}
