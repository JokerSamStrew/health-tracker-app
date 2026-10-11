/**
 * Domain model for the health tracker.
 *
 * All numeric measurements use these units:
 * - weight:  kilograms (kg)
 * - steps:   steps per day (count)
 * - sleep:   subjective quality rating, 1-5 (/5)
 * - calories: kilocalories per day (kcal)
 */

export const METRIC_KEYS = ['weight', 'steps', 'sleep', 'calories'] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export const METRIC_UNITS: Record<MetricKey, string> = {
  weight: 'kg',
  steps: 'steps',
  sleep: '/5',
  calories: 'kcal',
};

/** Physiologically plausible bounds, used for input validation. */
export const METRIC_RANGES: Record<MetricKey, { min: number; max: number; step: number }> = {
  weight: { min: 20, max: 400, step: 0.1 },
  steps: { min: 0, max: 200_000, step: 1 },
  sleep: { min: 1, max: 5, step: 0.5 },
  calories: { min: 0, max: 20_000, step: 1 },
};

/** One calendar day of measurements. Every field is optional. */
export interface DailyEntry {
  /** ISO calendar date, `YYYY-MM-DD`, in the user's local timezone. */
  date: string;
  weightKg?: number;
  steps?: number;
  /** Subjective sleep quality on a 1-5 scale, halves allowed. */
  sleepQuality?: number;
  calories?: number;
  note?: string;
}

export type Sex = 'male' | 'female';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';

export interface Profile {
  name?: string;
  age?: number;
  sex?: Sex;
  heightCm?: number;
  activityLevel?: ActivityLevel;
  /** Weight the user is aiming for, used by the weight-goal insight. */
  targetWeightKg?: number;
  /** Daily calorie intake target. Falls back to the estimated TDEE when omitted. */
  dailyCalorieGoal?: number;
  dailyStepGoal?: number;
  /** Nightly sleep quality target on a 1-5 scale. Defaults to 4. */
  sleepGoalQuality?: number;
}

export interface MetricSummary {
  key: MetricKey;
  unit: string;
  /** Number of logged values in the analysed window. */
  count: number;
  latest: number | null;
  previous: number | null;
  average: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  stdDev: number | null;
  /** Change between the first and last value of the window. */
  change: number | null;
  /** Least-squares slope per 7 days, or `null` when it cannot be computed. */
  trendPerWeek: number | null;
}

export type Severity = 'info' | 'warning' | 'critical' | 'positive';

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  positive: 3,
};

export interface Recommendation {
  title: string;
  detail: string;
}

/** Broad grouping used to lay insights out in the UI. */
export type InsightCategory =
  | MetricKey
  | 'body'
  | 'activity'
  | 'recovery'
  | 'energy'
  | 'data';

export interface Insight {
  /** Stable identifier, useful as a React key and in tests. */
  id: string;
  category: InsightCategory;
  severity: Severity;
  title: string;
  /** One-sentence explanation of what the data shows. */
  summary: string;
  /** Human readable numbers backing the claim. */
  evidence: string[];
  recommendations: Recommendation[];
}

export interface HealthReport {
  /** `YYYY-MM-DD` used as "today" for the analysis. */
  referenceDate: string;
  windowStart: string;
  windowEnd: string;
  windowDays: number;
  summaries: Record<MetricKey, MetricSummary>;
  /** 0-100, higher is better. `null` when there is not enough data. */
  score: number | null;
  insights: Insight[];
  /** Number of insights per severity, handy for the UI badges. */
  counts: Record<Severity, number>;
}

export const DEFAULT_PROFILE: Profile = {
  dailyStepGoal: 8000,
  sleepGoalQuality: 4,
  activityLevel: 'moderate',
};