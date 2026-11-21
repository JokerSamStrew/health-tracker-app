/**
 * Copy for the insight engine, keyed by insight id.
 *
 * English is the source of truth and stays byte-for-byte identical to the text
 * the engine has always produced, so existing assertions keep working. A
 * missing Russian key is a compile error rather than a runtime fallback. This
 * module is pure data: no React, DOM, storage or clock access.
 */

import type { Locale } from '../types.ts';

const en = {
  // data.insufficient
  'data.insufficient.title': 'Not enough data yet',
  'data.insufficient.summary':
    'Log at least {days} days to unlock trend analysis and recommendations.',
  'data.insufficient.evidence.logged': '{logged} of {window} days logged',
  'data.insufficient.evidence.window': 'Window: {start} to {end}',
  'data.insufficient.rec1.title': 'Log every day for two weeks',
  'data.insufficient.rec1.detail':
    'A dense {days}-day window is what makes the trends and correlations reliable.',
  'data.insufficient.rec2.title': 'One entry per day is enough',
  'data.insufficient.rec2.detail':
    'Weight, steps, sleep, activity and calories are all optional, but the more you log the sharper the advice.',

  // data.coverage
  'data.coverage.title': 'Incomplete logging',
  'data.coverage.summary':
    'Only {percent}% of days in the window have data, so trends may be misleading.',
  'data.coverage.evidence.logged': '{logged} of {window} days logged',
  'data.coverage.rec1.title': 'Set a daily reminder',
  'data.coverage.rec1.detail':
    'Even a 30-second entry at the same time each morning keeps the series continuous.',
  'data.coverage.rec2.title': 'Backfill when you miss a day',
  'data.coverage.rec2.detail':
    'You can add entries for past dates - gaps of 1-2 days have little effect on the averages.',

  // data.missing-metrics
  'data.missing-metrics.title': 'Some metrics are not being tracked',
  'data.missing-metrics.summary':
    'No data for {metrics} in this window, so the related checks are skipped.',
  'data.missing-metrics.evidence.missing': '{metric}: 0 values',
  'data.missing-metrics.rec.title': 'Start logging {metric}',
  'data.missing-metrics.rec.detail':
    'Tracking {metric} adds a {metric}-specific analysis to this report.',
  'data.missing-metrics.metric.weight': 'weight',
  'data.missing-metrics.metric.steps': 'steps',
  'data.missing-metrics.metric.sleep': 'sleep',
  'data.missing-metrics.metric.activity': 'activity',
  'data.missing-metrics.metric.calories': 'calories',

  // body.bmi
  'body.bmi.evidence.value': 'BMI {value} ({band})',
  'body.bmi.evidence.latest': 'Latest weight {weight} kg',
  'body.bmi.evidence.healthyRange': 'Healthy BMI weight range: {min}-{max} kg',
  'body.bmi.title.healthy': 'Body mass index is in the healthy band',
  'body.bmi.summary.healthy': 'A BMI of {value} sits inside the 18.5-24.9 range.',
  'body.bmi.recHealthy1.title': 'Keep the habits that are working',
  'body.bmi.recHealthy1.detail': 'Re-check monthly; BMI is a screening tool, not a diagnosis.',
  'body.bmi.recOverweight1.title': 'Aim for a 0.25-0.75% body weight change per week',
  'body.bmi.recOverweight1.detail':
    'For {weight} kg that is roughly {weekly} kg per week - a sustainable pace.',
  'body.bmi.recOverweight2.title': 'Combine resistance training with cardio',
  'body.bmi.recOverweight2.detail':
    'Two or three sessions a week protects muscle mass while you are in a deficit.',
  'body.bmi.recOverweight3.title': 'Bring daily movement up gradually',
  'body.bmi.recOverweight3.detail':
    'Extra 1,000-2,000 steps a day is often easier to sustain than a diet cut.',
  'body.bmi.recUnderweight1.title': 'Make sure you are eating enough',
  'body.bmi.recUnderweight1.detail':
    'A BMI of {value} usually calls for a calorie surplus plus resistance training, not more cardio.',
  'body.bmi.recUnderweight2.title': 'Get any unintentional weight loss checked',
  'body.bmi.recUnderweight2.detail':
    'Unplanned loss of more than 5% of body weight in a month warrants a doctor visit.',
  'body.bmi.title.other': 'BMI is in the {band} range',
  'body.bmi.summary.above': 'A BMI of {value} is above the healthy range of 18.5-24.9.',
  'body.bmi.summary.below': 'A BMI of {value} is below the healthy range of 18.5-24.9.',

  // weight.trend
  'weight.trend.evidence.trend': 'Trend: {value} kg per week',
  'weight.trend.evidence.latest': 'Latest weight {weight} kg',
  'weight.trend.evidence.basedOn': 'Based on {count} weigh-ins',
  'weight.trend.title.rapid': 'Weight is dropping too fast',
  'weight.trend.summary.rapid':
    'You are losing {weight} kg per week, about {percent}% of your body weight.',
  'weight.trend.recRapid1.title': 'Eat more and slow the pace down',
  'weight.trend.recRapid1.detail':
    'Faster than ~1% of body weight per week you lose muscle as well as fat.',
  'weight.trend.recRapid2.title': 'See a doctor if the loss was not intentional',
  'weight.trend.recRapid2.detail':
    'Unexplained rapid weight loss can be a sign of an underlying condition.',
  'weight.trend.title.up': 'Weight is trending up',
  'weight.trend.summary.up': 'Your weight is rising by about {weight} kg per week.',
  'weight.trend.recUp1.title': 'Check the calorie trend first',
  'weight.trend.recUp1.detail':
    'The "intake vs. burn" insight below shows whether calories are driving this.',
  'weight.trend.recUp2.title': 'Look at drinks and sauces',
  'weight.trend.recUp2.detail':
    'Liquid calories and condiments are the most common invisible surplus.',
  'weight.trend.recUp3.title': 'Build a small daily movement habit',
  'weight.trend.recUp3.detail':
    'A 15-minute walk after one meal removes roughly 750 kcal per week.',
  'weight.trend.title.down': 'Weight is trending down',
  'weight.trend.summary.down':
    'Your weight is falling by about {weight} kg per week - a healthy pace.',
  'weight.trend.recDown1.title': 'Protect your muscle',
  'weight.trend.recDown1.detail':
    'Keep protein intake steady and train two or three times a week.',
  'weight.trend.recDown2.title': 'Plan the end point',
  'weight.trend.recDown2.detail':
    'Once you reach your target, switch to maintenance calories rather than continuing to cut.',
  'weight.trend.title.creepUp': 'Weight is creeping up slightly',
  'weight.trend.summary.creepUp':
    'A slow gain of about {weight} kg per week - small, but worth watching.',
  'weight.trend.recCreepUp1.title': 'Watch it for another week',
  'weight.trend.recCreepUp1.detail':
    'If the trend continues, trim 100-200 kcal per day rather than doing a hard cut.',
  'weight.trend.title.creepDown': 'Weight is drifting down slightly',
  'weight.trend.summary.creepDown': 'A slow loss of about {weight} kg per week.',
  'weight.trend.recCreepDown1.title': 'Confirm this is intended',
  'weight.trend.recCreepDown1.detail':
    'If you are not actively trying to lose weight, make sure you are eating enough.',
  'weight.trend.title.stable': 'Weight is stable',
  'weight.trend.summary.stable':
    'Your weight is holding steady within about {weight} kg per week.',
  'weight.trend.recStable1.title': 'Hold the current routine',
  'weight.trend.recStable1.detail':
    'A stable weight with logged activity and good sleep is the goal, not a lower number.',

  // weight.goal
  'weight.goal.evidence.target': 'Target {weight} kg',
  'weight.goal.evidence.current': 'Current {weight} kg',
  'weight.goal.evidence.gap': 'Gap {gap} kg',
  'weight.goal.title.reached': 'Target weight reached',
  'weight.goal.summary.reached': 'You are within {gap} kg of your {target} kg target.',
  'weight.goal.recReached1.title': 'Switch to maintenance calories',
  'weight.goal.recReached1.detail':
    'Recalculate your daily calorie target from your current weight.',
  'weight.goal.rec1.title': 'A {pace} kg per week pace is the usual target',
  'weight.goal.rec1.detail.one':
    'From {weight} kg that is about {weeks} week to reach {target} kg.',
  'weight.goal.rec1.detail.other':
    'From {weight} kg that is about {weeks} weeks to reach {target} kg.',
  'weight.goal.rec2.title': 'Aim for roughly {calories} kcal per day',
  'weight.goal.rec2.detail': 'Derived from your estimated burn for a {activity} profile.',
  'weight.goal.rec2.activity.fallback': 'moderate',
  'weight.goal.rec3.title': 'The current trend moves away from the goal',
  'weight.goal.rec3.detail.upUp':
    'You are trending up while the goal is up. Close the calorie gap first.',
  'weight.goal.rec3.detail.upDown':
    'You are trending up while the goal is down. Close the calorie gap first.',
  'weight.goal.rec3.detail.downUp':
    'You are trending down while the goal is up. Close the calorie gap first.',
  'weight.goal.rec3.detail.downDown':
    'You are trending down while the goal is down. Close the calorie gap first.',
  'weight.goal.title.toGoal': '{gap} kg to goal',
  'weight.goal.title.aboveGoal': '{gap} kg above goal',
  'weight.goal.summary.toGoal': 'You need {gap} kg more to reach your target.',
  'weight.goal.summary.aboveGoal': 'You are {gap} kg over your target.',

  // weight.forecast
  'weight.forecast.rec1.title': 'Treat the date as a projection, not a promise',
  'weight.forecast.rec1.detail':
    'It extends the trend of your recent weigh-ins in a straight line. A plateau, an illness or a holiday moves it, so re-check as you log.',
  'weight.forecast.rec2.title': 'Compare with the usual safe pace',
  'weight.forecast.rec2.detail':
    'At {pace} kg per week the same gap takes about {days} days, and a change that size is far easier to sustain.',
  'weight.forecast.title': 'Target in {days} days',
  'weight.forecast.summary.short':
    'At your current pace of {pace} kg per week you would reach {target} kg in {days} days, on {date}.',
  'weight.forecast.summary.withWeeks':
    'At your current pace of {pace} kg per week you would reach {target} kg in {days} days (about {weeks} weeks), on {date}.',
  'weight.forecast.evidence.trend': 'Trend {trend} kg per week',
  'weight.forecast.evidence.current': 'Current {weight} kg (last weigh-in {date})',
  'weight.forecast.evidence.target': 'Target {weight} kg',
  'weight.forecast.evidence.gap': 'Gap {gap} kg',
  'weight.forecast.evidence.arrival': 'Arrival {date} - {days} days from {from}',

  // sleep.average
  'sleep.average.evidence.average': 'Average {value}/5',
  'sleep.average.evidence.goal': 'Goal {value}/5',
  'sleep.average.evidence.basedOn': 'Based on {count} nights',
  'sleep.average.title.veryPoor': 'Sleep quality is very poor',
  'sleep.average.summary.veryPoor':
    'You are averaging only {value}/5 for sleep quality - consistently poor rest.',
  'sleep.average.recVeryPoor1.title': 'Protect a fixed wake time',
  'sleep.average.recVeryPoor1.detail':
    'A fixed wake time, even at the weekend, pulls bedtime forward on its own.',
  'sleep.average.recVeryPoor2.title': 'Cut caffeine 8 hours before bed',
  'sleep.average.recVeryPoor2.detail':
    'Caffeine has a half-life of about 5 hours and delays sleep onset.',
  'sleep.average.recVeryPoor3.title': 'Make the room dark and cool',
  'sleep.average.recVeryPoor3.detail':
    'Bright light and warmth both fragment the night and delay sleep onset.',
  'sleep.average.title.below': 'Sleep quality below target',
  'sleep.average.summary.below':
    'You are averaging {value}/5, about {deficit} below your {goal}/5 target.',
  'sleep.average.recBelow1.title': 'Move bedtime earlier by 15 minutes a week',
  'sleep.average.recBelow1.detail':
    'Adenosine build-up, not willpower, sets your sleep pressure - extend the runway.',
  'sleep.average.recBelow2.title': 'Dim the evening environment',
  'sleep.average.recBelow2.detail': 'Bright light and scrolling both suppress melatonin release.',
  'sleep.average.recBelow3.title': 'Review anything that keeps you up',
  'sleep.average.recBelow3.detail':
    'Late caffeine, alcohol, and irregular meal timing are the usual culprits.',
  'sleep.average.title.onTarget': 'Sleep quality is on target',
  'sleep.average.summary.onTarget':
    'You are averaging {value}/5, right around your {goal}/5 goal.',
  'sleep.average.recOnTarget1.title': 'Sleep quality is your cheapest performance gain',
  'sleep.average.recOnTarget1.detail':
    'It supports training quality, appetite regulation and mood more than most supplements do.',

  // sleep.regularity
  'sleep.regularity.evidence.variation':
    'Nightly variation: {value}/5 (standard deviation)',
  'sleep.regularity.evidence.cv': 'Coefficient of variation {percent}%',
  'sleep.regularity.evidence.average': 'Average {value}/5 across {count} nights',
  'sleep.regularity.title.consistent': 'Sleep quality is consistent',
  'sleep.regularity.summary.consistent':
    'Your sleep quality varies by only {percent}%, which is the ideal pattern.',
  'sleep.regularity.recConsistent1.title': 'Keep the routine',
  'sleep.regularity.recConsistent1.detail':
    'Consistency matters as much as the rating itself for recovery quality.',
  'sleep.regularity.title.irregular': 'Irregular sleep pattern',
  'sleep.regularity.summary.irregular':
    'Your sleep quality swings by {percent}%, which usually means an unstable schedule or routine.',
  'sleep.regularity.recIrregular1.title': 'Anchor on the wake time',
  'sleep.regularity.recIrregular1.detail':
    'Even on weekends, stay within an hour of your weekday wake time.',
  'sleep.regularity.recIrregular2.title': 'Use the same wind-down sequence',
  'sleep.regularity.recIrregular2.detail':
    'Repetition trains the brain to associate the routine with sleep.',
  'sleep.regularity.recIrregular3.title': 'Get daylight within an hour of waking',
  'sleep.regularity.recIrregular3.detail':
    'Morning light is the strongest cue for tonight`s sleep drive.',

  // sleep.weight-interaction
  'sleep.weight-interaction.title': 'Poor sleep is compounding your weight trend',
  'sleep.weight-interaction.summary':
    'Average sleep quality of {sleep}/5 alongside a {weight} kg/week gain is a known appetite-metabolism pattern.',
  'sleep.weight-interaction.evidence.average': 'Average sleep quality {value}/5',
  'sleep.weight-interaction.evidence.trend': 'Weight trend {trend} kg per week',
  'sleep.weight-interaction.rec1.title': 'Treat sleep as part of the weight plan',
  'sleep.weight-interaction.rec1.detail':
    'Sleep restriction raises ghrelin and lowers leptin, so hunger signals get louder.',
  'sleep.weight-interaction.rec2.title': 'Fix sleep before tightening calories',
  'sleep.weight-interaction.rec2.detail':
    'Cutting calories while sleep-deprived is the combination most likely to fail.',

  // steps.average
  'steps.average.evidence.average': 'Average {steps} steps per day',
  'steps.average.evidence.goal': 'Goal {steps} steps',
  'steps.average.evidence.basedOn': 'Based on {count} days',
  'steps.average.evidence.goalPercent': '{percent}% of the daily goal',
  'steps.average.title.veryLow': 'Very sedentary days',
  'steps.average.summary.veryLow':
    'You are averaging {steps} steps, less than half of your {goal} step goal.',
  'steps.average.recVeryLow1.title': 'Start with a 10-minute walk after a meal',
  'steps.average.recVeryLow1.detail':
    'Post-meal walks blunt the glucose spike and add ~1,000 steps each.',
  'steps.average.recVeryLow2.title': 'Break up sitting every hour',
  'steps.average.recVeryLow2.detail': 'Set a recurring reminder to stand for two minutes.',
  'steps.average.title.below': 'Below your step goal',
  'steps.average.summary.below': 'You are averaging {steps} steps, {percent}% below your goal.',
  'steps.average.recBelow1.title': 'Add 1,000 steps a day this week',
  'steps.average.recBelow1.detail': 'Park further away, take the stairs, or walk one extra call.',
  'steps.average.title.met': 'Daily movement target is met',
  'steps.average.summary.met': 'You are averaging {steps} steps against a goal of {goal}.',
  'steps.average.recMet1.title': 'Keep the streak visible',
  'steps.average.recMet1.detail':
    'Knowing which days you missed the goal makes the next one easier.',

  // steps.trend
  'steps.trend.evidence.trend': 'Step trend {trend} per week',
  'steps.trend.evidence.logged': '{count} days logged',
  'steps.trend.title.declining': 'Activity is declining',
  'steps.trend.summary.declining':
    'Your daily steps are dropping by about {steps} per week.',
  'steps.trend.recDeclining1.title': 'Find the drop-off point',
  'steps.trend.recDeclining1.detail':
    'Compare work days with free days - the loss is usually structural, not motivational.',
  'steps.trend.recDeclining2.title': 'Lower the target to something easy',
  'steps.trend.recDeclining2.detail':
    'Even 500 steps more per day protects the habit while the routine rebuilds.',
  'steps.trend.title.up': 'Activity is trending up',
  'steps.trend.summary.up': 'Your daily steps are climbing by about {steps} per week.',
  'steps.trend.recUp1.title': 'Bank the new normal',
  'steps.trend.recUp1.detail':
    'Set a step floor slightly below your current average to keep the momentum.',

  // activity.average
  'activity.average.evidence.average': 'Average {value}/5',
  'activity.average.evidence.goal': 'Goal {value}/5',
  'activity.average.evidence.basedOn': 'Based on {count} days',
  'activity.average.title.veryLow': 'Physical activity is very low',
  'activity.average.summary.veryLow':
    'You are averaging only {value}/5 for physical activity - barely moving on most days.',
  'activity.average.recVeryLow1.title': 'Start with a 10-minute walk',
  'activity.average.recVeryLow1.detail':
    'A short daily walk is far easier to keep up than a planned workout, and it counts.',
  'activity.average.recVeryLow2.title': 'Break up sitting every hour',
  'activity.average.recVeryLow2.detail': 'Set a recurring reminder to stand for two minutes.',
  'activity.average.title.below': 'Activity below target',
  'activity.average.summary.below':
    'You are averaging {value}/5, about {deficit} below your {goal}/5 target.',
  'activity.average.recBelow1.title': 'Pick one activity you actually enjoy',
  'activity.average.recBelow1.detail':
    'Three moderate sessions a week is a solid base - consistency beats intensity.',
  'activity.average.recBelow2.title': 'Attach movement to an existing habit',
  'activity.average.recBelow2.detail': 'A walk straight after lunch removes the decision from the day.',
  'activity.average.title.onTarget': 'Physical activity is on target',
  'activity.average.summary.onTarget':
    'You are averaging {value}/5, right around your {goal}/5 goal.',
  'activity.average.recOnTarget1.title': 'Keep the rhythm',
  'activity.average.recOnTarget1.detail':
    'Regular movement protects cardiovascular health, mood and sleep quality.',

  // activity.regularity
  'activity.regularity.evidence.variation':
    'Day-to-day variation: {value}/5 (standard deviation)',
  'activity.regularity.evidence.cv': 'Coefficient of variation {percent}%',
  'activity.regularity.evidence.average': 'Average {value}/5 across {count} days',
  'activity.regularity.title.steady': 'Activity is steady',
  'activity.regularity.summary.steady':
    'Your activity rating varies by only {percent}%, which is the ideal pattern.',
  'activity.regularity.recSteady1.title': 'Keep the routine',
  'activity.regularity.recSteady1.detail':
    'Steady movement is easier on the body than alternating hard and idle days.',
  'activity.regularity.title.bursts': 'Activity comes in bursts',
  'activity.regularity.summary.bursts':
    'Your activity rating swings by {percent}%, which usually means a few intense days between quiet ones.',
  'activity.regularity.recBursts1.title': 'Add one easy day between hard ones',
  'activity.regularity.recBursts1.detail':
    'A 20-minute walk on the quiet days keeps the weekly total up without the spikes.',
  'activity.regularity.recBursts2.title': 'Judge the week, not the day',
  'activity.regularity.recBursts2.detail': 'The weekly average is what carries the health benefit.',

  // activity.steps-alignment
  'activity.steps-alignment.evidence.rating': 'Average activity rating {value}/5',
  'activity.steps-alignment.evidence.steps': 'Average {steps} steps per day',
  'activity.steps-alignment.evidence.goalPercent': '{percent}% of the daily step goal',
  'activity.steps-alignment.title.understates': 'Your step count understates your training',
  'activity.steps-alignment.summary.understates':
    'You rate your activity {rating}/5 but only average {percent}% of your step goal - cycling, swimming and gym work add far fewer steps.',
  'activity.steps-alignment.recUnderstates1.title': 'Keep rating those days',
  'activity.steps-alignment.recUnderstates1.detail':
    'The rating is what lets the analysis see training that never reaches your step count.',
  'activity.steps-alignment.recUnderstates2.title': 'Do not chase the step goal on training days',
  'activity.steps-alignment.recUnderstates2.detail':
    'A hard session on 3,000 steps still beats a sedentary 10,000.',
  'activity.steps-alignment.title.low': 'Your activity rating looks low',
  'activity.steps-alignment.summary.low':
    'You rate your activity {rating}/5 while averaging {steps} steps a day, at or above your goal.',
  'activity.steps-alignment.recLow1.title': 'Check the rating on those days',
  'activity.steps-alignment.recLow1.detail':
    'Walking 8,000 steps is a moderate day, so the number may be understating it.',

  // calories.balance
  'calories.balance.evidence.average': 'Average intake {calories} kcal per day',
  'calories.balance.evidence.basedOn': 'Based on {count} days',
  'calories.balance.evidence.burn': 'Estimated burn {calories} kcal',
  'calories.balance.evidence.target': 'Your target {calories} kcal',
  'calories.balance.title.noTarget': 'Intake logged, no target to compare against',
  'calories.balance.summary.noTarget':
    'Add your birth date, sex and height to your profile to estimate how much you burn per day.',
  'calories.balance.recNoTarget1.title': 'Complete your profile',
  'calories.balance.recNoTarget1.detail':
    'Height, birth date, sex and activity level let the app estimate your maintenance calories.',
  'calories.balance.title.severeDeficit': 'Eating far too little',
  'calories.balance.summary.severeDeficit':
    'You are averaging {avg} kcal against an estimated need of {target} - a deficit of {deficit} kcal per day.',
  'calories.balance.recSevere1.title': 'Raise intake toward maintenance',
  'calories.balance.recSevere1.detail':
    'Deficits beyond ~20-35% of needs bring fatigue, poor recovery and muscle loss.',
  'calories.balance.recSevere2.title': 'Get medical advice if this is long-term',
  'calories.balance.recSevere2.detail': 'Sustained very low intake should be supervised.',
  'calories.balance.title.largeDeficit': 'Large calorie deficit',
  'calories.balance.summary.largeDeficit':
    'You are eating about {calories} kcal per day below your estimated need.',
  'calories.balance.recDeficit1.title': 'Check protein intake',
  'calories.balance.recDeficit1.detail':
    'Roughly {protein} g per day keeps you in a deficit without losing muscle.',
  'calories.balance.recDeficit2.title': 'Is the deficit deliberate?',
  'calories.balance.recDeficit2.detail':
    'If you are not actively cutting, this may simply be under-reporting.',
  'calories.balance.title.surplus': 'Sustained calorie surplus',
  'calories.balance.summary.surplus':
    'You are eating about {calories} kcal per day above your estimated need.',
  'calories.balance.recSurplus1.title': 'Trim 200 kcal rather than 500',
  'calories.balance.recSurplus1.detail':
    'Smaller cuts are far more likely to still be in place a month from now.',
  'calories.balance.recSurplus2.title': 'Watch for the liquid and snack calories',
  'calories.balance.recSurplus2.detail':
    'This size of gap is usually beverages, nuts, or cooking oil.',
  'calories.balance.title.matched': 'Intake matches your estimated burn',
  'calories.balance.summary.matched':
    'You are averaging {avg} kcal against a target of {target}.',
  'calories.balance.recMatched1.title': 'This is the right baseline',
  'calories.balance.recMatched1.detail':
    'Adjust from here: add ~250 kcal for a gentle loss, subtract for a gentle gain.',
  'calories.balance.title.mildDeficit': 'Mild calorie deficit',
  'calories.balance.title.mildSurplus': 'Mild calorie surplus',
  'calories.balance.summary.below': 'Intake is {calories} kcal per day below the {target} kcal target.',
  'calories.balance.summary.above': 'Intake is {calories} kcal per day above the {target} kcal target.',
  'calories.balance.recMild1.title': 'Keep logging to confirm it sticks',
  'calories.balance.recMild1.detail':
    'A 3-4 week window is enough to see whether this shows up in your weight.',

  // calories.stability
  'calories.stability.evidence.variation':
    'Day-to-day variation {percent}% (coefficient of variation)',
  'calories.stability.evidence.logged': '{count} days logged',
  'calories.stability.title.steady': 'Calorie intake is steady',
  'calories.stability.summary.steady':
    'Your daily intake varies by only {percent}%, which is easy to reason about.',
  'calories.stability.recSteady1.title': 'Use the weekly total as the real number',
  'calories.stability.recSteady1.detail':
    'Daily noise is normal; what matters is the average across the week.',
  'calories.stability.title.erratic': 'Erratic calorie intake',
  'calories.stability.summary.erratic':
    'Your intake swings by {percent}%, which usually means a restrict-and-binge cycle.',
  'calories.stability.recErratic1.title': 'Aim for consistency, not perfection',
  'calories.stability.recErratic1.detail':
    'Keeping each day within ~200 kcal of the target beats one perfect day in five.',
  'calories.stability.recErratic2.title': 'Look for the weekend pattern',
  'calories.stability.recErratic2.detail':
    'Two high days a week are fine; five high days a week are not.',

  // calories.weight-alignment
  'calories.weight-alignment.evidence.trend': 'Observed weight trend {trend} kg per week',
  'calories.weight-alignment.evidence.expected':
    'Intake that would explain it: {calories} kcal per day',
  'calories.weight-alignment.evidence.actual': 'Actually logged: {calories} kcal per day',
  'calories.weight-alignment.evidence.gap': 'Gap {gap} kcal per day',
  'calories.weight-alignment.title.disagree': 'Intake and weight change disagree',
  'calories.weight-alignment.summary.disagree':
    'Your logged calories do not explain the weight trend - a {calories} kcal per day gap suggests logging accuracy, not metabolism.',
  'calories.weight-alignment.recDisagree1.title': 'Weigh portions for a week',
  'calories.weight-alignment.recDisagree1.detail':
    'Calorie apps miss oils, sauces and drinks, which are usually the gap.',
  'calories.weight-alignment.recDisagree2.title':
    'Compare weight trend against the weekly calorie average',
  'calories.weight-alignment.recDisagree2.detail':
    'The weekly total is far more reliable than any single day.',
  'calories.weight-alignment.title.consistent': 'Calories and weight tell a consistent story',
  'calories.weight-alignment.summary.consistent':
    'Your logged intake matches the weight change you are seeing, within {calories} kcal per day.',
  'calories.weight-alignment.recConsistent1.title': 'Trust your own data',
  'calories.weight-alignment.recConsistent1.detail':
    'Internal consistency is what makes the recommendations trustworthy.',
} as const;

