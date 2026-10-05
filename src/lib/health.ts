/**
 * Body-composition and energy-expenditure formulas.
 *
 * The equations are the standard clinical approximations:
 * - BMI: weight (kg) / height (m)^2
 * - BMR: Mifflin-St Jeor (1990)
 * - TDEE: BMR * physical activity level (Harris-Benedict style multipliers)
 *
 * They are intentionally kept here, free of any UI or storage concerns, so the
 * insight engine and the tests can use them directly.
 */

import { clamp } from './stats.ts';
import type { ActivityLevel, Profile } from '../types.ts';

/** Multipliers applied to BMR to estimate total daily energy expenditure. */
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary (little exercise, desk job)',
  light: 'Lightly active (1-3 sessions / week)',
  moderate: 'Moderately active (3-5 sessions / week)',
  active: 'Very active (6-7 sessions / week)',
  athlete: 'Athlete (physical job or 2x training daily)',
};

export type BmiCategory =
  | 'underweight'
  | 'healthy'
  | 'overweight'
  | 'obese-i'
  | 'obese-ii'
  | 'obese-iii';

export const BMI_CATEGORIES: Record<BmiCategory, { label: string; max: number; min: number }> = {
  underweight: { label: 'Underweight', min: 0, max: 18.5 },
  healthy: { label: 'Healthy weight', min: 18.5, max: 25 },
  overweight: { label: 'Overweight', min: 25, max: 30 },
  'obese-i': { label: 'Obesity (class I)', min: 30, max: 35 },
  'obese-ii': { label: 'Obesity (class II)', min: 35, max: 40 },
  'obese-iii': { label: 'Obesity (class III)', min: 40, max: Number.POSITIVE_INFINITY },
};

export function bmi(weightKg: number, heightCm: number): number | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm) || heightCm <= 0) return null;
  return weightKg / (heightCm / 100) ** 2;
}

export function bmiCategory(value: number): BmiCategory | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  for (const [key, bounds] of Object.entries(BMI_CATEGORIES)) {
    if (value < bounds.max) return key as BmiCategory;
  }
  return 'obese-iii';
}

/** Mifflin-St Jeor basal metabolic rate (kcal/day). */
export function basalMetabolicRate(profile: Profile, weightKg: number): number | null {
  const { age, sex } = profile;
  if (!Number.isFinite(age) || age === undefined) return null;
  if (sex !== 'male' && sex !== 'female') return null;
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;

  const base = 10 * weightKg + 6.25 * (profile.heightCm ?? 0) - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

/** Estimated total daily energy expenditure (kcal/day). */
export function totalDailyEnergyExpenditure(profile: Profile, weightKg: number): number | null {
  const bmr = basalMetabolicRate(profile, weightKg);
  if (bmr === null) return null;
  const multiplier = ACTIVITY_MULTIPLIERS[profile.activityLevel ?? 'moderate'];
  return bmr * multiplier;
}

/** Plausible weight range for a height, from the healthy BMI band. */
export function healthyWeightRange(heightCm: number): { min: number; max: number } | null {
  if (!Number.isFinite(heightCm) || heightCm <= 0) return null;
  const meters = heightCm / 100;
  return { min: 18.5 * meters ** 2, max: 24.9 * meters ** 2 };
}

/**
 * kcal/day that would move the weight by ~0.45 kg (1 lb) per week.
 * 1 kg of body mass is roughly 7700 kcal.
 */
export const KCAL_PER_KG = 7700;

export function dailyCalorieDeltaForWeightChange(kgPerWeek: number): number {
  return (kgPerWeek * KCAL_PER_KG) / 7;
}

/** Weekly weight change considered a safe pace, in kg. */
export const SAFE_PACE_KG_PER_WEEK = 0.45;

/**
 * Daily calorie target to reach `targetWeightKg`.
 *
 * The gap is spread over `SAFE_PACE_KG_PER_WEEK` rather than over the whole
 * distance, because "lose 5 kg" does not mean "do it in one week". The result is
 * clamped so it never drops below a conservative floor.
 */
export function calorieTargetForGoal(
  profile: Profile,
  weightKg: number,
  targetWeightKg: number,
): number | null {
  const tdee = totalDailyEnergyExpenditure(profile, weightKg);
  if (tdee === null) return null;
  if (!Number.isFinite(targetWeightKg)) return null;

  const gap = targetWeightKg - weightKg;
  if (Math.abs(gap) < 0.05) return tdee;

  // Negative gap (loss) reduces the target, positive gap (gain) raises it.
  const weeklyDelta = Math.sign(gap) * Math.min(Math.abs(gap), SAFE_PACE_KG_PER_WEEK);
  const adjustment = dailyCalorieDeltaForWeightChange(weeklyDelta);

  // Never advise below a conservative floor: ~1200 kcal for women, ~1500 for men.
  const floor = profile.sex === 'female' ? 1200 : 1500;
  return clamp(tdee + adjustment, floor, 10_000);
}

/** Rough "how many days of data" the app needs before insights become useful. */
export const MIN_DAYS_FOR_INSIGHTS = 3;
export const MIN_DAYS_FOR_TREND = 5;