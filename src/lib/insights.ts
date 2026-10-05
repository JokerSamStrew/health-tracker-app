/**
 * The insight engine.
 *
 * `analyzeHealth` is a pure function: entries + profile in, report out. No
 * clock, no storage, no React. Every rule is a small standalone function so the
 * behaviour can be unit-tested rule by rule.
 *
 * Rules only fire when there is enough data to support them, and each one
 * carries the numbers it used as `evidence` so the UI can show its work.
 */

import {
  ACTIVITY_LABELS,
  MIN_DAYS_FOR_INSIGHTS,
  MIN_DAYS_FOR_TREND,
  bmi,
  bmiCategory,
  BMI_CATEGORIES,
  type BmiCategory,
  calorieTargetForGoal,
  healthyWeightRange,
  totalDailyEnergyExpenditure,
  dailyCalorieDeltaForWeightChange,
  SAFE_PACE_KG_PER_WEEK,
} from './health.ts';
import { addDays, toISODate } from './date.ts';
import {
  METRIC_DIGITS,
  METRIC_FIELD,
  sortEntries,
  summarizeAll,
} from './series.ts';
import {
  clamp,
  formatMetric,
  pearsonCorrelation,
  round,
  variationRatio,
} from './stats.ts';
import type {
  DailyEntry,
  HealthReport,
  Insight,
  MetricKey,
  MetricSummary,
  Profile,
  Recommendation,
  Severity,
} from '../types.ts';
import { METRIC_KEYS, SEVERITY_ORDER } from '../types.ts';

export const DEFAULT_WINDOW_DAYS = 14;

/**
 * Every magic number the rules rely on, in one place.
 * Values are tuned for adults without medical conditions and are not medical
 * advice - see the `Disclaimer` in the UI.
 */
export const THRESHOLDS = {
  /** Below this weekly weight change we call the weight "stable". */
  weightTrendNegligibleKgPerWeek: 0.05,
  /** Above this weekly weight change we start flagging gain/loss. */
  weightTrendSignificantKgPerWeek: 0.1,
  /** Faster loss than this is treated as too aggressive. */
  weightTrendRapidLossKgPerWeek: 0.75,
  /** Loss faster than this share of body weight per week is flagged as critical. */
  weightRapidLossBodyPercentPerWeek: 1,
  /** Distance to target that counts as "there". */
  weightGoalToleranceKg: 0.5,
  /** Sleep shorter than `goal - this` is a deficit. */
  sleepDeficitHours: 0.5,
  /** Average sleep below this many hours is severe restriction. */
  sleepSevereHours: 6,
  /** Sleeping more than `goal + this` is flagged as excessive. */
  sleepExcessHours: 1.5,
  /** Sleep coefficient of variation above this percent is "irregular". */
  sleepIrregularCvPercent: 20,
  /** Step goal ratios. */
  stepsVeryLowRatio: 0.5,
  stepsLowRatio: 0.8,
  /** Weekly change in average steps that counts as a decline / improvement. */
  stepsTrendThresholdPerWeek: 800,
  /** Intake gaps, as a share of the daily target. */
  calorieDeficitRatio: 0.2,
  calorieSevereDeficitRatio: 0.35,
  calorieSurplusRatio: 0.15,
  calorieBalanceToleranceRatio: 0.05,
  /** Calorie coefficient of variation above this percent is "erratic". */
  calorieIrregularCvPercent: 25,
  /** Intake vs. weight-change disagreement, as a share of the daily target. */
  alignmentToleranceRatio: 0.25,
  /** Logged-day coverage below this is a logging problem, not a health one. */
  coverageWarnRatio: 0.6,
} as const;

