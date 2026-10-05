import type { Insight, Severity } from '../types.ts';

export interface InsightsPanelProps {
  insights: Insight[];
  /** Show only problems by default. */
  showPositive?: boolean;
}

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  warning: 'Warning',
  info: 'Note',
  positive: 'Good',
};

const SEVERITY_ICON: Record<Severity, string> = {
  critical: '!!',
  warning: '!',
  info: 'i',
  positive: '+',
};

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <article className={`insight insight--${insight.severity}`}>
      <header className="insight__header">
        <span className={`insight__badge insight__badge--${insight.severity}`}>
          <span aria-hidden="true">{SEVERITY_ICON[insight.severity]}</span>
          {SEVERITY_LABEL[insight.severity]}
        </span>
        <h4>{insight.title}</h4>
      </header>

      <p className="insight__summary">{insight.summary}</p>

      {insight.evidence.length > 0 ? (
        <>
          <h5 className="insight__section-title">What the data shows</h5>
          <ul className="insight__evidence">
            {insight.evidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      ) : null}

      {insight.recommendations.length > 0 ? (
        <>
          <h5 className="insight__section-title">Recommendations</h5>
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
  const problems = insights.filter((insight) => insight.severity !== 'positive');
  const positives = insights.filter((insight) => insight.severity === 'positive');
  const visible = showPositive ? insights : problems;

  if (insights.length === 0) {
    return (
      <section className="card insights" aria-label="Insights">
        <h3>Insights</h3>
        <p className="insights__empty">
          Nothing to report yet. Log a few days of measurements and the analysis will appear here.
        </p>
      </section>
    );
  }

  return (
    <section className="insights" aria-label="Insights">
      <div className="insights__group">
        <h3>
          Problems &amp; notes
          {problems.length > 0 ? <span className="insights__count">{problems.length}</span> : null}
        </h3>
        {visible.length === 0 ? (
          <p className="card insights__empty">
            No problems detected in this window. That is a good sign.
          </p>
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
            Working well
            <span className="insights__count insights__count--positive">{positives.length}</span>
          </h3>
          <div className="insights__grid">
            {positives.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      ) : null}

      <p className="insights__disclaimer">
        This is a self-tracking tool, not medical advice. Estimates use standard population formulas
        and are only as good as the data you enter. Talk to a clinician before making significant
        changes to your diet, activity or medication.
      </p>
    </section>
  );
}