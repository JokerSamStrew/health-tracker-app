/**
 * The insight engine.
 *
 * `analyzeHealth` is a pure function: entries + profile in, report out. No
 * clock, no storage, no React. Every rule is a small standalone function so the
 * behaviour can be unit-tested rule by rule.
 *
 * Rules only fire when there is enough data to support them, and each one
 * carries the numbers it used as `evidence` so the UI can show its work.
 *
 * Text is supplied by an injected `InsightTranslator` (English by default) and
 * numbers are formatted with the injected `Locale`, so the engine stays pure
 * while its output can be localized.
 */

import {
  activityLabel,
  MIN_DAYS_FOR_INSIGHTS,
  MIN_DAYS_FOR_TREND,
  bmi,
  bmiCategory,
  bmiLabel,
  type BmiCategory,
  calorieTargetForGoal,
  healthyWeightRange,
  totalDailyEnergyExpenditure,
  dailyCalorieDeltaForWeightChange,
  SAFE_PACE_KG_PER_WEEK,
} from './health.ts';
import { addDays, ageFromBirthDate, formatLongDate, formatShortDate, lastNDays, toISODate } from './date.ts';
import { FORECAST_LIMITS, forecastWeightGoal, lastWeighInDate } from './forecast.ts';
import {
  METRIC_DIGITS,
  METRIC_FIELD,
  sortEntries,
  summarizeAll,
} from './series.ts';
import {
  clamp,
  formatMetric,
  formatNumber,
  formatSigned,
  linearRegression,
  mean,
  pearsonCorrelation,
  round,
  variationRatio,
} from './stats.ts';
import type {
  DailyEntry,
  HealthReport,
  Insight,
  Locale,
  MetricKey,
  MetricSummary,
  Profile,
  Recommendation,
  Severity,
} from '../types.ts';
import { METRIC_KEYS, SEVERITY_ORDER } from '../types.ts';
import { enInsightTranslator, type InsightTranslator } from '../i18n/insightText.ts';

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
  /** Sleep quality below `goal - this` is flagged as below target. */
  sleepDeficitQuality: 0.5,
  /** Average sleep quality at or below this is very poor. */
  sleepVeryPoorQuality: 2,
  /** Average sleep quality below this can compound a weight trend. */
  sleepPoorQuality: 3,
  /** Sleep quality coefficient of variation above this percent is "irregular". */
  sleepIrregularCvPercent: 20,
  /** Activity rating below `goal - this` is flagged as below target. */
  activityDeficitRating: 0.5,
  /** Average activity rating at or below this is very low. */
  activityVeryLowRating: 2,
  /** Average activity rating at or above this counts as high. */
  activityHighRating: 4,
  /** Activity rating coefficient of variation above this percent is "bursty". */
  activityIrregularCvPercent: 20,
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
  return profile.sleepGoalQuality ?? 4;
}

function activityGoal(profile: Profile): number {
  return profile.activityGoalRating ?? 3;
}

function stepGoal(profile: Profile): number {
  return profile.dailyStepGoal ?? 8000;
}

function fmt(key: MetricKey, value: number | null | undefined, locale: Locale): string {
  return formatMetric(value ?? null, METRIC_DIGITS[key], locale);
}

/** Weight in prose, without a trailing `.0` (`5 kg`, not `5.0 kg`). */
function formatKg(value: number, locale: Locale): string {
  return formatMetric(round(value, 1), 1, locale).replace(/[.,]0$/, '');
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
  _locale: Locale,
  translate: InsightTranslator,
): Insight | null {
  if (loggedDays >= MIN_DAYS_FOR_INSIGHTS) return null;
  return buildInsight(
    'data.insufficient',
    'data',
    'info',
    translate('data.insufficient.title'),
    translate('data.insufficient.summary', { days: MIN_DAYS_FOR_INSIGHTS }),
    [
      translate('data.insufficient.evidence.logged', { logged: loggedDays, window: windowDays }),
      translate('data.insufficient.evidence.window', { start: windowStart, end: windowEnd }),
    ],
    [
      {
        title: translate('data.insufficient.rec1.title'),
        detail: translate('data.insufficient.rec1.detail', { days: DEFAULT_WINDOW_DAYS }),
      },
      {
        title: translate('data.insufficient.rec2.title'),
        detail: translate('data.insufficient.rec2.detail'),
      },
    ],
  );
}

/** The user logged sporadically, which weakens every other conclusion. */
function ruleCoverage(
  loggedDays: number,
  windowDays: number,
  locale: Locale,
  translate: InsightTranslator,
): Insight | null {
  if (loggedDays < MIN_DAYS_FOR_INSIGHTS) return null;
  const ratio = loggedDays / windowDays;
  if (ratio >= THRESHOLDS.coverageWarnRatio) return null;

  const severity: Severity = ratio < 0.3 ? 'warning' : 'info';
  return buildInsight(
    'data.coverage',
    'data',
    severity,
    translate('data.coverage.title'),
    translate('data.coverage.summary', {
      percent: formatNumber(Math.round(ratio * 100), 0, locale),
    }),
    [translate('data.coverage.evidence.logged', { logged: loggedDays, window: windowDays })],
    [
      {
        title: translate('data.coverage.rec1.title'),
        detail: translate('data.coverage.rec1.detail'),
      },
      {
        title: translate('data.coverage.rec2.title'),
        detail: translate('data.coverage.rec2.detail'),
      },
    ],
  );
}

/** Metrics with zero values, called out so the user knows what is missing. */
function ruleMissingMetrics(
  summaries: Record<MetricKey, MetricSummary>,
  _locale: Locale,
  translate: InsightTranslator,
): Insight | null {
  const missing = METRIC_KEYS.filter((key) => summaries[key].count === 0);
  if (missing.length === 0) return null;

  // The names are themselves translated, so the joined list reads naturally in
  // both languages while the English output stays identical to the raw keys.
  const metricName = (key: MetricKey): string =>
    translate(`data.missing-metrics.metric.${key}`);

  return buildInsight(
    'data.missing-metrics',
    'data',
    'info',
    translate('data.missing-metrics.title'),
    translate('data.missing-metrics.summary', {
      metrics: missing.map(metricName).join(', '),
    }),
    missing.map((key) =>
      translate('data.missing-metrics.evidence.missing', { metric: metricName(key) }),
    ),
    missing.map((key) => ({
      title: translate('data.missing-metrics.rec.title', { metric: metricName(key) }),
      detail: translate('data.missing-metrics.rec.detail', { metric: metricName(key) }),
    })),
  );
}

