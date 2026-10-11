import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_MULTIPLIERS,
  basalMetabolicRate,
  bmi,
  bmiCategory,
  BMI_CATEGORIES,
  calorieTargetForGoal,
  dailyCalorieDeltaForWeightChange,
  healthyWeightRange,
  KCAL_PER_KG,
  totalDailyEnergyExpenditure,
} from '../lib/health.ts';
import type { ActivityLevel, Profile, Sex } from '../types.ts';

function profile(overrides: Partial<Profile> = {}): Profile {
  return { sex: 'male', heightCm: 180, activityLevel: 'moderate', ...overrides };
}

describe('bmi', () => {
  it('computes weight / height^2', () => {
    expect(bmi(80, 180)).toBeCloseTo(24.69, 2);
  });

  it('returns null for a non-positive height', () => {
    expect(bmi(80, 0)).toBeNull();
    expect(bmi(80, -180)).toBeNull();
  });

  it('returns null for non-finite input', () => {
    expect(bmi(Number.NaN, 180)).toBeNull();
    expect(bmi(80, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('bmiCategory', () => {
  it.each([
    [16, 'underweight'],
    [22, 'healthy'],
    [27, 'overweight'],
    [32, 'obese-i'],
    [37, 'obese-ii'],
    [45, 'obese-iii'],
  ])('maps BMI %s to %s', (value, expected) => {
    expect(bmiCategory(value)).toBe(expected);
  });

  it('treats the lower bound of each band inclusively', () => {
    expect(bmiCategory(18.5)).toBe('healthy');
    expect(bmiCategory(25)).toBe('overweight');
    expect(bmiCategory(30)).toBe('obese-i');
    expect(bmiCategory(35)).toBe('obese-ii');
    expect(bmiCategory(40)).toBe('obese-iii');
  });

  it('returns null for invalid values', () => {
    expect(bmiCategory(0)).toBeNull();
    expect(bmiCategory(-5)).toBeNull();
    expect(bmiCategory(Number.NaN)).toBeNull();
  });

  it('covers every category with a label', () => {
    for (const key of Object.keys(BMI_CATEGORIES) as Array<keyof typeof BMI_CATEGORIES>) {
      expect(BMI_CATEGORIES[key].label).toBeTruthy();
    }
  });
});

describe('basalMetabolicRate', () => {
  it('matches the Mifflin-St Jeor formula for men', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 1780
    expect(basalMetabolicRate(profile(), 80, 30)).toBe(1780);
  });

  it('matches the Mifflin-St Jeor formula for women', () => {
    // 10*65 + 6.25*165 - 5*30 - 161 = 1370.25
    expect(basalMetabolicRate(profile({ sex: 'female', heightCm: 165 }), 65, 30)).toBeCloseTo(
      1370.25,
      5,
    );
  });

  it('is lower for women than men at the same inputs', () => {
    const male = basalMetabolicRate(profile({ sex: 'male' }), 70, 30)!;
    const female = basalMetabolicRate(profile({ sex: 'female' }), 70, 30)!;
    expect(female).toBeLessThan(male);
  });

  it('returns null without an age', () => {
    expect(basalMetabolicRate({ sex: 'male', heightCm: 180 }, 80, null)).toBeNull();
  });

  it('returns null without a valid sex', () => {
    expect(basalMetabolicRate({ heightCm: 180 }, 80, 30)).toBeNull();
  });

  it('returns null for a non-positive weight', () => {
    expect(basalMetabolicRate(profile(), 0, 30)).toBeNull();
  });

  it('rejects ages outside the supported adult range', () => {
    expect(basalMetabolicRate(profile(), 80, 12)).toBeNull();
    expect(basalMetabolicRate(profile(), 80, 121)).toBeNull();
    expect(basalMetabolicRate(profile(), 80, 13)).not.toBeNull();
    expect(basalMetabolicRate(profile(), 80, 120)).not.toBeNull();
  });
});

describe('totalDailyEnergyExpenditure', () => {
  it('multiplies BMR by the activity multiplier', () => {
    const bmr = basalMetabolicRate(profile(), 80, 30)!;
    expect(totalDailyEnergyExpenditure(profile(), 80, 30)).toBeCloseTo(bmr * 1.55, 5);
  });

  it('increases with activity level', () => {
    const sedentary = totalDailyEnergyExpenditure(profile({ activityLevel: 'sedentary' }), 80, 30)!;
    const active = totalDailyEnergyExpenditure(profile({ activityLevel: 'active' }), 80, 30)!;
    const athlete = totalDailyEnergyExpenditure(profile({ activityLevel: 'athlete' }), 80, 30)!;
    expect(sedentary).toBeLessThan(active);
    expect(active).toBeLessThan(athlete);
  });

  it('defaults to moderate when activity level is unset', () => {
    const noLevel = totalDailyEnergyExpenditure({ sex: 'male', heightCm: 180 }, 80, 30)!;
    const moderate = totalDailyEnergyExpenditure(
      { sex: 'male', heightCm: 180, activityLevel: 'moderate' },
      80,
      30,
    )!;
    expect(noLevel).toBe(moderate);
  });

  it('returns null when BMR cannot be computed', () => {
    expect(totalDailyEnergyExpenditure({}, 80, null)).toBeNull();
  });

  it('has a multiplier above 1 for every activity level', () => {
    for (const multiplier of Object.values(ACTIVITY_MULTIPLIERS)) {
      expect(multiplier).toBeGreaterThan(1);
    }
  });

  it('covers every activity level', () => {
    const expected: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'athlete'];
    expect(Object.keys(ACTIVITY_MULTIPLIERS).sort()).toEqual([...expected].sort());
  });
});

describe('healthyWeightRange', () => {
  it('derives the range from the healthy BMI band', () => {
    const range = healthyWeightRange(180)!;
    expect(range.min).toBeCloseTo(18.5 * 1.8 ** 2, 5);
    expect(range.max).toBeCloseTo(24.9 * 1.8 ** 2, 5);
  });

  it('returns null for an invalid height', () => {
    expect(healthyWeightRange(0)).toBeNull();
    expect(healthyWeightRange(-180)).toBeNull();
  });
});

describe('dailyCalorieDeltaForWeightChange', () => {
  it('uses 7700 kcal per kg spread over 7 days', () => {
    expect(dailyCalorieDeltaForWeightChange(0.45)).toBeCloseTo((0.45 * KCAL_PER_KG) / 7, 5);
  });

  it('is positive for weight gain and negative for loss', () => {
    expect(dailyCalorieDeltaForWeightChange(0.5)).toBeGreaterThan(0);
    expect(dailyCalorieDeltaForWeightChange(-0.5)).toBeLessThan(0);
  });

  it('is 0 for no change', () => {
    expect(dailyCalorieDeltaForWeightChange(0)).toBe(0);
  });
});

describe('calorieTargetForGoal', () => {
  it('returns maintenance calories when already at target', () => {
    const target = calorieTargetForGoal(profile(), 80, 30, 80)!;
    expect(target).toBeCloseTo(totalDailyEnergyExpenditure(profile(), 80, 30)!, 5);
  });

  it('subtracts calories to lose weight', () => {
    const tdee = totalDailyEnergyExpenditure(profile(), 80, 30)!;
    const target = calorieTargetForGoal(profile(), 80, 30, 75)!;
    expect(target).toBeLessThan(tdee);
  });

  it('adds calories to gain weight', () => {
    const tdee = totalDailyEnergyExpenditure(profile(), 80, 30)!;
    const target = calorieTargetForGoal(profile(), 80, 30, 85)!;
    expect(target).toBeGreaterThan(tdee);
  });

  it('spreads a large gap over a safe weekly pace', () => {
    const tdee = totalDailyEnergyExpenditure(profile(), 80, 30)!;
    // 0.45 kg/week -> 0.45 * 7700 / 7 = 495 kcal/day below maintenance.
    const expected = tdee - dailyCalorieDeltaForWeightChange(0.45);
    expect(calorieTargetForGoal(profile(), 80, 30, 70)).toBeCloseTo(expected, 5);
    expect(calorieTargetForGoal(profile(), 80, 30, 79)).toBeCloseTo(expected, 5);
  });

  it('scales the gap for a close target', () => {
    const tdee = totalDailyEnergyExpenditure(profile(), 80, 30)!;
    // A 0.2 kg gap is under the 0.45 kg cap, so it is applied proportionally.
    const target = calorieTargetForGoal(profile(), 80, 30, 79.8)!;
    expect(target).toBeCloseTo(tdee - dailyCalorieDeltaForWeightChange(0.2), 5);
  });

  it('never drops below the conservative floor', () => {
    const target = calorieTargetForGoal(profile({ activityLevel: 'sedentary' }), 45, 30, 25)!;
    expect(target).toBeGreaterThanOrEqual(1500);
  });

  it('applies the lower floor for women', () => {
    const target = calorieTargetForGoal(profile({ sex: 'female', heightCm: 160 }), 45, 30, 30)!;
    expect(target).toBeGreaterThanOrEqual(1200);
  });

  it('returns null when the burn cannot be estimated', () => {
    expect(calorieTargetForGoal({}, 80, null, 75)).toBeNull();
  });

  it('returns null for a non-finite target', () => {
    expect(calorieTargetForGoal(profile(), 80, 30, Number.NaN)).toBeNull();
  });

  it('treats a tiny gap as "already there"', () => {
    const tdee = totalDailyEnergyExpenditure(profile(), 80, 30)!;
    expect(calorieTargetForGoal(profile(), 80, 30, 80.02)).toBeCloseTo(tdee, 5);
  });
});

describe('sex type usage', () => {
  it('only accepts male or female', () => {
    const sexes: Sex[] = ['male', 'female'];
    for (const sex of sexes) {
      expect(basalMetabolicRate(profile({ sex }), 80, 30)).not.toBeNull();
    }
  });
});