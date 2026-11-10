import { describe, expect, it } from 'vitest';
import { addDays } from '../lib/date.ts';
import { goalHealthScore } from '../lib/goalscore.ts';
import { analyzeHealth } from '../lib/insights.ts';
import type { MetricKey, MetricSummary, Profile } from '../types.ts';

const REFERENCE = '2024-03-14';

/**
 * Summaries straight from the real analysis pipeline; the goal score only
 * consumes the latest weight, which stands in for the current weight when no
 * target is set.
 */
function summariesWithWeight(weightKg: number | null): Record<MetricKey, MetricSummary> {
  const entries =
    weightKg === null
      ? []
      : Array.from({ length: 14 }, (_, i) => ({ date: addDays(REFERENCE, i - 13), weightKg }));
  return analyzeHealth(entries, {}, { referenceDate: REFERENCE }).summaries;
}

/** Male, 30 at the reference date, 180 cm, moderate activity; default goals. */
const BASE_PROFILE: Profile = {
  birthDate: '1994-03-14',
  sex: 'male',
  heightCm: 180,
  activityLevel: 'moderate',
  dailyStepGoal: 8000,
  sleepGoalQuality: 4,
  activityGoalRating: 3,
};

describe('goalHealthScore', () => {
  it('scores 100 when every goal is mutually consistent', () => {
    // A 75 kg target is a healthy BMI at 180 cm (23.1), and the simulated
    // intake is the estimated maintenance at that weight, so every rule that
    // fires lands on a positive branch and positives cost nothing.
    const goal = goalHealthScore(
      { ...BASE_PROFILE, targetWeightKg: 75 },
      summariesWithWeight(80),
      { referenceDate: REFERENCE },
    );
    expect(goal.score).toBe(100);
    expect(goal.limiting).toHaveLength(0);
  });

  it('assumes maintenance calories at the target weight when no goal is set', () => {
    const goal = goalHealthScore(
      { ...BASE_PROFILE, targetWeightKg: 75 },
      summariesWithWeight(80),
      { referenceDate: REFERENCE },
    );
    expect(goal.targets.weightKg).toBe(75);
    // BMR at 75 kg / 180 cm / 30 y is 1730 kcal; x1.55 for moderate activity.
    expect(goal.targets.calories).toBeCloseTo(2681.5, 1);
  });

  it('caps below 100 when the target weight is outside the healthy BMI band', () => {
    // 50 kg at 180 cm is a BMI of 15.4 - underweight, a warning (9 points).
    const goal = goalHealthScore(
      { ...BASE_PROFILE, targetWeightKg: 50 },
      summariesWithWeight(80),
      { referenceDate: REFERENCE },
    );
    expect(goal.score).toBe(91);
    expect(goal.limiting.map((insight) => insight.id)).toEqual(['body.bmi']);
    expect(goal.limiting[0].severity).toBe('warning');
  });

  it('caps below 100 when the calorie goal contradicts the estimated burn', () => {
    // ruleCalorieBalance honours the explicit 1500 kcal goal, but the intake
    // versus weight-change check compares against the estimated maintenance
    // at 75 kg (2681.5 kcal), and a 44% gap is well past the 25% tolerance.
    const goal = goalHealthScore(
      { ...BASE_PROFILE, targetWeightKg: 75, dailyCalorieGoal: 1500 },
      summariesWithWeight(80),
      { referenceDate: REFERENCE },
    );
    expect(goal.score).toBe(91);
    expect(goal.limiting.map((insight) => insight.id)).toEqual(['calories.weight-alignment']);
  });

  it('holds the latest weight steady when no target weight is set', () => {
    // Without a target, weight "on goal" is the current weight kept stable;
    // 130 kg at 180 cm is a BMI of 40.2 (obese-iii), a critical insight.
    const goal = goalHealthScore(BASE_PROFILE, summariesWithWeight(130), {
      referenceDate: REFERENCE,
    });
    expect(goal.targets.weightKg).toBe(130);
    expect(goal.score).toBe(82);
    expect(goal.limiting.map((insight) => insight.id)).toEqual(['body.bmi']);
    expect(goal.limiting[0].severity).toBe('critical');
  });

  it('returns a null score when the window is too short to score', () => {
    const goal = goalHealthScore(BASE_PROFILE, summariesWithWeight(80), {
      referenceDate: REFERENCE,
      windowDays: 2,
    });
    expect(goal.score).toBeNull();
    expect(goal.limiting).toHaveLength(0);
  });

  it('reflects custom goals in the simulated targets', () => {
    const goal = goalHealthScore(
      {
        ...BASE_PROFILE,
        targetWeightKg: 70,
        dailyCalorieGoal: 2500,
        dailyStepGoal: 12000,
        sleepGoalQuality: 4.5,
        activityGoalRating: 2.5,
      },
      summariesWithWeight(80),
      { referenceDate: REFERENCE },
    );
    expect(goal.targets).toEqual({
      weightKg: 70,
      steps: 12000,
      sleepQuality: 4.5,
      activityRating: 2.5,
      calories: 2500,
    });
  });

  it('leaves metrics with no derivable goal out of the simulation', () => {
    // No target weight, no logged weight and no calorie data: only the default
    // step/sleep/activity goals apply, and the missing metrics surface as an
    // info note, which costs nothing.
    const goal = goalHealthScore({}, summariesWithWeight(null), {
      referenceDate: REFERENCE,
    });
    expect(goal.targets.weightKg).toBeNull();
    expect(goal.targets.calories).toBeNull();
    expect(goal.targets.steps).toBe(8000);
    expect(goal.targets.sleepQuality).toBe(4);
    expect(goal.targets.activityRating).toBe(3);
    expect(goal.score).toBe(100);
    expect(goal.limiting).toHaveLength(0);
  });
});
