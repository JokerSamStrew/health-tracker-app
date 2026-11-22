/**
 * Turns a goal deadline into the weekly pace each metric needs.
 *
 * The profile may carry a date by which the goals should be met. This module
 * divides the distance from each metric's latest logged value by the number of
 * days left, so the UI can show a concrete "change this much per week" pace
 * instead of a distant target with no route to it. It also compares that pace
 * with the observed trend in the same window and, for weight, with the safe
 * weekly pace.
 *
 * Pure by construction: dates and summaries are passed in, nothing reads the
 * clock, and a missing goal, baseline or future date yields no plan rather
 * than a guessed one. The requested pace is not capped — a tight deadline is
 * shown as demanding, not silently rewritten.
 */

import { daysBetween, isValidISODate } from './date.ts';
import { SAFE_PACE_KG_PER_WEEK } from './health.ts';
import { METRIC_UNITS } from '../types.ts';
import type { MetricKey, MetricSummary, Profile } from '../types.ts';

/** A trend this flat counts as "no movement" when the goal is already met. */
const MAINTENANCE_EPSILON = 1e-6;

type GoalField =
  | 'targetWeightKg'
  | 'dailyStepGoal'
  | 'sleepGoalQuality'
  | 'activityGoalRating'
  | 'dailyCalorieGoal';

const GOAL_FIELDS: readonly { key: MetricKey; field: GoalField }[] = [
  { key: 'weight', field: 'targetWeightKg' },
  { key: 'steps', field: 'dailyStepGoal' },
  { key: 'sleep', field: 'sleepGoalQuality' },
  { key: 'activity', field: 'activityGoalRating' },
  { key: 'calories', field: 'dailyCalorieGoal' },
];

/** The weekly route from one metric's latest value to its goal. */
export interface GoalPlanMetric {
  key: MetricKey;
  unit: string;
  goal: number;
  latest: number;
  /** Signed distance still to travel: `goal - latest`. */
  gap: number;
  /** Signed weekly change that reaches the goal on the deadline. */
  requiredPerWeek: number;
  /** Observed weekly trend in the analysed window, when there is one. */
  observedPerWeek: number | null;
  /** `null` when no observed trend exists to compare with. */
  onTrack: boolean | null;
  /** Weight only: the requested pace is faster than is normally advised. */
  exceedsSafePace: boolean;
}

export interface GoalPlan {
  date: string;
  /** Whole days from the reference date to `date`. Always positive. */
  daysLeft: number;
  /** Only metrics with both a goal and a latest logged value appear here. */
  metrics: GoalPlanMetric[];
}

/**
 * Builds the per-metric weekly pace implied by `profile.goalDate`.
 *
 * Returns `null` when the deadline is missing, invalid or not in the future.
 * Metrics with no explicit goal or no logged baseline are left out; callers
 * can still show the plan's date and explain which goals are missing.
 */
export function buildGoalPlan(
  profile: Profile,
  summaries: Record<MetricKey, MetricSummary>,
  referenceDate: string,
): GoalPlan | null {
  const date = profile.goalDate;
  if (date === undefined || !isValidISODate(date)) return null;

  const daysLeft = daysBetween(referenceDate, date);
  if (daysLeft === null || daysLeft <= 0) return null;

  const metrics: GoalPlanMetric[] = [];
  for (const { key, field } of GOAL_FIELDS) {
    const goal = profile[field];
    const { latest, trendPerWeek } = summaries[key];
    if (goal === undefined || !Number.isFinite(goal)) continue;
    if (latest === null || !Number.isFinite(latest)) continue;

    const gap = goal - latest;
    const requiredPerWeek = (gap / daysLeft) * 7;
    const observedPerWeek = trendPerWeek;

    let onTrack: boolean | null = null;
    if (observedPerWeek !== null) {
      onTrack =
        Math.abs(requiredPerWeek) < MAINTENANCE_EPSILON
          ? Math.abs(observedPerWeek) < MAINTENANCE_EPSILON
          : Math.sign(observedPerWeek) === Math.sign(requiredPerWeek) &&
            Math.abs(observedPerWeek) >= Math.abs(requiredPerWeek);
    }

    metrics.push({
      key,
      unit: METRIC_UNITS[key],
      goal,
      latest,
      gap,
      requiredPerWeek,
      observedPerWeek,
      onTrack,
      exceedsSafePace: key === 'weight' && Math.abs(requiredPerWeek) > SAFE_PACE_KG_PER_WEEK,
    });
  }

  return { date, daysLeft, metrics };
}
