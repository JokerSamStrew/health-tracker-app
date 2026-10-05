import { METRIC_LABELS } from '../lib/insights.ts';
import { formatMetric, formatNumber, formatSigned } from '../lib/stats.ts';
import type { HealthReport, MetricKey } from '../types.ts';
import { METRIC_KEYS, METRIC_UNITS } from '../types.ts';

export interface SummaryCardsProps {
  report: HealthReport;
}

const DIGITS: Record<MetricKey, number> = { weight: 1, steps: 0, sleep: 1, calories: 0 };

/** Values where "down" is the desirable direction. */
const LOWER_IS_BETTER: Partial<Record<MetricKey, boolean>> = { weight: true, calories: true };

function scoreTone(score: number | null): string {
  if (score === null) return 'neutral';
  if (score >= 80) return 'good';
  if (score >= 55) return 'warn';
  return 'bad';
}

function scoreLabel(score: number | null): string {
  if (score === null) return 'Not enough data';
  if (score >= 80) return 'Looking good';
  if (score >= 55) return 'Needs attention';
  return 'Action needed';
}

export function SummaryCards({ report }: SummaryCardsProps) {
  const { summaries, score, counts } = report;

  return (
    <section className="summary" aria-label="Summary">
      <article className="card summary__score">
        <p className="summary__label">Health score</p>
        <p className={`summary__score-value summary__score-value--${scoreTone(score)}`}>
          {score === null ? '—' : score}
          <span className="summary__score-max">/100</span>
        </p>
        <p className="summary__hint">{scoreLabel(score)}</p>
        <ul className="summary__counts">
          <li className="badge badge--critical">{counts.critical} critical</li>
          <li className="badge badge--warning">{counts.warning} warning</li>
          <li className="badge badge--positive">{counts.positive} positive</li>
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
              {METRIC_LABELS[key]}
              <span className="summary__unit">{METRIC_UNITS[key]}</span>
            </p>
            <p className="summary__metric-value">
              {formatMetric(summary.latest, digits)}
            </p>
            <p className={`summary__metric-change summary__metric-change--${changeTone}`}>
              {change === null ? 'No change yet' : `${formatSigned(change, digits)} in window`}
            </p>
            <dl className="summary__metric-details">
              <div>
                <dt>Avg</dt>
                <dd>{formatMetric(summary.average, digits)}</dd>
              </div>
              <div>
                <dt>Range</dt>
                <dd>
                  {summary.min === null || summary.max === null
                    ? '—'
                    : `${formatNumber(summary.min, digits)}–${formatNumber(summary.max, digits)}`}
                </dd>
              </div>
              <div>
                <dt>Trend</dt>
                <dd>
                  {summary.trendPerWeek === null
                    ? '—'
                    : `${formatSigned(summary.trendPerWeek, 2)}/wk`}
                </dd>
              </div>
            </dl>
          </article>
        );
      })}
    </section>
  );
}