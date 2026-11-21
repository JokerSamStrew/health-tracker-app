import { useI18n } from '../i18n/context.tsx';
import type { TranslationKey } from '../i18n/strings.ts';
import type { Insight, Severity } from '../types.ts';

export interface InsightsPanelProps {
  insights: Insight[];
  /** Show only problems by default. */
  showPositive?: boolean;
}

const SEVERITY_LABEL: Record<Severity, TranslationKey> = {
  critical: 'insight.severity.critical',
  warning: 'insight.severity.warning',
  info: 'insight.severity.info',
  positive: 'insight.severity.positive',
};

const SEVERITY_ICON: Record<Severity, string> = {
  critical: '!!',
  warning: '!',
  info: 'i',
  positive: '+',
};

function InsightCard({ insight }: { insight: Insight }) {
  const { t } = useI18n();
  return (
    <article className={`insight insight--${insight.severity}`}>
      <header className="insight__header">
        <span className={`insight__badge insight__badge--${insight.severity}`}>
          <span aria-hidden="true">{SEVERITY_ICON[insight.severity]}</span>
          {t(SEVERITY_LABEL[insight.severity])}
        </span>
        <h4>{insight.title}</h4>
      </header>

      <p className="insight__summary">{insight.summary}</p>

      {insight.evidence.length > 0 ? (
        <>
          <h5 className="insight__section-title">{t('insight.whatDataShows')}</h5>
          <ul className="insight__evidence">
            {insight.evidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      ) : null}

      {insight.recommendations.length > 0 ? (
        <>
          <h5 className="insight__section-title">{t('insight.recommendations')}</h5>
          <ul className="insight__recommendations">
            {insight.recommendations.map((rec) => (
              <li key={rec.title}>
                <strong>{rec.title}</strong>
                <span>{rec.detail}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </article>
  );
}

export function InsightsPanel({ insights, showPositive = false }: InsightsPanelProps) {
  const { t } = useI18n();
  const problems = insights.filter((insight) => insight.severity !== 'positive');
  const positives = insights.filter((insight) => insight.severity === 'positive');
  const visible = showPositive ? insights : problems;

  if (insights.length === 0) {
    return (
      <section className="card insights" aria-label={t('insight.ariaLabel')}>
        <h3>{t('insight.title')}</h3>
        <p className="insights__empty">{t('insight.empty')}</p>
      </section>
    );
  }

  return (
    <section className="insights" aria-label={t('insight.ariaLabel')}>
      <div className="insights__group">
        <h3>
          {t('insight.problems')}
          {problems.length > 0 ? <span className="insights__count">{problems.length}</span> : null}
        </h3>
        {visible.length === 0 ? (
          <p className="card insights__empty">{t('insight.noProblems')}</p>
        ) : (
          <div className="insights__grid">
            {visible.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        )}
      </div>

      {positives.length > 0 ? (
        <div className="insights__group">
          <h3>
            {t('insight.workingWell')}
            <span className="insights__count insights__count--positive">{positives.length}</span>
          </h3>
          <div className="insights__grid">
            {positives.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      ) : null}

      <p className="insights__disclaimer">{t('insight.disclaimer')}</p>
    </section>
  );
}