export type InsightTextKey = keyof typeof en;

export type InsightTranslator = (
  key: InsightTextKey,
  params?: Record<string, string | number>,
) => string;

/** Replaces every `{name}` token; unknown tokens are left as-is. */
function interpolate(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

const ru: Record<InsightTextKey, string> = {
  // data.insufficient
  'data.insufficient.title': 'Пока недостаточно данных',
  'data.insufficient.summary':
    'Запишите данные минимум за {days} дней, чтобы открыть анализ трендов и рекомендации.',
  'data.insufficient.evidence.logged': 'Записано {logged} из {window} дней',
  'data.insufficient.evidence.window': 'Период: {start} — {end}',
  'data.insufficient.rec1.title': 'Записывайте данные каждый день две недели',
  'data.insufficient.rec1.detail':
    'Именно плотный период в {days} дней делает тренды и корреляции надёжными.',
  'data.insufficient.rec2.title': 'Одна запись в день — достаточно',
  'data.insufficient.rec2.detail':
    'Вес, шаги, сон, активность и калории необязательны, но чем больше вы записываете, тем точнее советы.',

  // data.coverage
  'data.coverage.title': 'Неполные записи',
  'data.coverage.summary':
    'Данные есть только за {percent}% дней периода, поэтому тренды могут быть неточными.',
  'data.coverage.evidence.logged': 'Записано {logged} из {window} дней',
  'data.coverage.rec1.title': 'Поставьте ежедневное напоминание',
  'data.coverage.rec1.detail':
    'Даже 30-секундная запись в одно и то же время каждое утро сохраняет непрерывность ряда.',
  'data.coverage.rec2.title': 'Вносите пропущенные дни',
  'data.coverage.rec2.detail':
    'Вы можете добавить записи за прошлые даты — пропуски в 1–2 дня почти не влияют на средние.',

  // data.missing-metrics
  'data.missing-metrics.title': 'Некоторые показатели не отслеживаются',
  'data.missing-metrics.summary':
    'В этом периоде нет данных по показателям: {metrics}. Связанные проверки пропущены.',
  'data.missing-metrics.evidence.missing': '{metric}: 0 значений',
  'data.missing-metrics.rec.title': 'Начните записывать {metric}',
  'data.missing-metrics.rec.detail':
    'Отслеживание показателя «{metric}» добавит в этот отчёт отдельный анализ по показателю «{metric}».',
  'data.missing-metrics.metric.weight': 'вес',
  'data.missing-metrics.metric.steps': 'шаги',
  'data.missing-metrics.metric.sleep': 'сон',
  'data.missing-metrics.metric.activity': 'активность',
  'data.missing-metrics.metric.calories': 'калории',

  // body.bmi
  'body.bmi.evidence.value': 'ИМТ {value} ({band})',
  'body.bmi.evidence.latest': 'Последний вес: {weight} кг',
  'body.bmi.evidence.healthyRange': 'Здоровый диапазон веса по ИМТ: {min}–{max} кг',
  'body.bmi.title.healthy': 'Индекс массы тела в норме',
  'body.bmi.summary.healthy': 'ИМТ {value} находится в пределах 18,5–24,9.',
  'body.bmi.recHealthy1.title': 'Сохраняйте привычки, которые работают',
  'body.bmi.recHealthy1.detail': 'Проверяйте раз в месяц: ИМТ — скрининговый показатель, а не диагноз.',
  'body.bmi.recOverweight1.title': 'Стремитесь к изменению веса на 0,25–0,75% в неделю',
  'body.bmi.recOverweight1.detail':
    'При весе {weight} кг это примерно {weekly} кг в неделю — устойчивый темп.',
  'body.bmi.recOverweight2.title': 'Сочетайте силовые тренировки с кардио',
  'body.bmi.recOverweight2.detail':
    'Две-три тренировки в неделю помогают сохранить мышцы в период дефицита.',
  'body.bmi.recOverweight3.title': 'Постепенно увеличивайте ежедневную активность',
  'body.bmi.recOverweight3.detail':
    'Дополнительные 1 000–2 000 шагов в день часто поддерживать легче, чем сокращение рациона.',
  'body.bmi.recUnderweight1.title': 'Убедитесь, что вы едите достаточно',
  'body.bmi.recUnderweight1.detail':
    'При ИМТ {value} обычно нужен профицит калорий и силовые тренировки, а не больше кардио.',
  'body.bmi.recUnderweight2.title': 'Проверьте незапланированную потерю веса',
  'body.bmi.recUnderweight2.detail':
    'Незапланированная потеря более 5% веса за месяц — повод обратиться к врачу.',
  'body.bmi.title.other': 'ИМТ находится в диапазоне «{band}»',
  'body.bmi.summary.above': 'ИМТ {value} выше здорового диапазона 18,5–24,9.',
  'body.bmi.summary.below': 'ИМТ {value} ниже здорового диапазона 18,5–24,9.',

  // weight.trend
  'weight.trend.evidence.trend': 'Тренд: {value} кг в неделю',
  'weight.trend.evidence.latest': 'Последний вес: {weight} кг',
  'weight.trend.evidence.basedOn': 'На основе {count} взвешиваний',
  'weight.trend.title.rapid': 'Вес снижается слишком быстро',
  'weight.trend.summary.rapid':
    'Вы теряете {weight} кг в неделю — это около {percent}% массы тела.',
  'weight.trend.recRapid1.title': 'Ешьте больше и замедлите темп',
  'weight.trend.recRapid1.detail':
    'При темпе выше ~1% массы тела в неделю вы теряете не только жир, но и мышцы.',
  'weight.trend.recRapid2.title': 'Обратитесь к врачу, если снижение веса было неумышленным',
  'weight.trend.recRapid2.detail':
    'Необъяснимая быстрая потеря веса может быть признаком заболевания.',
  'weight.trend.title.up': 'Вес растёт',
  'weight.trend.summary.up': 'Ваш вес увеличивается примерно на {weight} кг в неделю.',
  'weight.trend.recUp1.title': 'Сначала проверьте тренд калорий',
  'weight.trend.recUp1.detail':
    'Анализ «потребление и расход» ниже покажет, связано ли это с калориями.',
  'weight.trend.recUp2.title': 'Обратите внимание на напитки и соусы',
  'weight.trend.recUp2.detail': 'Калории из напитков и приправ — самый частый скрытый избыток.',
  'weight.trend.recUp3.title': 'Сформируйте небольшую ежедневную привычку двигаться',
  'weight.trend.recUp3.detail':
    '15-минутная прогулка после одного приёма пищи сжигает около 750 ккал в неделю.',
  'weight.trend.title.down': 'Вес снижается',
  'weight.trend.summary.down':
    'Ваш вес снижается примерно на {weight} кг в неделю — это здоровый темп.',
  'weight.trend.recDown1.title': 'Сохраняйте мышцы',
  'weight.trend.recDown1.detail':
    'Поддерживайте стабильное потребление белка и тренируйтесь два-три раза в неделю.',
  'weight.trend.recDown2.title': 'Запланируйте конечную точку',
  'weight.trend.recDown2.detail':
    'Достигнув цели, переходите на калории для поддержания веса, а не продолжайте снижать.',
  'weight.trend.title.creepUp': 'Вес немного пополз вверх',
  'weight.trend.summary.creepUp':
    'Медленный рост около {weight} кг в неделю — немного, но стоит наблюдать.',
  'weight.trend.recCreepUp1.title': 'Понаблюдайте ещё неделю',
  'weight.trend.recCreepUp1.detail':
    'Если тренд сохранится, уменьшите рацион на 100–200 ккал в день, а не устраивайте жёсткую диету.',
  'weight.trend.title.creepDown': 'Вес немного снижается',
  'weight.trend.summary.creepDown': 'Медленное снижение около {weight} кг в неделю.',
  'weight.trend.recCreepDown1.title': 'Убедитесь, что это запланировано',
  'weight.trend.recCreepDown1.detail':
    'Если вы не стремитесь похудеть, убедитесь, что едите достаточно.',
  'weight.trend.title.stable': 'Вес стабилен',
  'weight.trend.summary.stable':
    'Ваш вес держится стабильно: колебания около {weight} кг в неделю.',
  'weight.trend.recStable1.title': 'Сохраняйте текущий режим',
  'weight.trend.recStable1.detail':
    'Стабильный вес в сочетании с записанной активностью и хорошим сном — это цель, а не просто более низкая цифра.',

  // weight.goal
  'weight.goal.evidence.target': 'Цель: {weight} кг',
  'weight.goal.evidence.current': 'Текущий вес: {weight} кг',
  'weight.goal.evidence.gap': 'Разница: {gap} кг',
  'weight.goal.title.reached': 'Целевой вес достигнут',
  'weight.goal.summary.reached': 'Вы в пределах {gap} кг от цели {target} кг.',
  'weight.goal.recReached1.title': 'Переходите на калории для поддержания веса',
  'weight.goal.recReached1.detail':
    'Пересчитайте дневную норму калорий, исходя из текущего веса.',
  'weight.goal.rec1.title': 'Обычная цель — {pace} кг в неделю',
  'weight.goal.rec1.detail.one':
    'При весе {weight} кг это около {weeks} нед. до цели {target} кг.',
  'weight.goal.rec1.detail.other':
    'При весе {weight} кг это около {weeks} нед. до цели {target} кг.',
  'weight.goal.rec2.title': 'Стремитесь примерно к {calories} ккал в день',
  'weight.goal.rec2.detail':
    'Рассчитано по вашему примерному расходу для профиля «{activity}».',
  'weight.goal.rec2.activity.fallback': 'умеренная',
  'weight.goal.rec3.title': 'Текущий тренд ведёт от цели',
  'weight.goal.rec3.detail.upUp':
    'Вес растёт, и цель тоже вверх. Сначала устраните разницу в калориях.',
  'weight.goal.rec3.detail.upDown':
    'Вес растёт, а цель — снижаться. Сначала устраните разницу в калориях.',
  'weight.goal.rec3.detail.downUp':
    'Вес снижается, а цель — расти. Сначала устраните разницу в калориях.',
  'weight.goal.rec3.detail.downDown':
    'Вес снижается, и цель тоже вниз. Сначала устраните разницу в калориях.',
  'weight.goal.title.toGoal': 'До цели {gap} кг',
  'weight.goal.title.aboveGoal': '{gap} кг выше цели',
  'weight.goal.summary.toGoal': 'Чтобы достичь цели, нужно ещё {gap} кг.',
  'weight.goal.summary.aboveGoal': 'Вы превысили цель на {gap} кг.',

  // weight.forecast
  'weight.forecast.rec1.title': 'Считайте дату прогнозом, а не обещанием',
  'weight.forecast.rec1.detail':
    'Прогноз просто продолжает тренд последних взвешиваний прямой линией. Плато, болезнь или отпуск сдвинут дату — перепроверяйте её по мере новых записей.',
  'weight.forecast.rec2.title': 'Сравните с обычным безопасным темпом',
  'weight.forecast.rec2.detail':
    'При {pace} кг в неделю та же разница займёт около {days} дн., и изменение такого размера гораздо легче поддерживать.',
  'weight.forecast.title': 'Цель через {days} дн.',
  'weight.forecast.summary.short':
    'При текущем темпе {pace} кг в неделю вы достигнете {target} кг через {days} дн. — {date}.',
  'weight.forecast.summary.withWeeks':
    'При текущем темпе {pace} кг в неделю вы достигнете {target} кг через {days} дн. (около {weeks} нед.) — {date}.',
  'weight.forecast.evidence.trend': 'Тренд {trend} кг в неделю',
  'weight.forecast.evidence.current': 'Текущий вес: {weight} кг (последнее взвешивание — {date})',
  'weight.forecast.evidence.target': 'Цель: {weight} кг',
  'weight.forecast.evidence.gap': 'Разница: {gap} кг',
  'weight.forecast.evidence.arrival': 'Достижение: {date} — {days} дн. от {from}',

  // sleep.average
  'sleep.average.evidence.average': 'Среднее: {value}/5',
  'sleep.average.evidence.goal': 'Цель: {value}/5',
  'sleep.average.evidence.basedOn': 'На основе {count} ночей',
  'sleep.average.title.veryPoor': 'Качество сна очень плохое',
  'sleep.average.summary.veryPoor':
    'Качество сна в среднем всего {value}/5 — отдых стабильно плохой.',
  'sleep.average.recVeryPoor1.title': 'Сохраняйте фиксированное время подъёма',
  'sleep.average.recVeryPoor1.detail':
    'Фиксированный подъём, даже по выходным, сам сдвигает время отбоя.',
  'sleep.average.recVeryPoor2.title': 'Исключите кофеин за 8 часов до сна',
  'sleep.average.recVeryPoor2.detail':
    'Период полураспада кофеина — около 5 часов, и он задерживает засыпание.',
  'sleep.average.recVeryPoor3.title': 'Сделайте комнату тёмной и прохладной',
  'sleep.average.recVeryPoor3.detail':
    'Яркий свет и тепло дробят сон и замедляют засыпание.',
  'sleep.average.title.below': 'Качество сна ниже цели',
  'sleep.average.summary.below':
    'В среднем у вас {value}/5 — примерно на {deficit} ниже цели {goal}/5.',
  'sleep.average.recBelow1.title': 'Сдвигайте отбой на 15 минут раньше каждую неделю',
  'sleep.average.recBelow1.detail':
    'Давление сна задаёт аденозин, а не сила воли — дайте ему больше времени.',
  'sleep.average.recBelow2.title': 'Приглушите вечерний свет',
  'sleep.average.recBelow2.detail':
    'Яркий свет и прокрутка ленты подавляют выброс мелатонина.',
  'sleep.average.recBelow3.title': 'Проверьте, что мешает вам уснуть',
  'sleep.average.recBelow3.detail':
    'Чаще всего виноваты поздний кофеин, алкоголь и нерегулярное питание.',
  'sleep.average.title.onTarget': 'Качество сна соответствует цели',
  'sleep.average.summary.onTarget':
    'В среднем у вас {value}/5 — как раз около цели {goal}/5.',
  'sleep.average.recOnTarget1.title': 'Качество сна — самый доступный способ повысить результаты',
  'sleep.average.recOnTarget1.detail':
    'Оно поддерживает качество тренировок, аппетит и настроение лучше большинства добавок.',

  // sleep.regularity
  'sleep.regularity.evidence.variation': 'Ночные колебания: {value}/5 (стандартное отклонение)',
  'sleep.regularity.evidence.cv': 'Коэффициент вариации {percent}%',
  'sleep.regularity.evidence.average': 'Среднее {value}/5 за {count} ночей',
  'sleep.regularity.title.consistent': 'Качество сна стабильно',
  'sleep.regularity.summary.consistent':
    'Качество сна меняется всего на {percent}% — это идеальный вариант.',
  'sleep.regularity.recConsistent1.title': 'Сохраняйте режим',
  'sleep.regularity.recConsistent1.detail':
    'Для восстановления стабильность важна не меньше самой оценки.',
  'sleep.regularity.title.irregular': 'Нерегулярный сон',
  'sleep.regularity.summary.irregular':
    'Качество сна колеблется на {percent}% — обычно это признак нестабильного расписания или режима.',
  'sleep.regularity.recIrregular1.title': 'Привяжитесь ко времени подъёма',
  'sleep.regularity.recIrregular1.detail':
    'Даже по выходным вставайте не позже чем на час позже, чем в будни.',
  'sleep.regularity.recIrregular2.title': 'Используйте один и тот же ритуал перед сном',
  'sleep.regularity.recIrregular2.detail':
    'Повторение учит мозг связывать этот ритуал со сном.',
  'sleep.regularity.recIrregular3.title': 'Выходите на свет в течение часа после пробуждения',
  'sleep.regularity.recIrregular3.detail':
    'Утренний свет — самый сильный сигнал для сегодняшнего желания спать.',

  // sleep.weight-interaction
  'sleep.weight-interaction.title': 'Плохой сон усиливает тренд веса',
  'sleep.weight-interaction.summary':
    'Качество сна в среднем {sleep}/5 вместе с ростом веса на {weight} кг в неделю — известный механизм влияния на аппетит и обмен.',
  'sleep.weight-interaction.evidence.average': 'Среднее качество сна: {value}/5',
  'sleep.weight-interaction.evidence.trend': 'Тренд веса: {trend} кг в неделю',
  'sleep.weight-interaction.rec1.title': 'Считайте сон частью плана по весу',
  'sleep.weight-interaction.rec1.detail':
    'Недостаток сна повышает грелин и снижает лептин, поэтому чувство голода усиливается.',
  'sleep.weight-interaction.rec2.title': 'Сначала наладьте сон, затем снижайте калории',
  'sleep.weight-interaction.rec2.detail':
    'Снижение калорий на фоне недосыпа — сочетание, которое чаще всего заканчивается неудачей.',

  // steps.average
  'steps.average.evidence.average': 'В среднем {steps} шагов в день',
  'steps.average.evidence.goal': 'Цель: {steps} шагов',
  'steps.average.evidence.basedOn': 'На основе {count} дн.',
  'steps.average.evidence.goalPercent': '{percent}% от дневной цели',
  'steps.average.title.veryLow': 'Очень малоподвижные дни',
  'steps.average.summary.veryLow':
    'В среднем {steps} шагов — меньше половины вашей цели {goal} шагов.',
  'steps.average.recVeryLow1.title': 'Начните с 10-минутной прогулки после еды',
  'steps.average.recVeryLow1.detail':
    'Прогулка после еды сглаживает скачок глюкозы и добавляет около 1 000 шагов.',
  'steps.average.recVeryLow2.title': 'Каждый час прерывайте сидение',
  'steps.average.recVeryLow2.detail': 'Поставьте повторяющееся напоминание встать на две минуты.',
  'steps.average.title.below': 'Ниже цели по шагам',
  'steps.average.summary.below': 'В среднем {steps} шагов — на {percent}% ниже цели.',
  'steps.average.recBelow1.title': 'Добавьте 1 000 шагов в день на этой неделе',
  'steps.average.recBelow1.detail':
    'Паркуйтесь дальше, ходите по лестнице или пройдитесь во время одного звонка.',
  'steps.average.title.met': 'Дневная норма движения выполнена',
  'steps.average.summary.met': 'В среднем {steps} шагов при цели {goal}.',
  'steps.average.recMet1.title': 'Держите серию на виду',
  'steps.average.recMet1.detail':
    'Зная, в какие дни вы не достигли цели, легче справиться со следующим.',

  // steps.trend
  'steps.trend.evidence.trend': 'Тренд шагов: {trend} в неделю',
  'steps.trend.evidence.logged': 'Записано дней: {count}',
  'steps.trend.title.declining': 'Активность снижается',
  'steps.trend.summary.declining':
    'Количество шагов в день уменьшается примерно на {steps} в неделю.',
  'steps.trend.recDeclining1.title': 'Найдите точку спада',
  'steps.trend.recDeclining1.detail':
    'Сравните рабочие дни с выходными — спад обычно структурный, а не мотивационный.',
  'steps.trend.recDeclining2.title': 'Снизьте цель до легко достижимой',
  'steps.trend.recDeclining2.detail':
    'Даже 500 лишних шагов в день сохраняют привычку, пока режим восстанавливается.',
  'steps.trend.title.up': 'Активность растёт',
  'steps.trend.summary.up': 'Количество шагов в день увеличивается примерно на {steps} в неделю.',
  'steps.trend.recUp1.title': 'Закрепите новую норму',
  'steps.trend.recUp1.detail':
    'Установите минимум шагов чуть ниже текущего среднего, чтобы сохранить темп.',

  // activity.average
  'activity.average.evidence.average': 'Среднее: {value}/5',
  'activity.average.evidence.goal': 'Цель: {value}/5',
  'activity.average.evidence.basedOn': 'На основе {count} дн.',
  'activity.average.title.veryLow': 'Физическая активность очень низкая',
  'activity.average.summary.veryLow':
    'Физическая активность в среднем всего {value}/5 — в большинстве дней вы почти не двигаетесь.',
  'activity.average.recVeryLow1.title': 'Начните с 10-минутной прогулки',
  'activity.average.recVeryLow1.detail':
    'Короткую ежедневную прогулку поддерживать гораздо легче, чем запланированную тренировку, и она учитывается.',
  'activity.average.recVeryLow2.title': 'Каждый час прерывайте сидение',
  'activity.average.recVeryLow2.detail': 'Поставьте повторяющееся напоминание встать на две минуты.',
  'activity.average.title.below': 'Активность ниже цели',
  'activity.average.summary.below':
    'В среднем {value}/5 — примерно на {deficit} ниже цели {goal}/5.',
  'activity.average.recBelow1.title': 'Выберите активность, которая вам действительно нравится',
  'activity.average.recBelow1.detail':
    'Три умеренные тренировки в неделю — надёжная база: стабильность важнее интенсивности.',
  'activity.average.recBelow2.title': 'Привяжите движение к существующей привычке',
  'activity.average.recBelow2.detail': 'Прогулка сразу после обеда убирает ежедневное решение.',
  'activity.average.title.onTarget': 'Физическая активность соответствует цели',
  'activity.average.summary.onTarget':
    'В среднем {value}/5 — как раз около цели {goal}/5.',
  'activity.average.recOnTarget1.title': 'Сохраняйте ритм',
  'activity.average.recOnTarget1.detail':
    'Регулярное движение защищает сердце, настроение и качество сна.',

  // activity.regularity
  'activity.regularity.evidence.variation':
    'Колебания по дням: {value}/5 (стандартное отклонение)',
  'activity.regularity.evidence.cv': 'Коэффициент вариации {percent}%',
  'activity.regularity.evidence.average': 'Среднее {value}/5 за {count} дн.',
  'activity.regularity.title.steady': 'Активность стабильна',
  'activity.regularity.summary.steady':
    'Оценка активности меняется всего на {percent}% — это идеальный вариант.',
  'activity.regularity.recSteady1.title': 'Сохраняйте режим',
  'activity.regularity.recSteady1.detail':
    'Равномерная нагрузка переносится легче, чем чередование тяжёлых и пассивных дней.',
  'activity.regularity.title.bursts': 'Активность приходит рывками',
  'activity.regularity.summary.bursts':
    'Оценка активности колеблется на {percent}% — обычно это несколько интенсивных дней среди спокойных.',
  'activity.regularity.recBursts1.title': 'Добавьте лёгкий день между тяжёлыми',
  'activity.regularity.recBursts1.detail':
    '20-минутная прогулка в спокойные дни поддерживает недельный итог без резких скачков.',
  'activity.regularity.recBursts2.title': 'Оценивайте неделю, а не день',
  'activity.regularity.recBursts2.detail': 'Именно недельное среднее даёт оздоровительный эффект.',

  // activity.steps-alignment
  'activity.steps-alignment.evidence.rating': 'Средняя оценка активности: {value}/5',
  'activity.steps-alignment.evidence.steps': 'В среднем {steps} шагов в день',
  'activity.steps-alignment.evidence.goalPercent': '{percent}% от дневной цели по шагам',
  'activity.steps-alignment.title.understates': 'Число шагов недооценивает ваши тренировки',
  'activity.steps-alignment.summary.understates':
    'Вы оцениваете активность на {rating}/5, но в среднем набираете лишь {percent}% цели по шагам — езда на велосипеде, плавание и зал дают гораздо меньше шагов.',
  'activity.steps-alignment.recUnderstates1.title': 'Продолжайте оценивать эти дни',
  'activity.steps-alignment.recUnderstates1.detail':
    'Именно оценка позволяет анализу увидеть тренировки, которые не отражаются в шагах.',
  'activity.steps-alignment.recUnderstates2.title': 'Не гонитесь за целью по шагам в тренировочные дни',
  'activity.steps-alignment.recUnderstates2.detail':
    'Интенсивная тренировка на 3 000 шагов лучше сидячих 10 000.',
  'activity.steps-alignment.title.low': 'Ваша оценка активности выглядит заниженной',
  'activity.steps-alignment.summary.low':
    'Вы оцениваете активность на {rating}/5, при этом в среднем {steps} шагов в день — на уровне цели или выше.',
  'activity.steps-alignment.recLow1.title': 'Проверьте оценку в эти дни',
  'activity.steps-alignment.recLow1.detail':
    '8 000 шагов — это день умеренной активности, поэтому оценка может быть занижена.',

  // calories.balance
  'calories.balance.evidence.average': 'Среднее потребление: {calories} ккал в день',
  'calories.balance.evidence.basedOn': 'На основе {count} дн.',
  'calories.balance.evidence.burn': 'Расчётный расход: {calories} ккал',
  'calories.balance.evidence.target': 'Ваша цель: {calories} ккал',
  'calories.balance.title.noTarget': 'Потребление записано, но не с чем сравнивать',
  'calories.balance.summary.noTarget':
    'Укажите в профиле дату рождения, пол и рост, чтобы рассчитать дневной расход.',
  'calories.balance.recNoTarget1.title': 'Заполните профиль',
  'calories.balance.recNoTarget1.detail':
    'Рост, дата рождения, пол и уровень активности позволяют приложению оценить калории для поддержания веса.',
  'calories.balance.title.severeDeficit': 'Питание слишком скудное',
  'calories.balance.summary.severeDeficit':
    'В среднем {avg} ккал при расчётной потребности {target} — дефицит {deficit} ккал в день.',
  'calories.balance.recSevere1.title': 'Повысьте потребление до уровня поддержания',
  'calories.balance.recSevere1.detail':
    'Дефицит выше ~20–35% от потребности ведёт к усталости, плохому восстановлению и потере мышц.',
  'calories.balance.recSevere2.title': 'Если это длится долго, обратитесь за медицинской помощью',
  'calories.balance.recSevere2.detail':
    'Длительное очень низкое потребление должно быть под контролем врача.',
  'calories.balance.title.largeDeficit': 'Большой дефицит калорий',
  'calories.balance.summary.largeDeficit':
    'Вы потребляете примерно на {calories} ккал в день меньше расчётной потребности.',
  'calories.balance.recDeficit1.title': 'Проверьте потребление белка',
  'calories.balance.recDeficit1.detail':
    'Около {protein} г в день поможет сохранить мышцы в период дефицита.',
  'calories.balance.recDeficit2.title': 'Дефицит запланирован?',
  'calories.balance.recDeficit2.detail':
    'Если вы специально не снижаете калории, возможно, вы просто недооцениваете съеденное.',
  'calories.balance.title.surplus': 'Устойчивый избыток калорий',
  'calories.balance.summary.surplus':
    'Вы потребляете примерно на {calories} ккал в день больше расчётной потребности.',
  'calories.balance.recSurplus1.title': 'Уберите 200 ккал, а не 500',
  'calories.balance.recSurplus1.detail':
    'Небольшие сокращения гораздо вероятнее сохранятся через месяц.',
  'calories.balance.recSurplus2.title': 'Следите за калориями из напитков и перекусов',
  'calories.balance.recSurplus2.detail':
    'Такая разница обычно связана с напитками, орехами или растительным маслом.',
  'calories.balance.title.matched': 'Потребление соответствует расчётному расходу',
  'calories.balance.summary.matched': 'В среднем {avg} ккал при цели {target}.',
  'calories.balance.recMatched1.title': 'Это правильная отправная точка',
  'calories.balance.recMatched1.detail':
    'Отталкивайтесь от неё: добавьте ~250 ккал для мягкого снижения или уберите для мягкого набора.',
  'calories.balance.title.mildDeficit': 'Небольшой дефицит калорий',
  'calories.balance.title.mildSurplus': 'Небольшой избыток калорий',
  'calories.balance.summary.below':
    'Потребление на {calories} ккал в день ниже цели {target} ккал.',
  'calories.balance.summary.above':
    'Потребление на {calories} ккал в день выше цели {target} ккал.',
  'calories.balance.recMild1.title': 'Продолжайте записывать, чтобы убедиться в стабильности',
  'calories.balance.recMild1.detail':
    'Период в 3–4 недели достаточно, чтобы увидеть, отразится ли это на весе.',

  // calories.stability
  'calories.stability.evidence.variation':
    'Колебания по дням {percent}% (коэффициент вариации)',
  'calories.stability.evidence.logged': 'Записано дней: {count}',
  'calories.stability.title.steady': 'Потребление калорий стабильно',
  'calories.stability.summary.steady':
    'Ваше дневное потребление меняется всего на {percent}% — с этим легко работать.',
  'calories.stability.recSteady1.title': 'Считайте недельный итог главной цифрой',
  'calories.stability.recSteady1.detail':
    'Ежедневные колебания нормальны; важно среднее за неделю.',
  'calories.stability.title.erratic': 'Хаотичное потребление калорий',
  'calories.stability.summary.erratic':
    'Потребление колеблется на {percent}% — обычно это цикл «ограничение — переедание».',
  'calories.stability.recErratic1.title': 'Стремитесь к стабильности, а не к идеалу',
  'calories.stability.recErratic1.detail':
    'Держаться в пределах ~200 ккал от цели каждый день лучше, чем один идеальный день из пяти.',
  'calories.stability.recErratic2.title': 'Проверьте выходные',
  'calories.stability.recErratic2.detail':
    'Два дня с высоким потреблением в неделю — норма, пять — уже нет.',

  // calories.weight-alignment
  'calories.weight-alignment.evidence.trend': 'Наблюдаемый тренд веса: {trend} кг в неделю',
  'calories.weight-alignment.evidence.expected':
    'Потребление, которое это объясняло бы: {calories} ккал в день',
  'calories.weight-alignment.evidence.actual': 'Фактически записано: {calories} ккал в день',
  'calories.weight-alignment.evidence.gap': 'Разница: {gap} ккал в день',
  'calories.weight-alignment.title.disagree': 'Потребление и изменение веса не согласуются',
  'calories.weight-alignment.summary.disagree':
    'Записанные калории не объясняют тренд веса — разница {calories} ккал в день указывает на точность записей, а не на обмен веществ.',
  'calories.weight-alignment.recDisagree1.title': 'Неделю взвешивайте порции',
  'calories.weight-alignment.recDisagree1.detail':
    'Приложения для калорий не учитывают масло, соусы и напитки — обычно разница именно здесь.',
  'calories.weight-alignment.recDisagree2.title':
    'Сравнивайте тренд веса со средними калориями за неделю',
  'calories.weight-alignment.recDisagree2.detail':
    'Недельный итог надёжнее любого отдельного дня.',
  'calories.weight-alignment.title.consistent': 'Калории и вес согласованы',
  'calories.weight-alignment.summary.consistent':
    'Ваше записанное потребление соответствует изменению веса: разница в пределах {calories} ккал в день.',
  'calories.weight-alignment.recConsistent1.title': 'Доверяйте своим данным',
  'calories.weight-alignment.recConsistent1.detail':
    'Внутренняя согласованность делает рекомендации заслуживающими доверия.',
};

const INSIGHT_TEXT: Record<Locale, Record<InsightTextKey, string>> = { en, ru };

export function insightTranslator(locale: Locale): InsightTranslator {
  return (key, params) => interpolate(INSIGHT_TEXT[locale][key], params);
}

export const enInsightTranslator: InsightTranslator = insightTranslator('en');
