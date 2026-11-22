import { useI18n } from '../i18n/context.tsx';
import type { TranslationKey } from '../i18n/strings.ts';
import { daysBetween, isValidISODate } from '../lib/date.ts';
import { SAFE_PACE_KG_PER_WEEK } from '../lib/health.ts';
import type { GoalPlan, GoalPlanMetric } from '../lib/goalplan.ts';
import type { MetricKey } from '../types.ts';

export interface GoalPlanPanelProps {
  /** Anchor id used by the mobile section menu. */
  id?: string;
  /** Pace towards the deadline, or `null` when there is no usable date. */
  plan: GoalPlan | null;
  /** Stored date, so a past deadline can be explained rather than ignored. */
  goalDate?: string;
  /** `YYYY-MM-DD` used as "today". */
  referenceDate: string;
}

const METRIC_LABEL_KEYS: Record<MetricKey, TranslationKey> = {
  weight: 'metric.weight',
  steps: 'metric.steps',
  sleep: 'metric.sleep',
  activity: 'metric.activity',
  calories: 'metric.caloriesEaten',
};

/** Ratings read better with a decimal; counts and kcal do not. */
const METRIC_DIGITS: Record<MetricKey, number> = {
  weight: 1,
  steps: 0,
  sleep: 1,
  activity: 1,
  calories: 0,
};

function GoalPlanItem({ metric }: { metric: GoalPlanMetric }) {
  const { t, formatMetric, formatSigned } = useI18n();
  const digits = METRIC_DIGITS[metric.key];
  const observed =
    metric.observedPerWeek === null
      ? t('goalPlan.noObserved')
      : `${formatSigned(metric.observedPerWeek, digits)} ${metric.unit}${t('common.perWeek')}`;

  return (
    <li className="goal-plan__item">
      <div className="goal-plan__item-head">
        <strong>{t(METRIC_LABEL_KEYS[metric.key])}</strong>
        {metric.onTrack !== null ? (
          <span
            className={`goal-plan__badge ${
              metric.onTrack ? 'goal-plan__badge--good' : 'goal-plan__badge--late'
            }`}
          >
            {t(metric.onTrack ? 'goalPlan.onTrack' : 'goalPlan.behind')}
          </span>
        ) : null}
      </div>
      <p className="goal-plan__numbers">
        {t('goalPlan.fromTo', {
          latest: formatMetric(metric.latest, digits),
          goal: formatMetric(metric.goal, digits),
          unit: metric.unit,
        })}
      </p>
      <p className="goal-plan__pace">
        {t('goalPlan.needed', {
          value: formatSigned(metric.requiredPerWeek, digits),
          unit: metric.unit,
          perWeek: t('common.perWeek'),
        })}
      </p>
      <p className="goal-plan__observed">{t('goalPlan.observed', { value: observed })}</p>
      {metric.exceedsSafePace ? (
        <p className="goal-plan__warning">
          {t('goalPlan.fastPace', { value: formatMetric(SAFE_PACE_KG_PER_WEEK, 2) })}
        </p>
      ) : null}
    </li>
  );
}

export function GoalPlanPanel({ id, plan, goalDate, referenceDate }: GoalPlanPanelProps) {
  const { t, formatLongDate, formatNumber, plural } = useI18n();
  const pastDate =
    goalDate !== undefined &&
    isValidISODate(goalDate) &&
    (daysBetween(referenceDate, goalDate) ?? 1) <= 0;

  const daysLeft =
    plan === null
      ? ''
      : `${formatNumber(plan.daysLeft)} ${plural(plan.daysLeft, {
          one: 'noun.day.one',
          few: 'noun.day.few',
          many: 'noun.day.many',
        })}`;

  return (
    <section id={id} className="card goal-plan" aria-label={t('goalPlan.ariaLabel')}>
      <div className="goal-plan__header">
        <h3>{t('goalPlan.title')}</h3>
        <p className="goal-plan__subtitle">
          {plan !== null
            ? t('goalPlan.intro', { date: formatLongDate(plan.date), days: daysLeft })
            : t(pastDate ? 'goalPlan.pastDate' : 'goalPlan.emptyDate')}
        </p>
      </div>

      {plan !== null && plan.metrics.length === 0 ? (
        <p className="goal-plan__empty">{t('goalPlan.emptyGoals')}</p>
      ) : null}

      {plan !== null && plan.metrics.length > 0 ? (
        <ul className="goal-plan__list">
          {plan.metrics.map((metric) => (
            <GoalPlanItem key={metric.key} metric={metric} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
