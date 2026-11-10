/**
 * The goal health score.
 *
 * Answers one question: if every goal in the profile were met, what score
 * would the report show? Rather than a second scoring formula that could
 * drift out of sync with the rules, it simulates a window in which every
 * metric sits exactly on its goal and runs the real `analyzeHealth` over it.
 *
 * A goal score below 100 is informative, not a bug: it means the goals
 * disagree with each other - a target weight outside the healthy BMI band,
 * or a calorie goal far from the estimated burn at that weight - and
 * `limiting` carries the insights that explain the cap.
 *
 * Pure like the rest of `lib/`: the reference date and window length come in
 * as arguments, and nothing here reads the clock or storage.
 */

import { addDays, ageFromBirthDate, toISODate } from './date.ts';
import { totalDailyEnergyExpenditure } from './health.ts';
import { analyzeHealth, DEFAULT_WINDOW_DAYS, type AnalyzeOptions } from './insights.ts';
import type { DailyEntry, Insight, MetricKey, MetricSummary, Profile } from '../types.ts';

/** The per-metric values the simulation assumes, exposed for display. */
export interface GoalTargets {
  /**
   * The target weight when one is set; otherwise the latest logged weight
   * held steady, since without a target the only weight goal is "stay where
   * you are". `null` when neither exists.
   */
  weightKg: number | null;
  steps: number;
  sleepQuality: number;
  activityRating: number;
  /**
   * The explicit calorie goal, or the estimated maintenance at `weightKg` -
   * mirroring how `ruleCalorieBalance` picks its target. `null` when neither
   * can be derived.
   */
  calories: number | null;
}

export interface GoalHealthScore {
  /**
   * Score the report would show with every metric on its goal. `null` when
   * the window is too short to score even a perfect log.
   */
  score: number | null;
  targets: GoalTargets;
  /**
   * The warning and critical insights that still fire in that state - the
   * reasons the score is below 100. Empty when it is not.
   */
  limiting: Insight[];
}

export function goalHealthScore(
  profile: Profile,
  summaries: Record<MetricKey, MetricSummary>,
  options: AnalyzeOptions = {},
): GoalHealthScore {
  const referenceDate = options.referenceDate ?? toISODate(new Date());
  const windowDays = Math.max(1, options.windowDays ?? DEFAULT_WINDOW_DAYS);
  const age = ageFromBirthDate(profile.birthDate ?? '', referenceDate);

  const weightKg = profile.targetWeightKg ?? summaries.weight.latest ?? null;
  const burn = weightKg === null ? null : totalDailyEnergyExpenditure(profile, weightKg, age);
  const calories = profile.dailyCalorieGoal ?? burn ?? null;

  // The same goal defaults the rules fall back to, so the simulation and the
  // analysis can never disagree about what "on goal" means.
  const targets: GoalTargets = {
    weightKg,
    steps: profile.dailyStepGoal ?? 8000,
    sleepQuality: profile.sleepGoalQuality ?? 4,
    activityRating: profile.activityGoalRating ?? 3,
    calories,
  };

  const simulated: DailyEntry[] = [];
  for (let i = 0; i < windowDays; i += 1) {
    const entry: DailyEntry = {
      date: addDays(referenceDate, -(windowDays - 1) + i),
      steps: targets.steps,
      sleepQuality: targets.sleepQuality,
      activityRating: targets.activityRating,
    };
    // Metrics with no derivable goal are left out rather than invented, so
    // the missing-metric insight reports them instead of a fake value.
    if (targets.weightKg !== null) entry.weightKg = targets.weightKg;
    if (targets.calories !== null) entry.calories = targets.calories;
    simulated.push(entry);
  }

  const report = analyzeHealth(simulated, profile, { referenceDate, windowDays });

  return {
    score: report.score,
    targets,
    limiting: report.insights.filter(
      (insight) => insight.severity === 'critical' || insight.severity === 'warning',
    ),
  };
}
