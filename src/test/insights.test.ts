import { describe, expect, it } from 'vitest';
import {
  analyzeHealth,
  correlationBetween,
  daysWithData,
  latestWeight,
  THRESHOLDS,
} from '../lib/insights.ts';
import { addDays } from '../lib/date.ts';
import type { DailyEntry, Insight, Profile } from '../types.ts';

const REFERENCE = '2024-03-14';

/** Builds `days` entries ending on `endDate`, applying `fill` per day offset. */
function makeSeries(
  days: number,
  fill: (index: number) => Partial<DailyEntry>,
  endDate = REFERENCE,
): DailyEntry[] {
  const entries: DailyEntry[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    entries.push({ date: addDays(endDate, -i), ...fill(days - 1 - i) });
  }
  return entries;
}

/** Finds an insight by id, asserting it exists. */
function insightById(insights: Insight[], id: string): Insight {
  const found = insights.find((insight) => insight.id === id);
  if (!found) {
    throw new Error(`Expected insight "${id}", got: ${insights.map((i) => i.id).join(', ')}`);
  }
  return found;
}

const BASE_PROFILE: Profile = {
  birthDate: '1994-03-14',
  sex: 'male',
  heightCm: 180,
  activityLevel: 'moderate',
  dailyStepGoal: 8000,
  sleepGoalQuality: 4,
};