/** BMI band check, only when height is known. */
function ruleBmi(
  profile: Profile,
  summaries: Record<MetricKey, MetricSummary>,
  locale: Locale,
  translate: InsightTranslator,
): Insight | null {
  const weight = latestWeight(summaries);
  const heightCm = profile.heightCm;
  if (weight === null || !heightCm || heightCm <= 0) return null;

  const value = bmi(weight, heightCm);
  if (value === null) return null;
  const category = bmiCategory(value);
  if (!category) return null;

  const band = bmiLabel(category, locale);
  const range = healthyWeightRange(heightCm);
  const evidence = [
    translate('body.bmi.evidence.value', { value: round(value, 1), band }),
    translate('body.bmi.evidence.latest', { weight: fmt('weight', weight, locale) }),
  ];
  if (range) {
    evidence.push(
      translate('body.bmi.evidence.healthyRange', {
        min: fmt('weight', range.min, locale),
        max: fmt('weight', range.max, locale),
      }),
    );
  }

  if (category === 'healthy') {
    return buildInsight(
      'body.bmi',
      'body',
      'positive',
      translate('body.bmi.title.healthy'),
      translate('body.bmi.summary.healthy', { value: round(value, 1) }),
      evidence,
      [
        {
          title: translate('body.bmi.recHealthy1.title'),
          detail: translate('body.bmi.recHealthy1.detail'),
        },
      ],
    );
  }

  const overweight = category === 'overweight' || category.startsWith('obese');
  const severity: Severity = BMI_SEVERITY[category];

  const recommendations: Recommendation[] = overweight
    ? [
        {
          title: translate('body.bmi.recOverweight1.title'),
          detail: translate('body.bmi.recOverweight1.detail', {
            weight: fmt('weight', weight, locale),
            weekly: fmt('weight', round(weight * 0.005, 2), locale),
          }),
        },
        {
          title: translate('body.bmi.recOverweight2.title'),
          detail: translate('body.bmi.recOverweight2.detail'),
        },
        {
          title: translate('body.bmi.recOverweight3.title'),
          detail: translate('body.bmi.recOverweight3.detail'),
        },
      ]
    : [
        {
          title: translate('body.bmi.recUnderweight1.title'),
          detail: translate('body.bmi.recUnderweight1.detail', { value: round(value, 1) }),
        },
        {
          title: translate('body.bmi.recUnderweight2.title'),
          detail: translate('body.bmi.recUnderweight2.detail'),
        },
      ];

  return buildInsight(
    'body.bmi',
    'body',
    severity,
    translate('body.bmi.title.other', { band: band.toLowerCase() }),
    overweight
      ? translate('body.bmi.summary.above', { value: round(value, 1) })
      : translate('body.bmi.summary.below', { value: round(value, 1) }),
    evidence,
    recommendations,
  );
}

