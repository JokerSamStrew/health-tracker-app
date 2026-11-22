import { describe, expect, it } from 'vitest';
import { addDays } from '../lib/date.ts';
import { buildGoalPlan, type GoalPlan, type GoalPlanMetric } from '../lib/goalplan.ts';
import { summarizeAll } from '../lib/series.ts';
import type { MetricKey } from '../types.ts';

const REFERENCE = '2024-03-14';
const WINDOW_START = addDays(REFERENCE, -13);
const GOAL_DATE = addDays(REFERENCE, 56); // 2024-05-09, exactly eight weeks out.

/** Fourteen days with a clear latest value and trend for four metrics. */
function makeSummaries() {
  const entries = Array.from({ length: 14 }, (_, i) => ({
    date: addDays(WINDOW_START, i),
    weightKg: 80 - 0.1 * i, // latest 78.7, trend -0.7 kg/week
    steps: 4700 + 100 * i, // latest 6000, trend +700 steps/week
    sleepQuality: 3, // flat, trend 0
    calories: 2630 - 10 * i, // latest 2500, trend -70 kcal/week
  }));
  return summarizeAll(entries, WINDOW_START);
}

function metric(plan: GoalPlan, key: MetricKey): GoalPlanMetric {
  const found = plan.metrics.find((item) => item.key === key);
  expect(found).toBeDefined();
  return found!;
}

describe('buildGoalPlan', () => {
  it('turns the deadline into a weekly pace for every set goal with a baseline', () => {
    const plan = buildGoalPlan(
      {
        goalDate: GOAL_DATE,
        targetWeightKg: 76,
        dailyStepGoal: 8000,
        sleepGoalQuality: 4,
        dailyCalorieGoal: 2000,
      },
      makeSummaries(),
      REFERENCE,
    );

    expect(plan).not.toBeNull();
    expect(plan!.date).toBe(GOAL_DATE);
    expect(plan!.daysLeft).toBe(56);
    // No activity goal was set, so that metric is absent from the plan.
    expect(plan!.metrics.map((item) => item.key)).toEqual([
      'weight',
      'steps',
      'sleep',
      'calories',
    ]);
  });

  it('computes signed weekly change from the latest value to the goal', () => {
    const plan = buildGoalPlan(
      {
        goalDate: GOAL_DATE,
        targetWeightKg: 76,
        dailyStepGoal: 8000,
        sleepGoalQuality: 4,
        dailyCalorieGoal: 2000,
      },
      makeSummaries(),
      REFERENCE,
    )!;

    const weight = metric(plan, 'weight');
    expect(weight.latest).toBeCloseTo(78.7, 10);
    expect(weight.gap).toBeCloseTo(-2.7, 10);
    // -2.7 kg over 56 days is -2.7 / 56 * 7 = -0.3375 kg/week.
    expect(weight.requiredPerWeek).toBeCloseTo(-0.3375, 10);

    expect(metric(plan, 'steps').requiredPerWeek).toBeCloseTo(250, 10);
    expect(metric(plan, 'sleep').requiredPerWeek).toBeCloseTo(0.125, 10);
    expect(metric(plan, 'calories').requiredPerWeek).toBeCloseTo(-62.5, 10);
  });

  it('compares the required pace with the observed trend', () => {
    const plan = buildGoalPlan(
      {
        goalDate: GOAL_DATE,
        targetWeightKg: 76,
        dailyStepGoal: 8000,
        sleepGoalQuality: 4,
        dailyCalorieGoal: 2000,
      },
      makeSummaries(),
      REFERENCE,
    )!;

    // Weight, steps and calories already move fast enough in the right direction.
    expect(metric(plan, 'weight').onTrack).toBe(true);
    expect(metric(plan, 'steps').onTrack).toBe(true);
    expect(metric(plan, 'calories').onTrack).toBe(true);
    // Sleep is flat but needs +0.125/week, so it is behind pace.
    expect(metric(plan, 'sleep').onTrack).toBe(false);
  });

  it('leaves comparison undecided when the trend cannot be computed', () => {
    const summaries = summarizeAll([{ date: REFERENCE, weightKg: 80 }], WINDOW_START);
    const plan = buildGoalPlan(
      { goalDate: GOAL_DATE, targetWeightKg: 75 },
      summaries,
      REFERENCE,
    )!;

    const weight = metric(plan, 'weight');
    expect(weight.observedPerWeek).toBeNull();
    expect(weight.onTrack).toBeNull();
    expect(weight.requiredPerWeek).toBeCloseTo(-0.625, 10);
  });

  it('flags a weight pace faster than the safe weekly pace', () => {
    // 3.7 kg in four weeks asks for -0.925 kg/week, above the 0.45 guide.
    const plan = buildGoalPlan(
      { goalDate: addDays(REFERENCE, 28), targetWeightKg: 75 },
      makeSummaries(),
      REFERENCE,
    )!;
    expect(metric(plan, 'weight').exceedsSafePace).toBe(true);

    const gentle = buildGoalPlan(
      { goalDate: GOAL_DATE, targetWeightKg: 76 },
      makeSummaries(),
      REFERENCE,
    )!;
    expect(metric(gentle, 'weight').exceedsSafePace).toBe(false);
  });

  it('keeps the date when no goal or baseline exists yet', () => {
    const empty = buildGoalPlan(
      { goalDate: GOAL_DATE, dailyStepGoal: 8000 },
      summarizeAll([], WINDOW_START),
      REFERENCE,
    )!;
    expect(empty.daysLeft).toBe(56);
    expect(empty.metrics).toEqual([]);
  });

  it('returns null without a usable future date', () => {
    const summaries = makeSummaries();
    expect(buildGoalPlan({}, summaries, REFERENCE)).toBeNull();
    expect(buildGoalPlan({ goalDate: 'not-a-date' }, summaries, REFERENCE)).toBeNull();
    expect(buildGoalPlan({ goalDate: REFERENCE }, summaries, REFERENCE)).toBeNull();
    expect(buildGoalPlan({ goalDate: '2024-03-13' }, summaries, REFERENCE)).toBeNull();
  });
});