const PENALTY_BY_SEVERITY: Record<Severity, number> = {
  critical: 18,
  warning: 9,
  info: 0,
  positive: 0,
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function buildInsight(
  id: string,
  category: Insight['category'],
  severity: Severity,
  title: string,
  summary: string,
  evidence: string[],
  recommendations: Recommendation[],
): Insight {
  return { id, category, severity, title, summary, evidence, recommendations };
}

/** Severity per BMI band. Overweight is only worth a note, obesity is not. */
const BMI_SEVERITY: Record<Exclude<BmiCategory, 'healthy'>, Severity> = {
  underweight: 'warning',
  overweight: 'info',
  'obese-i': 'info',
  'obese-ii': 'warning',
  'obese-iii': 'critical',
};

function sleepGoal(profile: Profile): number {
  return profile.sleepGoalHours ?? 8;
}

function stepGoal(profile: Profile): number {
  return profile.dailyStepGoal ?? 8000;
}

function fmt(key: MetricKey, value: number | null | undefined): string {
  return formatMetric(value ?? null, METRIC_DIGITS[key]);
}

/** Weight in prose, without a trailing `.0` (`5 kg`, not `5.0 kg`). */
function formatKg(value: number): string {
  return `${formatMetric(round(value, 1), 1).replace(/\.0$/, '')}`;
}

/** Distinct dates that carry at least one metric value. */
export function daysWithData(entries: readonly DailyEntry[]): number {
  const dates = new Set<string>();
  for (const entry of entries) {
    const hasValue = METRIC_KEYS.some((key) => {
      const value = entry[METRIC_FIELD[key]];
      return typeof value === 'number' && Number.isFinite(value);
    });
    if (hasValue) dates.add(entry.date);
  }
  return dates.size;
}

/** Latest finite weight in the window, or `null`. */
export function latestWeight(summaries: Record<MetricKey, MetricSummary>): number | null {
  return summaries.weight.latest;
}

/** Pairs of (x, y) values logged on the same day. */
export function pairedValues(
  entries: readonly DailyEntry[],
  keyA: MetricKey,
  keyB: MetricKey,
): { a: number[]; b: number[]; n: number } {
  const fieldA = METRIC_FIELD[keyA];
  const fieldB = METRIC_FIELD[keyB];
  const a: number[] = [];
  const b: number[] = [];
  for (const entry of entries) {
    const valueA = entry[fieldA];
    const valueB = entry[fieldB];
    if (
      typeof valueA === 'number' &&
      Number.isFinite(valueA) &&
      typeof valueB === 'number' &&
      Number.isFinite(valueB)
    ) {
      a.push(valueA);
      b.push(valueB);
    }
  }
  return { a, b, n: a.length };
}

/**
 * Correlation between two metrics logged on the same day.
 * Returns `null` unless there are at least `minPairs` shared days.
 */
export function correlationBetween(
  entries: readonly DailyEntry[],
  keyA: MetricKey,
  keyB: MetricKey,
  minPairs = 7,
): number | null {
  const { a, b, n } = pairedValues(entries, keyA, keyB);
  if (n < minPairs) return null;
  return pearsonCorrelation(a, b);
}

// ---------------------------------------------------------------------------
// rules
// ---------------------------------------------------------------------------

/** Not enough logged days to say anything meaningful. */
function ruleInsufficientData(
  loggedDays: number,
  windowDays: number,
  windowStart: string,
  windowEnd: string,
): Insight | null {
  if (loggedDays >= MIN_DAYS_FOR_INSIGHTS) return null;
  return buildInsight(
    'data.insufficient',
    'data',
    'info',
    'Not enough data yet',
    `Log at least ${MIN_DAYS_FOR_INSIGHTS} days to unlock trend analysis and recommendations.`,
    [
      `${loggedDays} of ${windowDays} days logged`,
      `Window: ${windowStart} to ${windowEnd}`,
    ],
    [
      {
        title: 'Log every day for two weeks',
        detail: `A dense ${DEFAULT_WINDOW_DAYS}-day window is what makes the trends and correlations reliable.`,
      },
      {
        title: 'One entry per day is enough',
        detail: 'Weight, steps, sleep and calories are all optional, but the more you log the sharper the advice.',
      },
    ],
  );
}

/** The user logged sporadically, which weakens every other conclusion. */
function ruleCoverage(
  loggedDays: number,
  windowDays: number,
): Insight | null {
  if (loggedDays < MIN_DAYS_FOR_INSIGHTS) return null;
  const ratio = loggedDays / windowDays;
  if (ratio >= THRESHOLDS.coverageWarnRatio) return null;

  const severity: Severity = ratio < 0.3 ? 'warning' : 'info';
  return buildInsight(
    'data.coverage',
    'data',
    severity,
    'Incomplete logging',
    `Only ${Math.round(ratio * 100)}% of days in the window have data, so trends may be misleading.`,
    [`${loggedDays} of ${windowDays} days logged`],
    [
      {
        title: 'Set a daily reminder',
        detail: 'Even a 30-second entry at the same time each morning keeps the series continuous.',
      },
      {
        title: 'Backfill when you miss a day',
        detail: 'You can add entries for past dates - gaps of 1-2 days have little effect on the averages.',
      },
    ],
  );
}

/** Metrics with zero values, called out so the user knows what is missing. */
function ruleMissingMetrics(summaries: Record<MetricKey, MetricSummary>): Insight | null {
  const missing = METRIC_KEYS.filter((key) => summaries[key].count === 0);
  if (missing.length === 0) return null;

  return buildInsight(
    'data.missing-metrics',
    'data',
    'info',
    'Some metrics are not being tracked',
    `No data for ${missing.join(', ')} in this window, so the related checks are skipped.`,
    missing.map((key) => `${key}: 0 values`),
    missing.map((key) => ({
      title: `Start logging ${key}`,
      detail: `Tracking ${key} adds a ${key}-specific analysis to this report.`,
    })),
  );
}

/** BMI band check, only when height is known. */
function ruleBmi(
  profile: Profile,
  summaries: Record<MetricKey, MetricSummary>,
): Insight | null {
  const weight = latestWeight(summaries);
  const heightCm = profile.heightCm;
  if (weight === null || !heightCm || heightCm <= 0) return null;

  const value = bmi(weight, heightCm);
  if (value === null) return null;
  const category = bmiCategory(value);
  if (!category) return null;

  const band = BMI_CATEGORIES[category];
  const range = healthyWeightRange(heightCm);
  const evidence = [`BMI ${round(value, 1)} (${band.label})`, `Latest weight ${fmt('weight', weight)} kg`];
  if (range) {
    evidence.push(`Healthy BMI weight range: ${fmt('weight', range.min)}-${fmt('weight', range.max)} kg`);
  }

  if (category === 'healthy') {
    return buildInsight(
      'body.bmi',
      'body',
      'positive',
      'Body mass index is in the healthy band',
      `A BMI of ${round(value, 1)} sits inside the 18.5-24.9 range.`,
      evidence,
      [
        {
          title: 'Keep the habits that are working',
          detail: 'Re-check monthly; BMI is a screening tool, not a diagnosis.',
        },
      ],
    );
  }

  const overweight = category === 'overweight' || category.startsWith('obese');
  const severity: Severity = BMI_SEVERITY[category];

  const recommendations: Recommendation[] = overweight
    ? [
        {
          title: 'Aim for a 0.25-0.75% body weight change per week',
          detail: `For ${fmt('weight', weight)} kg that is roughly ${fmt('weight', round(weight * 0.005, 2))} kg per week - a sustainable pace.`,
        },
        {
          title: 'Combine resistance training with cardio',
          detail: 'Two or three sessions a week protects muscle mass while you are in a deficit.',
        },
        {
          title: 'Bring daily movement up gradually',
          detail: 'Extra 1,000-2,000 steps a day is often easier to sustain than a diet cut.',
        },
      ]
    : [
        {
          title: 'Make sure you are eating enough',
          detail: `A BMI of ${round(value, 1)} usually calls for a calorie surplus plus resistance training, not more cardio.`,
        },
        {
          title: 'Get any unintentional weight loss checked',
          detail: 'Unplanned loss of more than 5% of body weight in a month warrants a doctor visit.',
        },
      ];

  return buildInsight(
    'body.bmi',
    'body',
    severity,
    `BMI is in the ${band.label.toLowerCase()} range`,
    overweight
      ? `A BMI of ${round(value, 1)} is above the healthy range of 18.5-24.9.`
      : `A BMI of ${round(value, 1)} is below the healthy range of 18.5-24.9.`,
    evidence,
    recommendations,
  );
}

/** Direction and pace of the weight trend. */
function ruleWeightTrend(summaries: Record<MetricKey, MetricSummary>): Insight | null {
  const { count, trendPerWeek, latest } = summaries.weight;
  if (count < MIN_DAYS_FOR_TREND || trendPerWeek === null || latest === null || latest === 0) {
    return null;
  }

  const t = THRESHOLDS;
  const trend = round(trendPerWeek, 2);
  const bodyPercentPerWeek = (Math.abs(trend) / latest) * 100;
  const evidence = [
    `Trend: ${trend > 0 ? '+' : ''}${fmt('weight', trend)} kg per week`,
    `Latest weight ${fmt('weight', latest)} kg`,
    `Based on ${count} weigh-ins`,
  ];

  if (trend <= -t.weightTrendRapidLossKgPerWeek && bodyPercentPerWeek >= t.weightRapidLossBodyPercentPerWeek) {
    return buildInsight(
      'weight.trend',
      'weight',
      'critical',
      'Weight is dropping too fast',
      `You are losing ${fmt('weight', Math.abs(trend))} kg per week, about ${round(bodyPercentPerWeek, 1)}% of your body weight.`,
      evidence,
      [
        {
          title: 'Eat more and slow the pace down',
          detail: 'Faster than ~1% of body weight per week you lose muscle as well as fat.',
        },
        {
          title: 'See a doctor if the loss was not intentional',
          detail: 'Unexplained rapid weight loss can be a sign of an underlying condition.',
        },
      ],
    );
  }

  if (trend >= t.weightTrendSignificantKgPerWeek) {
    const severity: Severity = trend >= 0.3 ? 'warning' : 'info';
    return buildInsight(
      'weight.trend',
      'weight',
      severity,
      'Weight is trending up',
      `Your weight is rising by about ${fmt('weight', trend)} kg per week.`,
      evidence,
      [
        {
          title: 'Check the calorie trend first',
          detail: 'The "intake vs. burn" insight below shows whether calories are driving this.',
        },
        {
          title: 'Look at drinks and sauces',
          detail: 'Liquid calories and condiments are the most common invisible surplus.',
        },
        {
          title: 'Build a small daily movement habit',
          detail: 'A 15-minute walk after one meal removes roughly 750 kcal per week.',
        },
      ],
    );
  }

  if (trend <= -t.weightTrendSignificantKgPerWeek) {
    return buildInsight(
      'weight.trend',
      'weight',
      'info',
      'Weight is trending down',
      `Your weight is falling by about ${fmt('weight', Math.abs(trend))} kg per week - a healthy pace.`,
      evidence,
      [
        {
          title: 'Protect your muscle',
          detail: 'Keep protein intake steady and train two or three times a week.',
        },
        {
          title: 'Plan the end point',
          detail: 'Once you reach your target, switch to maintenance calories rather than continuing to cut.',
        },
      ],
    );
  }

  if (trend >= t.weightTrendNegligibleKgPerWeek) {
    return buildInsight(
      'weight.trend',
      'weight',
      'info',
      'Weight is creeping up slightly',
      `A slow gain of about ${fmt('weight', trend)} kg per week - small, but worth watching.`,
      evidence,
      [
        {
          title: 'Watch it for another week',
          detail: 'If the trend continues, trim 100-200 kcal per day rather than doing a hard cut.',
        },
      ],
    );
  }

  if (trend <= -t.weightTrendNegligibleKgPerWeek) {
    return buildInsight(
      'weight.trend',
      'weight',
      'info',
      'Weight is drifting down slightly',
      `A slow loss of about ${fmt('weight', Math.abs(trend))} kg per week.`,
      evidence,
      [
        {
          title: 'Confirm this is intended',
          detail: 'If you are not actively trying to lose weight, make sure you are eating enough.',
        },
      ],
    );
  }

  return buildInsight(
    'weight.trend',
    'weight',
    'positive',
    'Weight is stable',
    `Your weight is holding steady within about ${fmt('weight', Math.abs(trend))} kg per week.`,
    evidence,
    [
      {
        title: 'Hold the current routine',
        detail: 'A stable weight with logged activity and good sleep is the goal, not a lower number.',
      },
    ],
  );
}

/** Distance to, and progress towards, the target weight. */
function ruleWeightGoal(
  profile: Profile,
  summaries: Record<MetricKey, MetricSummary>,
): Insight | null {
  const target = profile.targetWeightKg;
  const latest = latestWeight(summaries);
  if (target === undefined || !Number.isFinite(target) || latest === null) return null;

  const gap = round(target - latest, 1);
  const trend = summaries.weight.trendPerWeek;
  const evidence = [
    `Target ${fmt('weight', target)} kg`,
    `Current ${fmt('weight', latest)} kg`,
    `Gap ${gap > 0 ? '+' : ''}${fmt('weight', gap)} kg`,
  ];

  if (Math.abs(gap) <= THRESHOLDS.weightGoalToleranceKg) {
    return buildInsight(
      'weight.goal',
      'weight',
      'positive',
      'Target weight reached',
      `You are within ${fmt('weight', Math.abs(gap))} kg of your ${fmt('weight', target)} kg target.`,
      evidence,
      [
        {
          title: 'Switch to maintenance calories',
          detail: 'Recalculate your daily calorie target from your current weight.',
        },
      ],
    );
  }

  const weeksToGoal = Math.ceil(Math.abs(gap) / SAFE_PACE_KG_PER_WEEK);
  const recommendations: Recommendation[] = [
    {
      title: `A ${SAFE_PACE_KG_PER_WEEK} kg per week pace is the usual target`,
      detail: `From ${fmt('weight', latest)} kg that is about ${weeksToGoal} ${weeksToGoal === 1 ? 'week' : 'weeks'} to reach ${fmt('weight', target)} kg.`,
    },
  ];

  const recommended = calorieTargetForGoal(profile, latest, target);
  if (recommended !== null) {
    recommendations.push({
      title: `Aim for roughly ${fmt('calories', recommended)} kcal per day`,
      detail: `Derived from your estimated burn for a ${profile.activityLevel ? ACTIVITY_LABELS[profile.activityLevel].split(' (')[0]!.toLowerCase() : 'moderate'} profile.`,
    });
  }
  if (
    trend !== null &&
    Math.sign(trend) !== Math.sign(gap) &&
    Math.abs(trend) >= THRESHOLDS.weightTrendSignificantKgPerWeek
  ) {
    recommendations.push({
      title: 'The current trend moves away from the goal',
      detail: `You are trending ${trend > 0 ? 'up' : 'down'} while the goal is ${gap > 0 ? 'up' : 'down'}. Close the calorie gap first.`,
    });
  }

  return buildInsight(
    'weight.goal',
    'weight',
    'info',
    gap > 0 ? `${formatKg(gap)} kg to goal` : `${formatKg(Math.abs(gap))} kg above goal`,
    gap > 0
      ? `You need ${formatKg(gap)} kg more to reach your target.`
      : `You are ${formatKg(Math.abs(gap))} kg over your target.`,
    evidence,
    recommendations,
  );
}

/** Average sleep against the personal goal. */
function ruleSleepAverage(profile: Profile, summaries: Record<MetricKey, MetricSummary>): Insight | null {
  const { count, average } = summaries.sleep;
  if (count < MIN_DAYS_FOR_INSIGHTS || average === null) return null;

  const goal = sleepGoal(profile);
  const avg = round(average, 1);
  const deficit = round(goal - avg, 1);
  const evidence = [
    `Average ${fmt('sleep', avg)} h per night`,
    `Goal ${fmt('sleep', goal)} h`,
    `Based on ${count} nights`,
  ];

  if (avg < THRESHOLDS.sleepSevereHours) {
    return buildInsight(
      'sleep.average',
      'recovery',
      'critical',
      'Sleep is severely restricted',
      `You are averaging only ${fmt('sleep', avg)} hours, well under the ${fmt('sleep', goal)} hour target.`,
      evidence,
      [
        {
          title: 'Add 20-30 minutes this week',
          detail: 'Small increments stick; trying to jump straight to the goal rarely works.',
        },
        {
          title: 'Fix the wake time first',
          detail: 'A fixed wake time, even at the weekend, pulls bedtime forward on its own.',
        },
        {
          title: 'Cut caffeine 8 hours before bed',
          detail: 'Caffeine has a half-life of about 5 hours and delays sleep onset.',
        },
      ],
    );
  }

  if (deficit > THRESHOLDS.sleepDeficitHours) {
    return buildInsight(
      'sleep.average',
      'recovery',
      'warning',
      'Not enough sleep',
      `You are averaging ${fmt('sleep', avg)} hours, about ${fmt('sleep', deficit)} h below your target.`,
      evidence,
      [
        {
          title: 'Move bedtime earlier by 15 minutes a week',
          detail: 'Adenosine build-up, not willpower, sets your sleep pressure - extend the runway.',
        },
        {
          title: 'Dim the evening environment',
          detail: 'Bright light and scrolling both suppress melatonin release.',
        },
        {
          title: 'Review anything that keeps you up',
          detail: 'Late caffeine, alcohol, and irregular meal timing are the usual culprits.',
        },
      ],
    );
  }

  if (deficit < -THRESHOLDS.sleepExcessHours) {
    return buildInsight(
      'sleep.average',
      'recovery',
      'info',
      'Sleeping well above target',
      `You are averaging ${fmt('sleep', avg)} hours, more than the ${fmt('sleep', goal)} hour target.`,
      [...evidence, `${count} of ${count} nights logged`],
      [
        {
          title: 'Check that you are not oversleeping',
          detail: 'Consistently long sleep can flag illness, poor sleep quality, or an off schedule.',
        },
        {
          title: 'Keep a consistent schedule',
          detail: 'If you feel rested, this is fine - just avoid drifting later each week.',
        },
      ],
    );
  }

  return buildInsight(
    'sleep.average',
    'recovery',
    'positive',
    'Sleep duration is on target',
    `You are averaging ${fmt('sleep', avg)} hours per night, right around your ${fmt('sleep', goal)} hour goal.`,
    evidence,
    [
      {
        title: 'Sleep is your cheapest performance gain',
        detail: 'It supports training quality, appetite regulation and mood more than most supplements do.',
      },
    ],
  );
}

/** Night-to-night consistency, measured as the coefficient of variation. */
function ruleSleepRegularity(summaries: Record<MetricKey, MetricSummary>): Insight | null {
  const { count, average, stdDev } = summaries.sleep;
  if (count < MIN_DAYS_FOR_TREND || average === null || stdDev === null) return null;

  const cv = variationRatio(average, stdDev);
  if (cv === null) return null;

  const evidence = [
    `Nightly variation: ${fmt('sleep', stdDev)} h (standard deviation)`,
    `Coefficient of variation ${round(cv, 0)}%`,
    `Average ${fmt('sleep', average)} h across ${count} nights`,
  ];

  if (cv <= THRESHOLDS.sleepIrregularCvPercent) {
    return buildInsight(
      'sleep.regularity',
      'recovery',
      'positive',
      'Sleep timing is consistent',
      `Your nightly sleep varies by only ${round(cv, 0)}%, which is the ideal pattern.`,
      evidence,
      [
        {
          title: 'Keep the schedule',
          detail: 'Consistency matters as much as total hours for recovery quality.',
        },
      ],
    );
  }

  return buildInsight(
    'sleep.regularity',
    'recovery',
    'warning',
    'Irregular sleep pattern',
    `Your sleep duration swings by ${round(cv, 0)}%, which usually means an unstable schedule.`,
    evidence,
    [
      {
        title: 'Anchor on the wake time',
        detail: 'Even on weekends, stay within an hour of your weekday wake time.',
      },
      {
        title: 'Use the same wind-down sequence',
        detail: 'Repetition trains the brain to associate the routine with sleep.',
      },
      {
        title: 'Get daylight within an hour of waking',
        detail: 'Morning light is the strongest cue for tonight`s sleep drive.',
      },
    ],
  );
}

/** Cross-metric: short sleep alongside a rising weight. */
function ruleSleepWeightInteraction(
  summaries: Record<MetricKey, MetricSummary>,
): Insight | null {
  if (summaries.sleep.count < MIN_DAYS_FOR_TREND || summaries.weight.count < MIN_DAYS_FOR_TREND) {
    return null;
  }
  const sleepAvg = summaries.sleep.average;
  const trend = summaries.weight.trendPerWeek;
  if (sleepAvg === null || trend === null) return null;

  if (sleepAvg >= THRESHOLDS.sleepSevereHours + 0.5) return null;
  if (trend < THRESHOLDS.weightTrendSignificantKgPerWeek) return null;

  return buildInsight(
    'sleep.weight-interaction',
    'recovery',
    'warning',
    'Short sleep is compounding your weight trend',
    `Sleep under ${fmt('sleep', sleepAvg)} h alongside a ${fmt('weight', trend)} kg/week gain is a known appetite-metabolism pattern.`,
    [
      `Average sleep ${fmt('sleep', sleepAvg)} h`,
      `Weight trend ${trend > 0 ? '+' : ''}${fmt('weight', trend)} kg per week`,
    ],
    [
      {
        title: 'Treat sleep as part of the weight plan',
        detail: 'Sleep restriction raises ghrelin and lowers leptin, so hunger signals get louder.',
      },
      {
        title: 'Fix sleep before tightening calories',
        detail: 'Cutting calories while sleep-deprived is the combination most likely to fail.',
      },
    ],
  );
}

/** Average steps against the daily goal. */
function ruleSteps(profile: Profile, summaries: Record<MetricKey, MetricSummary>): Insight | null {
  const { count, average } = summaries.steps;
  if (count < MIN_DAYS_FOR_INSIGHTS || average === null) return null;

  const goal = stepGoal(profile);
  const avg = round(average, 0);
  // `goal <= 0` would divide by zero and make every ratio meaningless, so treat
  // it as "no target" and fall through to the goal-met branch.
  const ratio = goal > 0 ? avg / goal : null;

  const evidence = [
    `Average ${fmt('steps', avg)} steps per day`,
    `Goal ${fmt('steps', goal)} steps`,
    `Based on ${count} days`,
  ];
  if (ratio !== null) evidence.push(`${Math.round(ratio * 100)}% of the daily goal`);

  if (ratio !== null && ratio < THRESHOLDS.stepsVeryLowRatio) {
    return buildInsight(
      'steps.average',
      'activity',
      'warning',
      'Very sedentary days',
      `You are averaging ${fmt('steps', avg)} steps, less than half of your ${fmt('steps', goal)} step goal.`,
      evidence,
      [
        {
          title: 'Start with a 10-minute walk after a meal',
          detail: 'Post-meal walks blunt the glucose spike and add ~1,000 steps each.',
        },
        {
          title: 'Break up sitting every hour',
          detail: 'Set a recurring reminder to stand for two minutes.',
        },
      ],
    );
  }

  if (ratio !== null && ratio < THRESHOLDS.stepsLowRatio) {
    return buildInsight(
      'steps.average',
      'activity',
      'info',
      'Below your step goal',
      `You are averaging ${fmt('steps', avg)} steps, ${Math.round((1 - ratio) * 100)}% below your goal.`,
      evidence,
      [
        {
          title: 'Add 1,000 steps a day this week',
          detail: 'Park further away, take the stairs, or walk one extra call.',
        },
      ],
    );
  }

  return buildInsight(
    'steps.average',
    'activity',
    'positive',
    'Daily movement target is met',
    `You are averaging ${fmt('steps', avg)} steps against a goal of ${fmt('steps', goal)}.`,
    evidence,
    [
      {
        title: 'Keep the streak visible',
        detail: 'Knowing which days you missed the goal makes the next one easier.',
      },
    ],
  );
}

/** Are steps trending up or down? */
function ruleStepsTrend(summaries: Record<MetricKey, MetricSummary>): Insight | null {
  const { count, trendPerWeek } = summaries.steps;
  if (count < MIN_DAYS_FOR_TREND || trendPerWeek === null) return null;

  const trend = round(trendPerWeek, 0);
  const threshold = THRESHOLDS.stepsTrendThresholdPerWeek;
  const evidence = [`Step trend ${trend > 0 ? '+' : ''}${fmt('steps', trend)} per week`, `${count} days logged`];

  if (trend <= -threshold) {
    return buildInsight(
      'steps.trend',
      'activity',
      'warning',
      'Activity is declining',
      `Your daily steps are dropping by about ${fmt('steps', Math.abs(trend))} per week.`,
      evidence,
      [
        {
          title: 'Find the drop-off point',
          detail: 'Compare work days with free days - the loss is usually structural, not motivational.',
        },
        {
          title: 'Lower the target to something easy',
          detail: 'Even 500 steps more per day protects the habit while the routine rebuilds.',
        },
      ],
    );
  }

  if (trend >= threshold) {
    return buildInsight(
      'steps.trend',
      'activity',
      'positive',
      'Activity is trending up',
      `Your daily steps are climbing by about ${fmt('steps', trend)} per week.`,
      evidence,
      [
        {
          title: 'Bank the new normal',
          detail: 'Set a step floor slightly below your current average to keep the momentum.',
        },
      ],
    );
  }

  return null;
}

/** Daily intake against the calorie target or the estimated burn. */
function ruleCalorieBalance(
  profile: Profile,
  summaries: Record<MetricKey, MetricSummary>,
): Insight | null {
  const { count, average } = summaries.calories;
  if (count < MIN_DAYS_FOR_INSIGHTS || average === null) return null;

  const weight = latestWeight(summaries);
  const estimatedBurn = weight === null ? null : totalDailyEnergyExpenditure(profile, weight);
  const target = profile.dailyCalorieGoal ?? estimatedBurn;

  const avg = round(average, 0);
  const evidence = [`Average intake ${fmt('calories', avg)} kcal per day`, `Based on ${count} days`];
  if (estimatedBurn !== null) {
    evidence.push(`Estimated burn ${fmt('calories', estimatedBurn)} kcal`);
  }
  if (profile.dailyCalorieGoal !== undefined) {
    evidence.push(`Your target ${fmt('calories', profile.dailyCalorieGoal)} kcal`);
  }

  if (target === null) {
    return buildInsight(
      'calories.balance',
      'energy',
      'info',
      'Intake logged, no target to compare against',
      'Add age, sex and height to your profile to estimate how much you burn per day.',
      evidence,
      [
        {
          title: 'Complete your profile',
          detail: 'Height, age, sex and activity level let the app estimate your maintenance calories.',
        },
      ],
    );
  }

  const diff = avg - target;
  const ratio = target > 0 ? diff / target : 0;
  const t = THRESHOLDS;

  if (ratio <= -t.calorieSevereDeficitRatio) {
    return buildInsight(
      'calories.balance',
      'energy',
      'critical',
      'Eating far too little',
      `You are averaging ${fmt('calories', avg)} kcal against an estimated need of ${fmt('calories', target)} - a deficit of ${fmt('calories', Math.abs(diff))} kcal per day.`,
      evidence,
      [
        {
          title: 'Raise intake toward maintenance',
          detail: 'Deficits beyond ~20-35% of needs bring fatigue, poor recovery and muscle loss.',
        },
        {
          title: 'Get medical advice if this is long-term',
          detail: 'Sustained very low intake should be supervised.',
        },
      ],
    );
  }

  if (ratio <= -t.calorieDeficitRatio) {
    return buildInsight(
      'calories.balance',
      'energy',
      'warning',
      'Large calorie deficit',
      `You are eating about ${fmt('calories', Math.abs(diff))} kcal per day below your estimated need.`,
      evidence,
      [
        {
          title: 'Check protein intake',
          detail: `Roughly ${fmt('weight', weight === null ? null : round(weight * 1.6, 0))} g per day keeps you in a deficit without losing muscle.`,
        },
        {
          title: 'Is the deficit deliberate?',
          detail: 'If you are not actively cutting, this may simply be under-reporting.',
        },
      ],
    );
  }

  if (ratio >= t.calorieSurplusRatio) {
    return buildInsight(
      'calories.balance',
      'energy',
      'warning',
      'Sustained calorie surplus',
      `You are eating about ${fmt('calories', diff)} kcal per day above your estimated need.`,
      evidence,
      [
        {
          title: 'Trim 200 kcal rather than 500',
          detail: 'Smaller cuts are far more likely to still be in place a month from now.',
        },
        {
          title: 'Watch for the liquid and snack calories',
          detail: 'This size of gap is usually beverages, nuts, or cooking oil.',
        },
      ],
    );
  }

  if (Math.abs(ratio) <= t.calorieBalanceToleranceRatio) {
    return buildInsight(
      'calories.balance',
      'energy',
      'positive',
      'Intake matches your estimated burn',
      `You are averaging ${fmt('calories', avg)} kcal against a target of ${fmt('calories', target)}.`,
      evidence,
      [
        {
          title: 'This is the right baseline',
          detail: 'Adjust from here: add ~250 kcal for a gentle loss, subtract for a gentle gain.',
        },
      ],
    );
  }

  return buildInsight(
    'calories.balance',
    'energy',
    'info',
    Math.abs(ratio) < t.calorieDeficitRatio ? 'Mild calorie deficit' : 'Mild calorie surplus',
    `Intake is ${fmt('calories', Math.abs(diff))} kcal per day ${ratio < 0 ? 'below' : 'above'} the ${fmt('calories', target)} kcal target.`,
    evidence,
    [
      {
        title: 'Keep logging to confirm it sticks',
        detail: 'A 3-4 week window is enough to see whether this shows up in your weight.',
      },
    ],
  );
}

/** Day-to-day swings in intake. */
function ruleCalorieStability(summaries: Record<MetricKey, MetricSummary>): Insight | null {
  const { count, average, stdDev } = summaries.calories;
  if (count < MIN_DAYS_FOR_TREND) return null;

  const cv = variationRatio(average, stdDev);
  if (cv === null) return null;

  const evidence = [
    `Day-to-day variation ${round(cv, 0)}% (coefficient of variation)`,
    `${count} days logged`,
  ];

  if (cv <= THRESHOLDS.calorieIrregularCvPercent) {
    return buildInsight(
      'calories.stability',
      'energy',
      'positive',
      'Calorie intake is steady',
      `Your daily intake varies by only ${round(cv, 0)}%, which is easy to reason about.`,
      evidence,
      [
        {
          title: 'Use the weekly total as the real number',
          detail: 'Daily noise is normal; what matters is the average across the week.',
        },
      ],
    );
  }

  return buildInsight(
    'calories.stability',
    'energy',
    'warning',
    'Erratic calorie intake',
    `Your intake swings by ${round(cv, 0)}%, which usually means a restrict-and-binge cycle.`,
    evidence,
    [
      {
        title: 'Aim for consistency, not perfection',
        detail: 'Keeping each day within ~200 kcal of the target beats one perfect day in five.',
      },
      {
        title: 'Look for the weekend pattern',
        detail: 'Two high days a week are fine; five high days a week are not.',
      },
    ],
  );
}

/**
 * Cross-check: does the observed weight change match the logged intake?
 * A large gap usually means under-reporting rather than a metabolism problem.
 */
function ruleCalorieWeightAlignment(
  profile: Profile,
  summaries: Record<MetricKey, MetricSummary>,
): Insight | null {
  if (summaries.calories.count < MIN_DAYS_FOR_TREND) return null;
  if (summaries.weight.count < MIN_DAYS_FOR_TREND) return null;

  const weightTrend = summaries.weight.trendPerWeek;
  const calorieAvg = summaries.calories.average;
  const weight = latestWeight(summaries);
  if (weightTrend === null || calorieAvg === null || weight === null) return null;

  const burn = totalDailyEnergyExpenditure(profile, weight) ?? profile.dailyCalorieGoal ?? null;
  if (burn === null) return null;

  // Intake that would explain the weight we actually observe.
  const expectedIntake = burn + dailyCalorieDeltaForWeightChange(weightTrend);
  const deviation = calorieAvg - expectedIntake;
  const ratio = burn > 0 ? deviation / burn : 0;

  const evidence = [
    `Observed weight trend ${weightTrend > 0 ? '+' : ''}${fmt('weight', weightTrend)} kg per week`,
    `Intake that would explain it: ${fmt('calories', expectedIntake)} kcal per day`,
    `Actually logged: ${fmt('calories', calorieAvg)} kcal per day`,
    `Gap ${deviation > 0 ? '+' : ''}${fmt('calories', deviation)} kcal per day`,
  ];

  if (Math.abs(ratio) > THRESHOLDS.alignmentToleranceRatio) {
    return buildInsight(
      'calories.weight-alignment',
      'energy',
      'warning',
      'Intake and weight change disagree',
      `Your logged calories do not explain the weight trend - a ${fmt('calories', Math.abs(deviation))} kcal per day gap suggests logging accuracy, not metabolism.`,
      evidence,
      [
        {
          title: 'Weigh portions for a week',
          detail: 'Calorie apps miss oils, sauces and drinks, which are usually the gap.',
        },
        {
          title: 'Compare weight trend against the weekly calorie average',
          detail: 'The weekly total is far more reliable than any single day.',
        },
      ],
    );
  }

  return buildInsight(
    'calories.weight-alignment',
    'energy',
    'positive',
    'Calories and weight tell a consistent story',
    `Your logged intake matches the weight change you are seeing, within ${fmt('calories', Math.abs(deviation))} kcal per day.`,
    evidence,
    [
      {
        title: 'Trust your own data',
        detail: 'Internal consistency is what makes the recommendations trustworthy.',
      },
    ],
  );
}

// ---------------------------------------------------------------------------
// entry point
// ---------------------------------------------------------------------------

export interface AnalyzeOptions {
  /** `YYYY-MM-DD` treated as "today". Defaults to the actual current date. */
  referenceDate?: string;
  /** Length of the analysis window in days, ending at `referenceDate`. */
  windowDays?: number;
}

export function analyzeHealth(
  entries: readonly DailyEntry[],
  profile: Profile = {},
  options: AnalyzeOptions = {},
): HealthReport {
  const referenceDate = options.referenceDate ?? toISODate(new Date());
  const windowDays = Math.max(1, options.windowDays ?? DEFAULT_WINDOW_DAYS);
  const windowEnd = referenceDate;
  const windowStart = addDays(windowEnd, -(windowDays - 1));

  const windowEntries = sortEntries(entries).filter(
    (entry) => entry.date >= windowStart && entry.date <= windowEnd,
  );

  const summaries = summarizeAll(windowEntries, windowStart);
  const loggedDays = daysWithData(windowEntries);
  const totalLoggedValues = METRIC_KEYS.reduce((acc, key) => acc + summaries[key].count, 0);

  const insights: Insight[] = [];
  const add = (insight: Insight | null): void => {
    if (insight) insights.push(insight);
  };

  add(ruleInsufficientData(loggedDays, windowDays, windowStart, windowEnd));
  add(ruleCoverage(loggedDays, windowDays));
  add(ruleMissingMetrics(summaries));
  add(ruleBmi(profile, summaries));
  add(ruleWeightTrend(summaries));
  add(ruleWeightGoal(profile, summaries));
  add(ruleSleepAverage(profile, summaries));
  add(ruleSleepRegularity(summaries));
  add(ruleSleepWeightInteraction(summaries));
  add(ruleSteps(profile, summaries));
  add(ruleStepsTrend(summaries));
  add(ruleCalorieBalance(profile, summaries));
  add(ruleCalorieStability(summaries));
  add(ruleCalorieWeightAlignment(profile, summaries));

  const sorted = [...insights].sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    return bySeverity !== 0 ? bySeverity : a.id.localeCompare(b.id);
  });

  const counts: Record<Severity, number> = { critical: 0, warning: 0, info: 0, positive: 0 };
  for (const insight of sorted) counts[insight.severity] += 1;

  const penalty = sorted.reduce((acc, insight) => acc + PENALTY_BY_SEVERITY[insight.severity], 0);
  const hasEnoughData = loggedDays >= MIN_DAYS_FOR_INSIGHTS && totalLoggedValues >= MIN_DAYS_FOR_INSIGHTS;
  const score = hasEnoughData ? clamp(Math.round(100 - penalty), 0, 100) : null;

  return {
    referenceDate,
    windowStart,
    windowEnd,
    windowDays,
    summaries,
    score,
    insights: sorted,
    counts,
  };
}

/** Human-readable label for a metric, used by the UI. */
export const METRIC_LABELS: Record<MetricKey, string> = {
  weight: 'Weight',
  steps: 'Steps',
  sleep: 'Sleep',
  calories: 'Calories',
};