/** Direction and pace of the weight trend. */
function ruleWeightTrend(
  summaries: Record<MetricKey, MetricSummary>,
  locale: Locale,
  translate: InsightTranslator,
): Insight | null {
  const { count, trendPerWeek, latest } = summaries.weight;
  if (count < MIN_DAYS_FOR_TREND || trendPerWeek === null || latest === null || latest === 0) {
    return null;
  }

  const t = THRESHOLDS;
  const trend = round(trendPerWeek, 2);
  const bodyPercentPerWeek = (Math.abs(trend) / latest) * 100;
  const evidence = [
    translate('weight.trend.evidence.trend', {
      value: formatSigned(trend, METRIC_DIGITS.weight, locale),
    }),
    translate('weight.trend.evidence.latest', { weight: fmt('weight', latest, locale) }),
    translate('weight.trend.evidence.basedOn', { count }),
  ];

  if (trend <= -t.weightTrendRapidLossKgPerWeek && bodyPercentPerWeek >= t.weightRapidLossBodyPercentPerWeek) {
    return buildInsight(
      'weight.trend',
      'weight',
      'critical',
      translate('weight.trend.title.rapid'),
      translate('weight.trend.summary.rapid', {
        weight: fmt('weight', Math.abs(trend), locale),
        percent: round(bodyPercentPerWeek, 1),
      }),
      evidence,
      [
        {
          title: translate('weight.trend.recRapid1.title'),
          detail: translate('weight.trend.recRapid1.detail'),
        },
        {
          title: translate('weight.trend.recRapid2.title'),
          detail: translate('weight.trend.recRapid2.detail'),
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
      translate('weight.trend.title.up'),
      translate('weight.trend.summary.up', { weight: fmt('weight', trend, locale) }),
      evidence,
      [
        {
          title: translate('weight.trend.recUp1.title'),
          detail: translate('weight.trend.recUp1.detail'),
        },
        {
          title: translate('weight.trend.recUp2.title'),
          detail: translate('weight.trend.recUp2.detail'),
        },
        {
          title: translate('weight.trend.recUp3.title'),
          detail: translate('weight.trend.recUp3.detail'),
        },
      ],
    );
  }

  if (trend <= -t.weightTrendSignificantKgPerWeek) {
    return buildInsight(
      'weight.trend',
      'weight',
      'info',
      translate('weight.trend.title.down'),
      translate('weight.trend.summary.down', {
        weight: fmt('weight', Math.abs(trend), locale),
      }),
      evidence,
      [
        {
          title: translate('weight.trend.recDown1.title'),
          detail: translate('weight.trend.recDown1.detail'),
        },
        {
          title: translate('weight.trend.recDown2.title'),
          detail: translate('weight.trend.recDown2.detail'),
        },
      ],
    );
  }

  if (trend >= t.weightTrendNegligibleKgPerWeek) {
    return buildInsight(
      'weight.trend',
      'weight',
      'info',
      translate('weight.trend.title.creepUp'),
      translate('weight.trend.summary.creepUp', { weight: fmt('weight', trend, locale) }),
      evidence,
      [
        {
          title: translate('weight.trend.recCreepUp1.title'),
          detail: translate('weight.trend.recCreepUp1.detail'),
        },
      ],
    );
  }

  if (trend <= -t.weightTrendNegligibleKgPerWeek) {
    return buildInsight(
      'weight.trend',
      'weight',
      'info',
      translate('weight.trend.title.creepDown'),
      translate('weight.trend.summary.creepDown', {
        weight: fmt('weight', Math.abs(trend), locale),
      }),
      evidence,
      [
        {
          title: translate('weight.trend.recCreepDown1.title'),
          detail: translate('weight.trend.recCreepDown1.detail'),
        },
      ],
    );
  }

  return buildInsight(
    'weight.trend',
    'weight',
    'positive',
    translate('weight.trend.title.stable'),
    translate('weight.trend.summary.stable', {
      weight: fmt('weight', Math.abs(trend), locale),
    }),
    evidence,
    [
      {
        title: translate('weight.trend.recStable1.title'),
        detail: translate('weight.trend.recStable1.detail'),
      },
    ],
  );
}

/** Distance to, and progress towards, the target weight. */
function ruleWeightGoal(
  profile: Profile,
  summaries: Record<MetricKey, MetricSummary>,
  age: number | null,
  locale: Locale,
  translate: InsightTranslator,
): Insight | null {
  const target = profile.targetWeightKg;
  const latest = latestWeight(summaries);
  if (target === undefined || !Number.isFinite(target) || latest === null) return null;

  const gap = round(target - latest, 1);
  const trend = summaries.weight.trendPerWeek;
  const evidence = [
    translate('weight.goal.evidence.target', { weight: fmt('weight', target, locale) }),
    translate('weight.goal.evidence.current', { weight: fmt('weight', latest, locale) }),
    translate('weight.goal.evidence.gap', {
      gap: formatSigned(gap, METRIC_DIGITS.weight, locale),
    }),
  ];

  if (Math.abs(gap) <= THRESHOLDS.weightGoalToleranceKg) {
    return buildInsight(
      'weight.goal',
      'weight',
      'positive',
      translate('weight.goal.title.reached'),
      translate('weight.goal.summary.reached', {
        gap: fmt('weight', Math.abs(gap), locale),
        target: fmt('weight', target, locale),
      }),
      evidence,
      [
        {
          title: translate('weight.goal.recReached1.title'),
          detail: translate('weight.goal.recReached1.detail'),
        },
      ],
    );
  }

  const weeksToGoal = Math.ceil(Math.abs(gap) / SAFE_PACE_KG_PER_WEEK);
  const recommendations: Recommendation[] = [
    {
      title: translate('weight.goal.rec1.title', { pace: SAFE_PACE_KG_PER_WEEK }),
      detail: translate(
        weeksToGoal === 1 ? 'weight.goal.rec1.detail.one' : 'weight.goal.rec1.detail.other',
        {
          weight: fmt('weight', latest, locale),
          weeks: weeksToGoal,
          target: fmt('weight', target, locale),
        },
      ),
    },
  ];

  const recommended = calorieTargetForGoal(profile, latest, age, target);
  if (recommended !== null) {
    const activity = profile.activityLevel
      ? activityLabel(profile.activityLevel, locale).split(' (')[0]!.toLowerCase()
      : translate('weight.goal.rec2.activity.fallback');
    recommendations.push({
      title: translate('weight.goal.rec2.title', {
        calories: fmt('calories', recommended, locale),
      }),
      detail: translate('weight.goal.rec2.detail', { activity }),
    });
  }
  if (
    trend !== null &&
    Math.sign(trend) !== Math.sign(gap) &&
    Math.abs(trend) >= THRESHOLDS.weightTrendSignificantKgPerWeek
  ) {
    const branch = `${trend > 0 ? 'up' : 'down'}${gap > 0 ? 'Up' : 'Down'}` as const;
    recommendations.push({
      title: translate('weight.goal.rec3.title'),
      detail: translate(`weight.goal.rec3.detail.${branch}`),
    });
  }

  return buildInsight(
    'weight.goal',
    'weight',
    'info',
    gap > 0
      ? translate('weight.goal.title.toGoal', { gap: formatKg(gap, locale) })
      : translate('weight.goal.title.aboveGoal', { gap: formatKg(Math.abs(gap), locale) }),
    gap > 0
      ? translate('weight.goal.summary.toGoal', { gap: formatKg(gap, locale) })
      : translate('weight.goal.summary.aboveGoal', { gap: formatKg(Math.abs(gap), locale) }),
    evidence,
    recommendations,
  );
}

/**
 * Projected arrival at the target weight: how many days and on which date,
 * assuming the current trend continues.
 */
function ruleWeightForecast(
  profile: Profile,
  summaries: Record<MetricKey, MetricSummary>,
  windowEntries: readonly DailyEntry[],
  referenceDate: string,
  locale: Locale,
  translate: InsightTranslator,
): Insight | null {
  const target = profile.targetWeightKg;
  const latest = latestWeight(summaries);
  if (target === undefined || !Number.isFinite(target) || latest === null) return null;

  const gap = target - latest;
  // Within the tolerance the goal rule already reports success, so a forecast
  // would only argue with it.
  if (Math.abs(gap) <= THRESHOLDS.weightGoalToleranceKg) return null;

  // The countdown starts at the last weigh-in - where the trend line is
  // anchored - which is not necessarily the reference date.
  const anchorDate = lastWeighInDate(windowEntries) ?? referenceDate;
  const forecast = forecastWeightGoal(profile, summaries, anchorDate);
  if (forecast === null) return null;

  const { daysToGoal, projectedDate, trendKgPerWeek, gapKg } = forecast;
  const pace = Math.abs(trendKgPerWeek);
  const weeks = round(daysToGoal / 7, 0);
  const daysAtSafePace = Math.ceil((Math.abs(gapKg) / SAFE_PACE_KG_PER_WEEK) * 7 - 1e-6);

  const recommendations: Recommendation[] = [
    {
      title: translate('weight.forecast.rec1.title'),
      detail: translate('weight.forecast.rec1.detail'),
    },
  ];
  if (daysAtSafePace <= FORECAST_LIMITS.maxHorizonDays) {
    recommendations.push({
      title: translate('weight.forecast.rec2.title'),
      detail: translate('weight.forecast.rec2.detail', {
        pace: SAFE_PACE_KG_PER_WEEK,
        days: formatNumber(daysAtSafePace, 0, locale),
      }),
    });
  }

  const paceText = fmt('weight', pace, locale);
  const targetText = fmt('weight', target, locale);
  const daysText = formatNumber(daysToGoal, 0, locale);
  const arrivalText = formatLongDate(projectedDate, locale);
  const anchorText = formatShortDate(anchorDate, locale);

  return buildInsight(
    'weight.forecast',
    'weight',
    'info',
    translate('weight.forecast.title', { days: daysText }),
    translate(
      daysToGoal >= 21 ? 'weight.forecast.summary.withWeeks' : 'weight.forecast.summary.short',
      {
        pace: paceText,
        target: targetText,
        days: daysText,
        weeks: formatNumber(weeks, 0, locale),
        date: arrivalText,
      },
    ),
    [
      translate('weight.forecast.evidence.trend', {
        trend: formatSigned(trendKgPerWeek, METRIC_DIGITS.weight, locale),
      }),
      translate('weight.forecast.evidence.current', {
        weight: fmt('weight', latest, locale),
        date: anchorText,
      }),
      translate('weight.forecast.evidence.target', { weight: targetText }),
      translate('weight.forecast.evidence.gap', {
        gap: formatSigned(gapKg, METRIC_DIGITS.weight, locale),
      }),
      translate('weight.forecast.evidence.arrival', {
        date: arrivalText,
        days: daysText,
        from: anchorText,
      }),
    ],
    recommendations,
  );
}

/** Average sleep quality against the personal goal. */
function ruleSleepAverage(
  profile: Profile,
  summaries: Record<MetricKey, MetricSummary>,
  locale: Locale,
  translate: InsightTranslator,
): Insight | null {
  const { count, average } = summaries.sleep;
  if (count < MIN_DAYS_FOR_INSIGHTS || average === null) return null;

  const goal = sleepGoal(profile);
  const avg = round(average, 1);
  const deficit = round(goal - avg, 1);
  const evidence = [
    translate('sleep.average.evidence.average', { value: fmt('sleep', avg, locale) }),
    translate('sleep.average.evidence.goal', { value: fmt('sleep', goal, locale) }),
    translate('sleep.average.evidence.basedOn', { count }),
  ];

  if (avg <= THRESHOLDS.sleepVeryPoorQuality) {
    return buildInsight(
      'sleep.average',
      'recovery',
      'critical',
      translate('sleep.average.title.veryPoor'),
      translate('sleep.average.summary.veryPoor', { value: fmt('sleep', avg, locale) }),
      evidence,
      [
        {
          title: translate('sleep.average.recVeryPoor1.title'),
          detail: translate('sleep.average.recVeryPoor1.detail'),
        },
        {
          title: translate('sleep.average.recVeryPoor2.title'),
          detail: translate('sleep.average.recVeryPoor2.detail'),
        },
        {
          title: translate('sleep.average.recVeryPoor3.title'),
          detail: translate('sleep.average.recVeryPoor3.detail'),
        },
      ],
    );
  }

  if (deficit > THRESHOLDS.sleepDeficitQuality) {
    return buildInsight(
      'sleep.average',
      'recovery',
      'warning',
      translate('sleep.average.title.below'),
      translate('sleep.average.summary.below', {
        value: fmt('sleep', avg, locale),
        deficit: fmt('sleep', deficit, locale),
        goal: fmt('sleep', goal, locale),
      }),
      evidence,
      [
        {
          title: translate('sleep.average.recBelow1.title'),
          detail: translate('sleep.average.recBelow1.detail'),
        },
        {
          title: translate('sleep.average.recBelow2.title'),
          detail: translate('sleep.average.recBelow2.detail'),
        },
        {
          title: translate('sleep.average.recBelow3.title'),
          detail: translate('sleep.average.recBelow3.detail'),
        },
      ],
    );
  }

  return buildInsight(
    'sleep.average',
    'recovery',
    'positive',
    translate('sleep.average.title.onTarget'),
    translate('sleep.average.summary.onTarget', {
      value: fmt('sleep', avg, locale),
      goal: fmt('sleep', goal, locale),
    }),
    evidence,
    [
      {
        title: translate('sleep.average.recOnTarget1.title'),
        detail: translate('sleep.average.recOnTarget1.detail'),
      },
    ],
  );
}

/** Night-to-night consistency, measured as the coefficient of variation. */
function ruleSleepRegularity(
  summaries: Record<MetricKey, MetricSummary>,
  locale: Locale,
  translate: InsightTranslator,
): Insight | null {
  const { count, average, stdDev } = summaries.sleep;
  if (count < MIN_DAYS_FOR_TREND || average === null || stdDev === null) return null;

  const cv = variationRatio(average, stdDev);
  if (cv === null) return null;

  const percent = formatNumber(round(cv, 0), 0, locale);
  const evidence = [
    translate('sleep.regularity.evidence.variation', {
      value: fmt('sleep', stdDev, locale),
    }),
    translate('sleep.regularity.evidence.cv', { percent }),
    translate('sleep.regularity.evidence.average', {
      value: fmt('sleep', average, locale),
      count,
    }),
  ];

  if (cv <= THRESHOLDS.sleepIrregularCvPercent) {
    return buildInsight(
      'sleep.regularity',
      'recovery',
      'positive',
      translate('sleep.regularity.title.consistent'),
      translate('sleep.regularity.summary.consistent', { percent }),
      evidence,
      [
        {
          title: translate('sleep.regularity.recConsistent1.title'),
          detail: translate('sleep.regularity.recConsistent1.detail'),
        },
      ],
    );
  }

  return buildInsight(
    'sleep.regularity',
    'recovery',
    'warning',
    translate('sleep.regularity.title.irregular'),
    translate('sleep.regularity.summary.irregular', { percent }),
    evidence,
    [
      {
        title: translate('sleep.regularity.recIrregular1.title'),
        detail: translate('sleep.regularity.recIrregular1.detail'),
      },
      {
        title: translate('sleep.regularity.recIrregular2.title'),
        detail: translate('sleep.regularity.recIrregular2.detail'),
      },
      {
        title: translate('sleep.regularity.recIrregular3.title'),
        detail: translate('sleep.regularity.recIrregular3.detail'),
      },
    ],
  );
}

/** Cross-metric: poor sleep quality alongside a rising weight. */
function ruleSleepWeightInteraction(
  summaries: Record<MetricKey, MetricSummary>,
  locale: Locale,
  translate: InsightTranslator,
): Insight | null {
  if (summaries.sleep.count < MIN_DAYS_FOR_TREND || summaries.weight.count < MIN_DAYS_FOR_TREND) {
    return null;
  }
  const sleepAvg = summaries.sleep.average;
  const trend = summaries.weight.trendPerWeek;
  if (sleepAvg === null || trend === null) return null;

  if (sleepAvg >= THRESHOLDS.sleepPoorQuality) return null;
  if (trend < THRESHOLDS.weightTrendSignificantKgPerWeek) return null;

  return buildInsight(
    'sleep.weight-interaction',
    'recovery',
    'warning',
    translate('sleep.weight-interaction.title'),
    translate('sleep.weight-interaction.summary', {
      sleep: fmt('sleep', sleepAvg, locale),
      weight: fmt('weight', trend, locale),
    }),
    [
      translate('sleep.weight-interaction.evidence.average', {
        value: fmt('sleep', sleepAvg, locale),
      }),
      translate('sleep.weight-interaction.evidence.trend', {
        trend: formatSigned(trend, METRIC_DIGITS.weight, locale),
      }),
    ],
    [
      {
        title: translate('sleep.weight-interaction.rec1.title'),
        detail: translate('sleep.weight-interaction.rec1.detail'),
      },
      {
        title: translate('sleep.weight-interaction.rec2.title'),
        detail: translate('sleep.weight-interaction.rec2.detail'),
      },
    ],
  );
}

/** Average steps against the daily goal. */
function ruleSteps(
  profile: Profile,
  summaries: Record<MetricKey, MetricSummary>,
  locale: Locale,
  translate: InsightTranslator,
): Insight | null {
  const { count, average } = summaries.steps;
  if (count < MIN_DAYS_FOR_INSIGHTS || average === null) return null;

  const goal = stepGoal(profile);
  const avg = round(average, 0);
  // `goal <= 0` would divide by zero and make every ratio meaningless, so treat
  // it as "no target" and fall through to the goal-met branch.
  const ratio = goal > 0 ? avg / goal : null;

  const evidence = [
    translate('steps.average.evidence.average', { steps: fmt('steps', avg, locale) }),
    translate('steps.average.evidence.goal', { steps: fmt('steps', goal, locale) }),
    translate('steps.average.evidence.basedOn', { count }),
  ];
  if (ratio !== null) {
    evidence.push(
      translate('steps.average.evidence.goalPercent', {
        percent: formatNumber(Math.round(ratio * 100), 0, locale),
      }),
    );
  }

  if (ratio !== null && ratio < THRESHOLDS.stepsVeryLowRatio) {
    return buildInsight(
      'steps.average',
      'activity',
      'warning',
      translate('steps.average.title.veryLow'),
      translate('steps.average.summary.veryLow', {
        steps: fmt('steps', avg, locale),
        goal: fmt('steps', goal, locale),
      }),
      evidence,
      [
        {
          title: translate('steps.average.recVeryLow1.title'),
          detail: translate('steps.average.recVeryLow1.detail'),
        },
        {
          title: translate('steps.average.recVeryLow2.title'),
          detail: translate('steps.average.recVeryLow2.detail'),
        },
      ],
    );
  }

  if (ratio !== null && ratio < THRESHOLDS.stepsLowRatio) {
    return buildInsight(
      'steps.average',
      'activity',
      'info',
      translate('steps.average.title.below'),
      translate('steps.average.summary.below', {
        steps: fmt('steps', avg, locale),
        percent: formatNumber(Math.round((1 - ratio) * 100), 0, locale),
      }),
      evidence,
      [
        {
          title: translate('steps.average.recBelow1.title'),
          detail: translate('steps.average.recBelow1.detail'),
        },
      ],
    );
  }

  return buildInsight(
    'steps.average',
    'activity',
    'positive',
    translate('steps.average.title.met'),
    translate('steps.average.summary.met', {
      steps: fmt('steps', avg, locale),
      goal: fmt('steps', goal, locale),
    }),
    evidence,
    [
      {
        title: translate('steps.average.recMet1.title'),
        detail: translate('steps.average.recMet1.detail'),
      },
    ],
  );
}

/** Are steps trending up or down? */
function ruleStepsTrend(
  summaries: Record<MetricKey, MetricSummary>,
  locale: Locale,
  translate: InsightTranslator,
): Insight | null {
  const { count, trendPerWeek } = summaries.steps;
  if (count < MIN_DAYS_FOR_TREND || trendPerWeek === null) return null;

  const trend = round(trendPerWeek, 0);
  const threshold = THRESHOLDS.stepsTrendThresholdPerWeek;
  const evidence = [
    translate('steps.trend.evidence.trend', {
      trend: formatSigned(trend, METRIC_DIGITS.steps, locale),
    }),
    translate('steps.trend.evidence.logged', { count }),
  ];

  if (trend <= -threshold) {
    return buildInsight(
      'steps.trend',
      'activity',
      'warning',
      translate('steps.trend.title.declining'),
      translate('steps.trend.summary.declining', {
        steps: fmt('steps', Math.abs(trend), locale),
      }),
      evidence,
      [
        {
          title: translate('steps.trend.recDeclining1.title'),
          detail: translate('steps.trend.recDeclining1.detail'),
        },
        {
          title: translate('steps.trend.recDeclining2.title'),
          detail: translate('steps.trend.recDeclining2.detail'),
        },
      ],
    );
  }

  if (trend >= threshold) {
    return buildInsight(
      'steps.trend',
      'activity',
      'positive',
      translate('steps.trend.title.up'),
      translate('steps.trend.summary.up', { steps: fmt('steps', trend, locale) }),
      evidence,
      [
        {
          title: translate('steps.trend.recUp1.title'),
          detail: translate('steps.trend.recUp1.detail'),
        },
      ],
    );
  }

  return null;
}

/** Average physical activity rating against the personal goal. */
function ruleActivityAverage(
  profile: Profile,
  summaries: Record<MetricKey, MetricSummary>,
  locale: Locale,
  translate: InsightTranslator,
): Insight | null {
  const { count, average } = summaries.activity;
  if (count < MIN_DAYS_FOR_INSIGHTS || average === null) return null;

  const goal = activityGoal(profile);
  const avg = round(average, 1);
  const deficit = round(goal - avg, 1);
  const evidence = [
    translate('activity.average.evidence.average', { value: fmt('activity', avg, locale) }),
    translate('activity.average.evidence.goal', { value: fmt('activity', goal, locale) }),
    translate('activity.average.evidence.basedOn', { count }),
  ];

  if (avg <= THRESHOLDS.activityVeryLowRating) {
    return buildInsight(
      'activity.average',
      'activity',
      'warning',
      translate('activity.average.title.veryLow'),
      translate('activity.average.summary.veryLow', { value: fmt('activity', avg, locale) }),
      evidence,
      [
        {
          title: translate('activity.average.recVeryLow1.title'),
          detail: translate('activity.average.recVeryLow1.detail'),
        },
        {
          title: translate('activity.average.recVeryLow2.title'),
          detail: translate('activity.average.recVeryLow2.detail'),
        },
      ],
    );
  }

  if (deficit > THRESHOLDS.activityDeficitRating) {
    return buildInsight(
      'activity.average',
      'activity',
      'info',
      translate('activity.average.title.below'),
      translate('activity.average.summary.below', {
        value: fmt('activity', avg, locale),
        deficit: fmt('activity', deficit, locale),
        goal: fmt('activity', goal, locale),
      }),
      evidence,
      [
        {
          title: translate('activity.average.recBelow1.title'),
          detail: translate('activity.average.recBelow1.detail'),
        },
        {
          title: translate('activity.average.recBelow2.title'),
          detail: translate('activity.average.recBelow2.detail'),
        },
      ],
    );
  }

  return buildInsight(
    'activity.average',
    'activity',
    'positive',
    translate('activity.average.title.onTarget'),
    translate('activity.average.summary.onTarget', {
      value: fmt('activity', avg, locale),
      goal: fmt('activity', goal, locale),
    }),
    evidence,
    [
      {
        title: translate('activity.average.recOnTarget1.title'),
        detail: translate('activity.average.recOnTarget1.detail'),
      },
    ],
  );
}

/** How steady the activity rating is from day to day. */
function ruleActivityRegularity(
  summaries: Record<MetricKey, MetricSummary>,
  locale: Locale,
  translate: InsightTranslator,
): Insight | null {
  const { count, average, stdDev } = summaries.activity;
  if (count < MIN_DAYS_FOR_TREND || average === null || stdDev === null) return null;

  const cv = variationRatio(average, stdDev);
  if (cv === null) return null;

  const percent = formatNumber(round(cv, 0), 0, locale);
  const evidence = [
    translate('activity.regularity.evidence.variation', {
      value: fmt('activity', stdDev, locale),
    }),
    translate('activity.regularity.evidence.cv', { percent }),
    translate('activity.regularity.evidence.average', {
      value: fmt('activity', average, locale),
      count,
    }),
  ];

  if (cv <= THRESHOLDS.activityIrregularCvPercent) {
    return buildInsight(
      'activity.regularity',
      'activity',
      'positive',
      translate('activity.regularity.title.steady'),
      translate('activity.regularity.summary.steady', { percent }),
      evidence,
      [
        {
          title: translate('activity.regularity.recSteady1.title'),
          detail: translate('activity.regularity.recSteady1.detail'),
        },
      ],
    );
  }

  return buildInsight(
    'activity.regularity',
    'activity',
    'info',
    translate('activity.regularity.title.bursts'),
    translate('activity.regularity.summary.bursts', { percent }),
    evidence,
    [
      {
        title: translate('activity.regularity.recBursts1.title'),
        detail: translate('activity.regularity.recBursts1.detail'),
      },
      {
        title: translate('activity.regularity.recBursts2.title'),
        detail: translate('activity.regularity.recBursts2.detail'),
      },
    ],
  );
}

/**
 * Cross-check: does the self-rated activity match the logged step count?
 * A disagreement usually means the two are measuring different things - a
 * bike, a swim or a weights session adds far fewer steps than it adds effort.
 */
function ruleActivityStepsAlignment(
  profile: Profile,
  summaries: Record<MetricKey, MetricSummary>,
  locale: Locale,
  translate: InsightTranslator,
): Insight | null {
  if (summaries.activity.count < MIN_DAYS_FOR_TREND) return null;
  if (summaries.steps.count < MIN_DAYS_FOR_TREND) return null;

  const rating = summaries.activity.average;
  const steps = summaries.steps.average;
  if (rating === null || steps === null) return null;

  const goal = stepGoal(profile);
  const stepRatio = goal > 0 ? steps / goal : null;
  if (stepRatio === null) return null;

  const percent = formatNumber(Math.round(stepRatio * 100), 0, locale);
  const evidence = [
    translate('activity.steps-alignment.evidence.rating', {
      value: fmt('activity', rating, locale),
    }),
    translate('activity.steps-alignment.evidence.steps', {
      steps: fmt('steps', steps, locale),
    }),
    translate('activity.steps-alignment.evidence.goalPercent', { percent }),
  ];

  // A high rating with very few steps means the training was not walkable.
  if (rating >= THRESHOLDS.activityHighRating && stepRatio < THRESHOLDS.stepsVeryLowRatio) {
    return buildInsight(
      'activity.steps-alignment',
      'activity',
      'info',
      translate('activity.steps-alignment.title.understates'),
      translate('activity.steps-alignment.summary.understates', {
        rating: fmt('activity', rating, locale),
        percent,
      }),
      evidence,
      [
        {
          title: translate('activity.steps-alignment.recUnderstates1.title'),
          detail: translate('activity.steps-alignment.recUnderstates1.detail'),
        },
        {
          title: translate('activity.steps-alignment.recUnderstates2.title'),
          detail: translate('activity.steps-alignment.recUnderstates2.detail'),
        },
      ],
    );
  }

  // A moderate rating with the step goal met reads as too harsh. Very low
  // ratings are left to the average rule, which gives better advice.
  if (
    rating < activityGoal(profile) &&
    rating > THRESHOLDS.activityVeryLowRating &&
    stepRatio >= 1
  ) {
    return buildInsight(
      'activity.steps-alignment',
      'activity',
      'info',
      translate('activity.steps-alignment.title.low'),
      translate('activity.steps-alignment.summary.low', {
        rating: fmt('activity', rating, locale),
        steps: fmt('steps', steps, locale),
      }),
      evidence,
      [
        {
          title: translate('activity.steps-alignment.recLow1.title'),
          detail: translate('activity.steps-alignment.recLow1.detail'),
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
  age: number | null,
  locale: Locale,
  translate: InsightTranslator,
): Insight | null {
  const { count, average } = summaries.calories;
  if (count < MIN_DAYS_FOR_INSIGHTS || average === null) return null;

  const weight = latestWeight(summaries);
  const estimatedBurn = weight === null ? null : totalDailyEnergyExpenditure(profile, weight, age);
  const target = profile.dailyCalorieGoal ?? estimatedBurn;

  const avg = round(average, 0);
  const evidence = [
    translate('calories.balance.evidence.average', { calories: fmt('calories', avg, locale) }),
    translate('calories.balance.evidence.basedOn', { count }),
  ];
  if (estimatedBurn !== null) {
    evidence.push(
      translate('calories.balance.evidence.burn', {
        calories: fmt('calories', estimatedBurn, locale),
      }),
    );
  }
  if (profile.dailyCalorieGoal !== undefined) {
    evidence.push(
      translate('calories.balance.evidence.target', {
        calories: fmt('calories', profile.dailyCalorieGoal, locale),
      }),
    );
  }

  if (target === null) {
    return buildInsight(
      'calories.balance',
      'energy',
      'info',
      translate('calories.balance.title.noTarget'),
      translate('calories.balance.summary.noTarget'),
      evidence,
      [
        {
          title: translate('calories.balance.recNoTarget1.title'),
          detail: translate('calories.balance.recNoTarget1.detail'),
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
      translate('calories.balance.title.severeDeficit'),
      translate('calories.balance.summary.severeDeficit', {
        avg: fmt('calories', avg, locale),
        target: fmt('calories', target, locale),
        deficit: fmt('calories', Math.abs(diff), locale),
      }),
      evidence,
      [
        {
          title: translate('calories.balance.recSevere1.title'),
          detail: translate('calories.balance.recSevere1.detail'),
        },
        {
          title: translate('calories.balance.recSevere2.title'),
          detail: translate('calories.balance.recSevere2.detail'),
        },
      ],
    );
  }

  if (ratio <= -t.calorieDeficitRatio) {
    return buildInsight(
      'calories.balance',
      'energy',
      'warning',
      translate('calories.balance.title.largeDeficit'),
      translate('calories.balance.summary.largeDeficit', {
        calories: fmt('calories', Math.abs(diff), locale),
      }),
      evidence,
      [
        {
          title: translate('calories.balance.recDeficit1.title'),
          detail: translate('calories.balance.recDeficit1.detail', {
            protein: fmt(
              'weight',
              weight === null ? null : round(weight * 1.6, 0),
              locale,
            ),
          }),
        },
        {
          title: translate('calories.balance.recDeficit2.title'),
          detail: translate('calories.balance.recDeficit2.detail'),
        },
      ],
    );
  }

  if (ratio >= t.calorieSurplusRatio) {
    return buildInsight(
      'calories.balance',
      'energy',
      'warning',
      translate('calories.balance.title.surplus'),
      translate('calories.balance.summary.surplus', {
        calories: fmt('calories', diff, locale),
      }),
      evidence,
      [
        {
          title: translate('calories.balance.recSurplus1.title'),
          detail: translate('calories.balance.recSurplus1.detail'),
        },
        {
          title: translate('calories.balance.recSurplus2.title'),
          detail: translate('calories.balance.recSurplus2.detail'),
        },
      ],
    );
  }

  if (Math.abs(ratio) <= t.calorieBalanceToleranceRatio) {
    return buildInsight(
      'calories.balance',
      'energy',
      'positive',
      translate('calories.balance.title.matched'),
      translate('calories.balance.summary.matched', {
        avg: fmt('calories', avg, locale),
        target: fmt('calories', target, locale),
      }),
      evidence,
      [
        {
          title: translate('calories.balance.recMatched1.title'),
          detail: translate('calories.balance.recMatched1.detail'),
        },
      ],
    );
  }

  return buildInsight(
    'calories.balance',
    'energy',
    'info',
    translate(
      Math.abs(ratio) < t.calorieDeficitRatio
        ? 'calories.balance.title.mildDeficit'
        : 'calories.balance.title.mildSurplus',
    ),
    translate(ratio < 0 ? 'calories.balance.summary.below' : 'calories.balance.summary.above', {
      calories: fmt('calories', Math.abs(diff), locale),
      target: fmt('calories', target, locale),
    }),
    evidence,
    [
      {
        title: translate('calories.balance.recMild1.title'),
        detail: translate('calories.balance.recMild1.detail'),
      },
    ],
  );
}

/** Day-to-day swings in intake. */
function ruleCalorieStability(
  summaries: Record<MetricKey, MetricSummary>,
  locale: Locale,
  translate: InsightTranslator,
): Insight | null {
  const { count, average, stdDev } = summaries.calories;
  if (count < MIN_DAYS_FOR_TREND) return null;

  const cv = variationRatio(average, stdDev);
  if (cv === null) return null;

  const percent = formatNumber(round(cv, 0), 0, locale);
  const evidence = [
    translate('calories.stability.evidence.variation', { percent }),
    translate('calories.stability.evidence.logged', { count }),
  ];

  if (cv <= THRESHOLDS.calorieIrregularCvPercent) {
    return buildInsight(
      'calories.stability',
      'energy',
      'positive',
      translate('calories.stability.title.steady'),
      translate('calories.stability.summary.steady', { percent }),
      evidence,
      [
        {
          title: translate('calories.stability.recSteady1.title'),
          detail: translate('calories.stability.recSteady1.detail'),
        },
      ],
    );
  }

  return buildInsight(
    'calories.stability',
    'energy',
    'warning',
    translate('calories.stability.title.erratic'),
    translate('calories.stability.summary.erratic', { percent }),
    evidence,
    [
      {
        title: translate('calories.stability.recErratic1.title'),
        detail: translate('calories.stability.recErratic1.detail'),
      },
      {
        title: translate('calories.stability.recErratic2.title'),
        detail: translate('calories.stability.recErratic2.detail'),
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
  age: number | null,
  locale: Locale,
  translate: InsightTranslator,
): Insight | null {
  if (summaries.calories.count < MIN_DAYS_FOR_TREND) return null;
  if (summaries.weight.count < MIN_DAYS_FOR_TREND) return null;

  const weightTrend = summaries.weight.trendPerWeek;
  const calorieAvg = summaries.calories.average;
  const weight = latestWeight(summaries);
  if (weightTrend === null || calorieAvg === null || weight === null) return null;

  const burn = totalDailyEnergyExpenditure(profile, weight, age) ?? profile.dailyCalorieGoal ?? null;
  if (burn === null) return null;

  // Intake that would explain the weight we actually observe.
  const expectedIntake = burn + dailyCalorieDeltaForWeightChange(weightTrend);
  const deviation = calorieAvg - expectedIntake;
  const ratio = burn > 0 ? deviation / burn : 0;

  const evidence = [
    translate('calories.weight-alignment.evidence.trend', {
      trend: formatSigned(weightTrend, METRIC_DIGITS.weight, locale),
    }),
    translate('calories.weight-alignment.evidence.expected', {
      calories: fmt('calories', expectedIntake, locale),
    }),
    translate('calories.weight-alignment.evidence.actual', {
      calories: fmt('calories', calorieAvg, locale),
    }),
    translate('calories.weight-alignment.evidence.gap', {
      gap: formatSigned(deviation, METRIC_DIGITS.calories, locale),
    }),
  ];

  if (Math.abs(ratio) > THRESHOLDS.alignmentToleranceRatio) {
    return buildInsight(
      'calories.weight-alignment',
      'energy',
      'warning',
      translate('calories.weight-alignment.title.disagree'),
      translate('calories.weight-alignment.summary.disagree', {
        calories: fmt('calories', Math.abs(deviation), locale),
      }),
      evidence,
      [
        {
          title: translate('calories.weight-alignment.recDisagree1.title'),
          detail: translate('calories.weight-alignment.recDisagree1.detail'),
        },
        {
          title: translate('calories.weight-alignment.recDisagree2.title'),
          detail: translate('calories.weight-alignment.recDisagree2.detail'),
        },
      ],
    );
  }

  return buildInsight(
    'calories.weight-alignment',
    'energy',
    'positive',
    translate('calories.weight-alignment.title.consistent'),
    translate('calories.weight-alignment.summary.consistent', {
      calories: fmt('calories', Math.abs(deviation), locale),
    }),
    evidence,
    [
      {
        title: translate('calories.weight-alignment.recConsistent1.title'),
        detail: translate('calories.weight-alignment.recConsistent1.detail'),
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
  /** Locale used to format dates and numbers in insight text. Defaults to `en`. */
  locale?: Locale;
  /** Source of insight text. Defaults to the English translator. */
  translate?: InsightTranslator;
}

export function analyzeHealth(
  entries: readonly DailyEntry[],
  profile: Profile = {},
  options: AnalyzeOptions = {},
): HealthReport {
  const referenceDate = options.referenceDate ?? toISODate(new Date());
  const windowDays = Math.max(1, options.windowDays ?? DEFAULT_WINDOW_DAYS);
  const locale = options.locale ?? 'en';
  const translate = options.translate ?? enInsightTranslator;
  const windowEnd = referenceDate;
  const windowStart = addDays(windowEnd, -(windowDays - 1));

  // Age is derived from the birth date against the reference date, so nothing
  // in the rules touches the clock.
  const age = ageFromBirthDate(profile.birthDate ?? '', referenceDate);

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

  add(ruleInsufficientData(loggedDays, windowDays, windowStart, windowEnd, locale, translate));
  add(ruleCoverage(loggedDays, windowDays, locale, translate));
  add(ruleMissingMetrics(summaries, locale, translate));
  add(ruleBmi(profile, summaries, locale, translate));
  add(ruleWeightTrend(summaries, locale, translate));
  add(ruleWeightGoal(profile, summaries, age, locale, translate));
  add(ruleWeightForecast(profile, summaries, windowEntries, referenceDate, locale, translate));
  add(ruleSleepAverage(profile, summaries, locale, translate));
  add(ruleSleepRegularity(summaries, locale, translate));
  add(ruleSleepWeightInteraction(summaries, locale, translate));
  add(ruleSteps(profile, summaries, locale, translate));
  add(ruleStepsTrend(summaries, locale, translate));
  add(ruleActivityAverage(profile, summaries, locale, translate));
  add(ruleActivityRegularity(summaries, locale, translate));
  add(ruleActivityStepsAlignment(profile, summaries, locale, translate));
  add(ruleCalorieBalance(profile, summaries, age, locale, translate));
  add(ruleCalorieStability(summaries, locale, translate));
  add(ruleCalorieWeightAlignment(profile, summaries, age, locale, translate));

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

// ---------------------------------------------------------------------------
// rolling health score
// ---------------------------------------------------------------------------

/** One day of the rolling health-score timeline. */
export interface ScoreTimelinePoint {
  /** ISO date the score is "as of". */
  date: string;
  /** Score a report ending on this date would show, or `null` when the
   * trailing window did not have enough data yet. */
  score: number | null;
}

/** The health score plotted over time, plus headline statistics. */
export interface ScoreTimeline {
  /** One point per calendar day of the span, ascending. */
  points: ScoreTimelinePoint[];
  /** Score as of `referenceDate`; identical to `analyzeHealth(...).score`. */
  current: number | null;
  /** Mean of the scored days, or `null` when none were scored. */
  average: number | null;
  /** Least-squares score change per week, or `null` below two scored days. */
  trendPerWeek: number | null;
  /** Length of the trailing window each point was scored over. */
  windowDays: number;
}

export interface ScoreTimelineOptions extends AnalyzeOptions {
  /** Days the timeline spans, ending at `referenceDate`. Defaults to `windowDays`. */
  spanDays?: number;
}

/**
 * The health score over time: one point per day, each scored as a report
 * ending on that day with the same trailing window length would be.
 *
 * Two properties follow from that definition and are worth keeping: the last
 * point is always identical to the current report's score, and days before
 * the minimum data threshold are `null` - so the chart's gaps mean "not
 * enough data yet", exactly like the metric timelines.
 */
export function scoreTimeline(
  entries: readonly DailyEntry[],
  profile: Profile = {},
  options: ScoreTimelineOptions = {},
): ScoreTimeline {
  const referenceDate = options.referenceDate ?? toISODate(new Date());
  const windowDays = Math.max(1, options.windowDays ?? DEFAULT_WINDOW_DAYS);
  const spanDays = Math.max(1, options.spanDays ?? windowDays);
  const locale = options.locale ?? 'en';
  const translate = options.translate ?? enInsightTranslator;

  const points: ScoreTimelinePoint[] = lastNDays(referenceDate, spanDays).map((date) => ({
    date,
    score: analyzeHealth(entries, profile, {
      referenceDate: date,
      windowDays,
      locale,
      translate,
    }).score,
  }));

  const current = points.length > 0 ? points[points.length - 1]!.score : null;
  const scored = points
    .map((point, index) => ({ x: index, y: point.score }))
    .filter((point): point is { x: number; y: number } => point.y !== null);

  // The points are one per consecutive day, so x is already in days and the
  // slope scales to a week the same way `summarizeMetric` scales its trend.
  const regression = scored.length >= 2 ? linearRegression(scored) : null;

  return {
    points,
    current,
    average: mean(scored.map((point) => point.y)),
    trendPerWeek: regression ? regression.slope * 7 : null,
    windowDays,
  };
}

/** Human-readable label for a metric, used by the UI. */
export const METRIC_LABELS: Record<MetricKey, string> = {
  weight: 'Weight',
  steps: 'Steps',
  sleep: 'Sleep',
  activity: 'Physical activity',
  calories: 'Calories',
};