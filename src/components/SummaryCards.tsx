import { useI18n, type I18n } from '../i18n/context.tsx';
import type { TranslationKey } from '../i18n/strings.ts';
import type { HealthReport, MetricKey } from '../types.ts';
import { METRIC_KEYS, METRIC_UNITS } from '../types.ts';

export interface SummaryCardsProps {
  /** Anchor id used by the mobile section menu. */
  id?: string;
  report: HealthReport;
}

const DIGITS: Record<MetricKey, number> = {
  weight: 1,
  steps: 0,
  sleep: 1,
  activity: 1,
  calories: 0,
};

const METRIC_LABEL_KEYS: Record<MetricKey, TranslationKey> = {
  weight: 'metric.weight',
  steps: 'metric.steps',
  sleep: 'metric.sleep',
  activity: 'metric.activity',
  calories: 'metric.calories',
};

/** Values where "down" is the desirable direction. */
const LOWER_IS_BETTER: Partial<Record<MetricKey, boolean>> = { weight: true, calories: true };

function scoreTone(score: number | null): string {
  if (score === null) return 'neutral';
  if (score >= 80) return 'good';
  if (score >= 55) return 'warn';
  return 'bad';
}

function scoreLabel(score: number | null, t: I18n['t']): string {
  if (score === null) return t('summary.notEnoughData');
  if (score >= 80) return t('summary.lookingGood');
  if (score >= 55) return t('summary.needsAttention');
  return t('summary.actionNeeded');
}

export function SummaryCards({ id, report }: SummaryCardsProps) {
  const { t, formatMetric, formatNumber, formatSigned } = useI18n();
  const { summaries, score, counts } = report;

  return (
    <section id={id} className="summary" aria-label={t('summary.ariaLabel')}>
      <article className="card summary__score">
        <p className="summary__label">{t('summary.healthScore')}</p>
        <p className={`summary__score-value summary__score-value--${scoreTone(score)}`}>
          {score === null ? '—' : score}
          <span className="summary__score-max">/100</span>
        </p>
        <p className="summary__hint">{scoreLabel(score, t)}</p>
        <ul className="summary__counts">
          <li className="badge badge--critical">
            {t('summary.critical', { count: counts.critical })}
          </li>
          <li className="badge badge--warning">
            {t('summary.warning', { count: counts.warning })}
          </li>
          <li className="badge badge--positive">
            {t('summary.positive', { count: counts.positive })}
          </li>
        </ul>
      </article>

      {METRIC_KEYS.map((key) => {
        const summary = summaries[key];
        const digits = DIGITS[key];
        const lowerIsBetter = LOWER_IS_BETTER[key] === true;
        const change = summary.change;

        let changeTone = 'neutral';
        if (change !== null && Math.abs(change) > 0.001) {
          const worsening = lowerIsBetter ? change > 0 : change < 0;
          changeTone = worsening ? 'bad' : 'good';
        }

        return (
          <article className="card summary__metric" key={key}>
            <p className="summary__label">
              {t(METRIC_LABEL_KEYS[key])}
              <span className="summary__unit">{METRIC_UNITS[key]}</span>
            </p>
            <p className="summary__metric-value">
              {formatMetric(summary.latest, digits)}
            </p>
            <p className={`summary__metric-change summary__metric-change--${changeTone}`}>
              {change === null
                ? t('summary.noChangeYet')
                : t('summary.inWindow', { value: formatSigned(change, digits) })}
            </p>
            <dl className="summary__metric-details">
              <div>
                <dt>{t('summary.avg')}</dt>
                <dd>{formatMetric(summary.average, digits)}</dd>
              </div>
              <div>
                <dt>{t('summary.range')}</dt>
                <dd>
                  {summary.min === null || summary.max === null
                    ? '—'
                    : `${formatNumber(summary.min, digits)}–${formatNumber(summary.max, digits)}`}
                </dd>
              </div>
              <div>
                <dt>{t('summary.trend')}</dt>
                <dd>
                  {summary.trendPerWeek === null
                    ? '—'
                    : `${formatSigned(summary.trendPerWeek, 2)}${t('common.perWeek')}`}
                </dd>
              </div>
            </dl>
          </article>
        );
      })}
    </section>
  );
}