describe('analyzeHealth - empty and minimal input', () => {
  it('returns a usable report with no data', () => {
    const report = analyzeHealth([], {}, { referenceDate: REFERENCE });
    expect(report.referenceDate).toBe(REFERENCE);
    expect(report.insights.length).toBeGreaterThan(0);
    expect(report.score).toBeNull();
  });

  it('flags insufficient data below the minimum', () => {
    const report = analyzeHealth(
      [{ date: REFERENCE, steps: 5000 }],
      {},
      { referenceDate: REFERENCE },
    );
    expect(insightById(report.insights, 'data.insufficient').severity).toBe('info');
    expect(report.score).toBeNull();
  });

  it('does not fire insufficient-data once the minimum is met', () => {
    const entries = makeSeries(4, () => ({ steps: 9000 }));
    const report = analyzeHealth(entries, {}, { referenceDate: REFERENCE });
    expect(report.insights.some((i) => i.id === 'data.insufficient')).toBe(false);
  });

  it('lists metrics with no data', () => {
    const report = analyzeHealth(
      makeSeries(7, () => ({ steps: 9000 })),
      {},
      { referenceDate: REFERENCE },
    );
    const insight = insightById(report.insights, 'data.missing-metrics');
    expect(insight.summary).toContain('weight');
    expect(insight.summary).toContain('sleep');
    expect(insight.summary).toContain('calories');
    expect(insight.summary).not.toContain('steps');
  });

  it('warns when logging coverage is thin', () => {
    // 5 days of data in a 30-day window is 17% coverage.
    const entries = makeSeries(5, () => ({ steps: 9000 }));
    const report = analyzeHealth(entries, {}, { referenceDate: REFERENCE, windowDays: 30 });
    const insight = insightById(report.insights, 'data.coverage');
    expect(insight.evidence[0]).toBe('5 of 30 days logged');
  });

  it('does not warn about coverage when logging is dense', () => {
    const entries = makeSeries(14, () => ({ steps: 9000 }));
    const report = analyzeHealth(entries, {}, { referenceDate: REFERENCE, windowDays: 14 });
    expect(report.insights.some((i) => i.id === 'data.coverage')).toBe(false);
  });

  it('ignores entries outside the window', () => {
    const entries: DailyEntry[] = [
      ...makeSeries(5, () => ({ steps: 9000 })),
      { date: '2023-01-01', steps: 1, weightKg: 200 },
    ];
    const report = analyzeHealth(entries, {}, { referenceDate: REFERENCE, windowDays: 14 });
    expect(report.summaries.weight.count).toBe(0);
  });

  it('sorts insights by severity', () => {
    const entries = makeSeries(14, (i) => ({
      weightKg: 80 + i * 0.2,
      steps: 3000,
      sleepQuality: 2,
      calories: 3000,
    }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    const rank = { critical: 0, warning: 1, info: 2, positive: 3 };
    const severities = report.insights.map((i) => rank[i.severity]);
    expect([...severities].sort((a, b) => a - b)).toEqual(severities);
  });

  it('produces unique insight ids', () => {
    const entries = makeSeries(14, (i) => ({
      weightKg: 80 + i * 0.2,
      steps: 9000,
      sleepQuality: 4.5,
      calories: 2400,
    }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    const ids = report.insights.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every insight evidence and at least one recommendation', () => {
    const entries = makeSeries(14, (i) => ({
      weightKg: 80 + i * 0.2,
      steps: 3000,
      sleepQuality: 2,
      calories: 3000,
    }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    for (const insight of report.insights) {
      expect(insight.title.length).toBeGreaterThan(0);
      expect(insight.summary.length).toBeGreaterThan(0);
      expect(insight.evidence.length).toBeGreaterThan(0);
      expect(insight.recommendations.length).toBeGreaterThan(0);
    }
  });
});

describe('analyzeHealth - window handling', () => {
  it('defaults to a 14-day window ending on the reference date', () => {
    const report = analyzeHealth([], {}, { referenceDate: REFERENCE });
    expect(report.windowDays).toBe(14);
    expect(report.windowEnd).toBe(REFERENCE);
    expect(report.windowStart).toBe('2024-03-01');
  });

  it('honours a custom window length', () => {
    const report = analyzeHealth([], {}, { referenceDate: REFERENCE, windowDays: 7 });
    expect(report.windowStart).toBe('2024-03-08');
  });

  it('clamps a zero or negative window to one day', () => {
    const report = analyzeHealth([], {}, { referenceDate: REFERENCE, windowDays: 0 });
    expect(report.windowDays).toBe(1);
    expect(report.windowStart).toBe(REFERENCE);
  });
});

describe('score', () => {
  it('is 100 when everything is on target', () => {
    const entries = makeSeries(14, () => ({
      weightKg: 80,
      steps: 10000,
      sleepQuality: 4,
      calories: 2650,
    }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(report.counts.critical).toBe(0);
    expect(report.counts.warning).toBe(0);
    expect(report.score).toBe(100);
  });

  it('drops with warnings and is never below 0', () => {
    const entries = makeSeries(14, () => ({
      weightKg: 95,
      steps: 2000,
      sleepQuality: 2,
      calories: 500,
    }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(report.score).not.toBeNull();
    expect(report.score!).toBeGreaterThanOrEqual(0);
    expect(report.score!).toBeLessThan(100);
  });

  it('counts insights per severity', () => {
    const entries = makeSeries(14, () => ({
      weightKg: 80,
      steps: 10000,
      sleepQuality: 4,
      calories: 2650,
    }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    const total = Object.values(report.counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(report.insights.length);
  });
});

describe('weight trend rule', () => {
  it('reports a stable weight as positive', () => {
    const entries = makeSeries(14, () => ({ weightKg: 80 }));
    const report = analyzeHealth(entries, {}, { referenceDate: REFERENCE });
    const insight = insightById(report.insights, 'weight.trend');
    expect(insight.severity).toBe('positive');
  });

  it('flags a steady gain', () => {
    const entries = makeSeries(14, (i) => ({ weightKg: 78 + i * 0.1 }));
    const report = analyzeHealth(entries, {}, { referenceDate: REFERENCE });
    const insight = insightById(report.insights, 'weight.trend');
    expect(insight.title).toBe('Weight is trending up');
    expect(insight.severity).not.toBe('positive');
  });

  it('escalates a fast gain to a warning', () => {
    // +0.35 kg/day = +2.45 kg/week, well past the 0.3 threshold.
    const entries = makeSeries(14, (i) => ({ weightKg: 76 + i * 0.35 }));
    const report = analyzeHealth(entries, {}, { referenceDate: REFERENCE });
    expect(insightById(report.insights, 'weight.trend').severity).toBe('warning');
  });

  it('reports a healthy loss as info', () => {
    const entries = makeSeries(14, (i) => ({ weightKg: 82 - i * 0.1 }));
    const report = analyzeHealth(entries, {}, { referenceDate: REFERENCE });
    const insight = insightById(report.insights, 'weight.trend');
    expect(insight.title).toBe('Weight is trending down');
    expect(insight.severity).toBe('info');
  });

  it('flags rapid loss as critical', () => {
    // -1.0 kg/day = -7 kg/week, which is >1% of an 80 kg body per week.
    const entries = makeSeries(10, (i) => ({ weightKg: 90 - i * 1.0 }));
    const report = analyzeHealth(entries, {}, { referenceDate: REFERENCE });
    const insight = insightById(report.insights, 'weight.trend');
    expect(insight.severity).toBe('critical');
    expect(insight.title).toBe('Weight is dropping too fast');
  });

  it('does not fire below the trend data threshold', () => {
    const entries = makeSeries(3, (i) => ({ weightKg: 80 + i * 0.5 }));
    const report = analyzeHealth(entries, {}, { referenceDate: REFERENCE });
    expect(report.insights.some((i) => i.id === 'weight.trend')).toBe(false);
  });
});

describe('weight goal rule', () => {
  it('confirms reaching the target', () => {
    const entries = makeSeries(14, () => ({ weightKg: 75 }));
    const report = analyzeHealth(
      entries,
      { ...BASE_PROFILE, targetWeightKg: 75.2 },
      { referenceDate: REFERENCE },
    );
    const insight = insightById(report.insights, 'weight.goal');
    expect(insight.severity).toBe('positive');
    expect(insight.title).toBe('Target weight reached');
  });

  it('reports the remaining gap and a suggested pace', () => {
    // 85 - 80 = 5 kg still to gain.
    const entries = makeSeries(14, () => ({ weightKg: 80 }));
    const report = analyzeHealth(
      entries,
      { ...BASE_PROFILE, targetWeightKg: 85 },
      { referenceDate: REFERENCE },
    );
    const insight = insightById(report.insights, 'weight.goal');
    expect(insight.title).toBe('5 kg to goal');
    expect(insight.recommendations.some((r) => r.detail.includes('weeks'))).toBe(true);
  });

  it('suggests adding calories when above target', () => {
    const entries = makeSeries(14, () => ({ weightKg: 70 }));
    const report = analyzeHealth(
      entries,
      { ...BASE_PROFILE, targetWeightKg: 80 },
      { referenceDate: REFERENCE },
    );
    expect(insightById(report.insights, 'weight.goal').title).toBe('10 kg to goal');
  });

  it('reports being over the target', () => {
    const entries = makeSeries(14, () => ({ weightKg: 85 }));
    const report = analyzeHealth(
      entries,
      { ...BASE_PROFILE, targetWeightKg: 80 },
      { referenceDate: REFERENCE },
    );
    expect(insightById(report.insights, 'weight.goal').title).toBe('5 kg above goal');
  });

  it('does not fire without a target', () => {
    const entries = makeSeries(14, () => ({ weightKg: 85 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(report.insights.some((i) => i.id === 'weight.goal')).toBe(false);
  });
});

describe('weight forecast rule', () => {
  it('projects the days and the arrival date from the current trend', () => {
    // -0.1 kg/day = -0.7 kg/week; the latest weigh-in is 78.7 kg, so the 75 kg
    // target is 3.7 kg away: 3.7 / 0.7 * 7 = 37 days from Mar 14.
    const entries = makeSeries(14, (i) => ({ weightKg: 80 - i * 0.1 }));
    const report = analyzeHealth(
      entries,
      { ...BASE_PROFILE, targetWeightKg: 75 },
      { referenceDate: REFERENCE },
    );
    const insight = insightById(report.insights, 'weight.forecast');
    expect(insight.severity).toBe('info');
    expect(insight.title).toBe('Target in 37 days');
    expect(insight.summary).toContain('Apr 20, 2024');
    expect(insight.evidence.some((item) => item.includes('37 days'))).toBe(true);
  });

  it('compares the projection with the safe pace', () => {
    // The same 3.7 kg gap at the 0.45 kg/week safe pace is about 58 days.
    const entries = makeSeries(14, (i) => ({ weightKg: 80 - i * 0.1 }));
    const report = analyzeHealth(
      entries,
      { ...BASE_PROFILE, targetWeightKg: 75 },
      { referenceDate: REFERENCE },
    );
    const insight = insightById(report.insights, 'weight.forecast');
    expect(insight.recommendations.some((r) => r.detail.includes('58 days'))).toBe(true);
  });

  it('does not fire without a target weight', () => {
    const entries = makeSeries(14, (i) => ({ weightKg: 80 - i * 0.1 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(report.insights.some((i) => i.id === 'weight.forecast')).toBe(false);
  });

  it('stays silent when the target is already reached', () => {
    // 78.4 kg is 0.3 kg below the latest weigh-in, inside the 0.5 kg
    // tolerance, so the goal rule reports success instead.
    const entries = makeSeries(14, (i) => ({ weightKg: 80 - i * 0.1 }));
    const report = analyzeHealth(
      entries,
      { ...BASE_PROFILE, targetWeightKg: 78.4 },
      { referenceDate: REFERENCE },
    );
    expect(report.insights.some((i) => i.id === 'weight.forecast')).toBe(false);
    expect(insightById(report.insights, 'weight.goal').severity).toBe('positive');
  });

  it('does not fire when the trend moves away from the target', () => {
    // Losing weight while the target sits above: no arrival date exists.
    const entries = makeSeries(14, (i) => ({ weightKg: 80 - i * 0.1 }));
    const report = analyzeHealth(
      entries,
      { ...BASE_PROFILE, targetWeightKg: 85 },
      { referenceDate: REFERENCE },
    );
    expect(report.insights.some((i) => i.id === 'weight.forecast')).toBe(false);
  });

  it('does not fire when the trend is flat', () => {
    const entries = makeSeries(14, () => ({ weightKg: 80 }));
    const report = analyzeHealth(
      entries,
      { ...BASE_PROFILE, targetWeightKg: 75 },
      { referenceDate: REFERENCE },
    );
    expect(report.insights.some((i) => i.id === 'weight.forecast')).toBe(false);
  });

  it('does not fire below the trend data threshold', () => {
    const entries = makeSeries(3, (i) => ({ weightKg: 80 - i * 0.2 }));
    const report = analyzeHealth(
      entries,
      { ...BASE_PROFILE, targetWeightKg: 75 },
      { referenceDate: REFERENCE },
    );
    expect(report.insights.some((i) => i.id === 'weight.forecast')).toBe(false);
  });
});

describe('sleep rules', () => {
  it('is positive when the goal is met', () => {
    const entries = makeSeries(14, () => ({ sleepQuality: 4 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(insightById(report.insights, 'sleep.average').severity).toBe('positive');
  });

  it('warns for quality with a moderate deficit', () => {
    // The goal is 4/5, so an average of 3.4 sits 0.6 below the target.
    const entries = makeSeries(14, () => ({ sleepQuality: 3.4 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    const insight = insightById(report.insights, 'sleep.average');
    expect(insight.severity).toBe('warning');
    expect(insight.title).toBe('Sleep quality below target');
  });

  it('is critical at or below the very-poor threshold', () => {
    const entries = makeSeries(14, () => ({ sleepQuality: 2 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(insightById(report.insights, 'sleep.average').severity).toBe('critical');
  });

  it('respects a custom sleep goal', () => {
    // An average of 3.5 meets a personal goal of 3.5 exactly.
    const entries = makeSeries(14, () => ({ sleepQuality: 3.5 }));
    const report = analyzeHealth(
      entries,
      { ...BASE_PROFILE, sleepGoalQuality: 3.5 },
      { referenceDate: REFERENCE },
    );
    expect(insightById(report.insights, 'sleep.average').severity).toBe('positive');
  });

  it('warns about irregular sleep', () => {
    // Alternating 3 and 5: mean 4, standard deviation 1 -> 25% CV, above 20%.
    const entries = makeSeries(14, (i) => ({ sleepQuality: i % 2 === 0 ? 3 : 5 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(insightById(report.insights, 'sleep.regularity').title).toBe('Irregular sleep pattern');
  });

  it('is positive about consistent sleep', () => {
    const entries = makeSeries(14, () => ({ sleepQuality: 4 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(insightById(report.insights, 'sleep.regularity').severity).toBe('positive');
  });

  it('connects poor sleep with a rising weight', () => {
    // Average quality 2.5 sits below the poor-quality threshold of 3.
    const entries = makeSeries(14, (i) => ({
      weightKg: 78 + i * 0.15,
      sleepQuality: 2.5,
    }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(insightById(report.insights, 'sleep.weight-interaction')).toBeDefined();
  });

  it('does not connect sleep and weight when sleep is fine', () => {
    const entries = makeSeries(14, (i) => ({
      weightKg: 78 + i * 0.15,
      sleepQuality: 4,
    }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(report.insights.some((i) => i.id === 'sleep.weight-interaction')).toBe(false);
  });
});

describe('activity rules', () => {
  it('is positive when the goal is met', () => {
    // The default goal is 3/5, so an average of 3 lands exactly on target.
    const entries = makeSeries(14, () => ({ activityRating: 3 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    const insight = insightById(report.insights, 'activity.average');
    expect(insight.severity).toBe('positive');
    expect(insight.title).toBe('Physical activity is on target');
  });

  it('warns when the average is very low', () => {
    // 2/5 is exactly the very-low threshold.
    const entries = makeSeries(14, () => ({ activityRating: 2 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    const insight = insightById(report.insights, 'activity.average');
    expect(insight.severity).toBe('warning');
    expect(insight.title).toBe('Physical activity is very low');
  });

  it('notes a moderate shortfall against the goal', () => {
    // 2.4/5 sits 0.6 below the goal of 3, just past the 0.5 tolerance.
    const entries = makeSeries(14, () => ({ activityRating: 2.4 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    const insight = insightById(report.insights, 'activity.average');
    expect(insight.severity).toBe('info');
    expect(insight.title).toBe('Activity below target');
  });

  it('respects a custom activity goal', () => {
    // An average of 2.5 meets a personal goal of 2.5 exactly.
    const entries = makeSeries(14, () => ({ activityRating: 2.5 }));
    const report = analyzeHealth(
      entries,
      { ...BASE_PROFILE, activityGoalRating: 2.5 },
      { referenceDate: REFERENCE },
    );
    expect(insightById(report.insights, 'activity.average').severity).toBe('positive');
  });

  it('does not fire without enough days', () => {
    const entries = makeSeries(2, () => ({ activityRating: 3 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(report.insights.some((i) => i.id === 'activity.average')).toBe(false);
  });

  it('is positive about a steady activity rating', () => {
    const entries = makeSeries(14, () => ({ activityRating: 3 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(insightById(report.insights, 'activity.regularity').severity).toBe('positive');
  });

  it('notes a bursty activity rating', () => {
    // Alternating 2 and 5: mean 3.5, standard deviation 1.5 -> ~43% CV.
    const entries = makeSeries(14, (i) => ({ activityRating: i % 2 === 0 ? 2 : 5 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    const insight = insightById(report.insights, 'activity.regularity');
    expect(insight.severity).toBe('info');
    expect(insight.title).toBe('Activity comes in bursts');
  });

  it('notices a high rating with very few steps', () => {
    // 2000 steps is 25% of the 8000 step goal, below the 50% very-low ratio.
    const entries = makeSeries(14, () => ({ activityRating: 5, steps: 2000 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    const insight = insightById(report.insights, 'activity.steps-alignment');
    expect(insight.severity).toBe('info');
    expect(insight.title).toBe('Your step count understates your training');
  });

  it('notices a low rating when the step goal is met', () => {
    // 9000 steps clears the goal; a 2.5 rating is below the goal of 3 but
    // above the very-low threshold, so the average rule does not cover it.
    const entries = makeSeries(14, () => ({ activityRating: 2.5, steps: 9000 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    const insight = insightById(report.insights, 'activity.steps-alignment');
    expect(insight.severity).toBe('info');
    expect(insight.title).toBe('Your activity rating looks low');
  });

  it('leaves a very low rating to the average rule', () => {
    const entries = makeSeries(14, () => ({ activityRating: 1.5, steps: 9000 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(report.insights.some((i) => i.id === 'activity.steps-alignment')).toBe(false);
    expect(insightById(report.insights, 'activity.average').title).toBe(
      'Physical activity is very low',
    );
  });

  it('does not compare rating and steps without a step series', () => {
    const entries = makeSeries(14, () => ({ activityRating: 5 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(report.insights.some((i) => i.id === 'activity.steps-alignment')).toBe(false);
  });
});

describe('step rules', () => {
  it('is positive when the goal is met', () => {
    const entries = makeSeries(14, () => ({ steps: 11000 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(insightById(report.insights, 'steps.average').severity).toBe('positive');
  });

  it('warns when sedentary', () => {
    const entries = makeSeries(14, () => ({ steps: 2000 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(insightById(report.insights, 'steps.average').severity).toBe('warning');
  });

  it('notes being slightly below goal', () => {
    // 6000 / 8000 = 75%, between the 50% "very low" and 80% "low" thresholds.
    const entries = makeSeries(14, () => ({ steps: 6000 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(insightById(report.insights, 'steps.average').title).toBe('Below your step goal');
  });

  it('is positive when within 20% of the goal', () => {
    // 6800 / 8000 = 85%, which is at or above `stepsLowRatio`.
    const entries = makeSeries(14, () => ({ steps: 6800 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(insightById(report.insights, 'steps.average').severity).toBe('positive');
  });

  it('warns about declining activity', () => {
    const entries = makeSeries(14, (i) => ({ steps: 12000 - i * 300 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(insightById(report.insights, 'steps.trend').title).toBe('Activity is declining');
  });

  it('is positive about improving activity', () => {
    const entries = makeSeries(14, (i) => ({ steps: 4000 + i * 300 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(insightById(report.insights, 'steps.trend').severity).toBe('positive');
  });

  it('respects a custom step goal', () => {
    // 9000 / 12000 = 75%, which is below `stepsLowRatio` but above `stepsVeryLowRatio`.
    const entries = makeSeries(14, () => ({ steps: 9000 }));
    const report = analyzeHealth(
      entries,
      { ...BASE_PROFILE, dailyStepGoal: 12000 },
      { referenceDate: REFERENCE },
    );
    expect(insightById(report.insights, 'steps.average').title).toBe('Below your step goal');
  });

  it('treats a non-positive step goal as no target', () => {
    const entries = makeSeries(14, () => ({ steps: 10000 }));
    const report = analyzeHealth(
      entries,
      { ...BASE_PROFILE, dailyStepGoal: 0 },
      { referenceDate: REFERENCE },
    );
    const insight = insightById(report.insights, 'steps.average');
    expect(insight.severity).toBe('positive');
    expect(insight.evidence.join(' ')).not.toContain('Infinity');
  });
});

describe('calorie rules', () => {
  it('is positive when intake matches the estimated burn', () => {
    // TDEE for this profile at 80 kg is 1780 * 1.55 = 2759 kcal.
    const entries = makeSeries(14, () => ({ weightKg: 80, calories: 2760 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(insightById(report.insights, 'calories.balance').severity).toBe('positive');
  });

  it('warns about a large deficit', () => {
    const entries = makeSeries(14, () => ({ weightKg: 80, calories: 2000 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(insightById(report.insights, 'calories.balance').severity).toBe('warning');
  });

  it('is critical for a severe deficit', () => {
    const entries = makeSeries(14, () => ({ weightKg: 80, calories: 900 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(insightById(report.insights, 'calories.balance').severity).toBe('critical');
  });

  it('warns about a surplus', () => {
    const entries = makeSeries(14, () => ({ weightKg: 80, calories: 4200 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(insightById(report.insights, 'calories.balance').title).toBe('Sustained calorie surplus');
  });

  it('prefers an explicit calorie goal over the estimate', () => {
    const entries = makeSeries(14, () => ({ calories: 2200 }));
    const report = analyzeHealth(
      entries,
      { ...BASE_PROFILE, dailyCalorieGoal: 2200 },
      { referenceDate: REFERENCE },
    );
    const insight = insightById(report.insights, 'calories.balance');
    expect(insight.severity).toBe('positive');
    expect(insight.evidence).toContain('Your target 2,200 kcal');
  });

  it('asks for a profile when there is no target and no estimate', () => {
    const entries = makeSeries(14, () => ({ calories: 2200 }));
    const report = analyzeHealth(entries, {}, { referenceDate: REFERENCE });
    expect(insightById(report.insights, 'calories.balance').title).toContain('no target');
  });

  it('flags erratic intake', () => {
    const entries = makeSeries(14, (i) => ({ calories: i % 2 === 0 ? 1200 : 3800 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(insightById(report.insights, 'calories.stability').title).toBe('Erratic calorie intake');
  });

  it('is positive about steady intake', () => {
    const entries = makeSeries(14, () => ({ calories: 2500 }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(insightById(report.insights, 'calories.stability').severity).toBe('positive');
  });

  it('is positive when intake and weight agree', () => {
    // A ~250 kcal/day deficit against ~3069 kcal TDEE predicts about -0.23 kg/week.
    const entries = makeSeries(14, (i) => ({
      weightKg: 80 - i * 0.032,
      calories: 2820,
    }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(insightById(report.insights, 'calories.weight-alignment').severity).toBe('positive');
  });

  it('warns when intake does not explain the weight change', () => {
    // Large deficit on paper but weight is climbing.
    const entries = makeSeries(14, (i) => ({
      weightKg: 80 + i * 0.2,
      calories: 2000,
    }));
    const report = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(insightById(report.insights, 'calories.weight-alignment').title).toBe(
      'Intake and weight change disagree',
    );
  });
});

describe('BMI rule', () => {
  it('is positive in the healthy band', () => {
    const entries = makeSeries(14, () => ({ weightKg: 75 }));
    const report = analyzeHealth(
      entries,
      { ...BASE_PROFILE, heightCm: 180 },
      { referenceDate: REFERENCE },
    );
    const insight = insightById(report.insights, 'body.bmi');
    expect(insight.severity).toBe('positive');
    expect(insight.evidence[0]).toContain('BMI 23.1');
  });

  it('warns for being underweight', () => {
    const entries = makeSeries(14, () => ({ weightKg: 50 }));
    const report = analyzeHealth(
      entries,
      { ...BASE_PROFILE, heightCm: 180 },
      { referenceDate: REFERENCE },
    );
    expect(insightById(report.insights, 'body.bmi').severity).toBe('warning');
  });

  it('warns for overweight', () => {
    const entries = makeSeries(14, () => ({ weightKg: 88 }));
    const report = analyzeHealth(
      entries,
      { ...BASE_PROFILE, heightCm: 180 },
      { referenceDate: REFERENCE },
    );
    expect(insightById(report.insights, 'body.bmi').severity).toBe('info');
  });

  it('is critical at a high obesity class', () => {
    const entries = makeSeries(14, () => ({ weightKg: 130 }));
    const report = analyzeHealth(
      entries,
      { ...BASE_PROFILE, heightCm: 180 },
      { referenceDate: REFERENCE },
    );
    expect(insightById(report.insights, 'body.bmi').severity).toBe('critical');
  });

  it('does not fire without a height', () => {
    const { heightCm: _omitted, ...profileWithoutHeight } = BASE_PROFILE;
    const entries = makeSeries(14, () => ({ weightKg: 95 }));
    const report = analyzeHealth(entries, profileWithoutHeight, { referenceDate: REFERENCE });
    expect(report.insights.some((i) => i.id === 'body.bmi')).toBe(false);
  });
});

describe('determinism', () => {
  it('produces identical reports for identical input', () => {
    const entries = makeSeries(14, (i) => ({
      weightKg: 80 + i * 0.1,
      steps: 7000,
      sleepQuality: 4,
      calories: 2400,
    }));
    const first = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    const second = analyzeHealth(entries, BASE_PROFILE, { referenceDate: REFERENCE });
    expect(first).toEqual(second);
  });
});

describe('helpers', () => {
  it('daysWithData counts dates holding at least one metric', () => {
    expect(
      daysWithData([
        { date: '2024-03-01', steps: 0 },
        { date: '2024-03-02', moods: ['Neutral'] },
        { date: '2024-03-03', weightKg: 80 },
      ]),
    ).toBe(2);
  });

  it('latestWeight reads from the summaries', () => {
    const report = analyzeHealth(
      makeSeries(14, (i) => ({ weightKg: 80 + i })),
      {},
      { referenceDate: REFERENCE },
    );
    expect(latestWeight(report.summaries)).toBe(93);
  });

  it('latestWeight is null when nothing is logged', () => {
    const report = analyzeHealth([], {}, { referenceDate: REFERENCE });
    expect(latestWeight(report.summaries)).toBeNull();
  });

  it('correlationBetween needs a minimum of paired days', () => {
    const few: DailyEntry[] = makeSeries(4, () => ({ weightKg: 80, sleepQuality: 4 }));
    expect(correlationBetween(few, 'weight', 'sleep')).toBeNull();
  });

  it('correlationBetween finds a strong relationship', () => {
    const entries = makeSeries(14, (i) => ({
      weightKg: 80 + i,
      sleepQuality: 2 + i * 0.2,
    }));
    const correlation = correlationBetween(entries, 'weight', 'sleep')!;
    expect(correlation).toBeGreaterThan(0.95);
  });

  it('exposes the thresholds it uses', () => {
    expect(THRESHOLDS.sleepVeryPoorQuality).toBe(2);
    expect(THRESHOLDS.weightTrendSignificantKgPerWeek).toBeGreaterThan(0);
  });
});