import { memo, useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatLongDate, formatShortDate } from '../lib/date.ts';
import type { ScoreTimeline, ScoreTimelinePoint } from '../lib/insights.ts';
import { formatMetric, formatSigned } from '../lib/stats.ts';
import type { ThemeMode } from '../types.ts';

export interface HealthScoreChartProps {
  /** Rolling scores, as returned by `scoreTimeline`. */
  timeline: ScoreTimeline;
  height?: number;
  /** Visual theme; defaults to 'light'. */
  theme?: ThemeMode;
}

/** The score line colour, tuned to contrast with each surface. */
const SCORE_COLORS: Record<ThemeMode, string> = {
  light: '#059669',
  dark: '#34d399',
};

/** Matches the axis tokens the metric charts use, so the rows line up. */
const AXIS_TOKENS: Record<ThemeMode, { grid: string; axis: string; tick: string }> = {
  light: { grid: '#e2e8f0', axis: '#cbd5e1', tick: '#64748b' },
  dark: { grid: '#243049', axis: '#334155', tick: '#94a3b8' },
};

/** Trend direction colouring; for a score, up is good and down is not. */
function scoreTrendClass(trendPerWeek: number | null): string {
  if (trendPerWeek === null) return 'trend-flat';
  if (trendPerWeek > 1) return 'score-trend-up';
  if (trendPerWeek < -1) return 'score-trend-down';
  return 'trend-flat';
}

interface ChartRow extends ScoreTimelinePoint {
  /** Short label for the x-axis tick. */
  label: string;
}

interface TooltipEntry {
  payload?: ChartRow;
}

function ScoreTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__date">{formatLongDate(row.date)}</p>
      <ul>
        <li>
          <span>Health score</span>
          <strong>{row.score === null ? '—' : `${row.score}/100`}</strong>
        </li>
      </ul>
    </div>
  );
}

function HealthScoreChartBase({
  timeline,
  height = 260,
  theme = 'light',
}: HealthScoreChartProps) {
  const tokens = AXIS_TOKENS[theme];
  const color = SCORE_COLORS[theme];

  const rows: ChartRow[] = useMemo(
    () => timeline.points.map((point) => ({ ...point, label: formatShortDate(point.date) })),
    [timeline.points],
  );
  const scoredDays = timeline.points.filter((point) => point.score !== null).length;

  return (
    <section className="card chart-card" aria-labelledby="health-score-chart">
      <header className="chart-card__header">
        <div>
          <h3 id="health-score-chart">Health score</h3>
          <p className="chart-card__subtitle">
            {scoredDays > 0
              ? `${scoredDays} of ${timeline.points.length} days scored · trailing ${
                  timeline.windowDays
                }-day window`
              : 'No data yet'}
          </p>
        </div>
        <dl className="chart-card__stats">
          <div>
            <dt>Current</dt>
            <dd>{formatMetric(timeline.current, 0)}</dd>
          </div>
          <div>
            <dt>Average</dt>
            <dd>{formatMetric(timeline.average, 0)}</dd>
          </div>
          <div>
            <dt>Trend/wk</dt>
            <dd className={scoreTrendClass(timeline.trendPerWeek)}>
              {formatSigned(timeline.trendPerWeek, 1)}
            </dd>
          </div>
        </dl>
      </header>

      {scoredDays > 0 ? (
        <div style={{ height }} className="chart-card__canvas">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: tokens.tick }}
                minTickGap={24}
                stroke={tokens.axis}
              />
              {/* The score is 0-100 by definition, so the axis is fixed and
                  comparable across windows instead of zoomed to the data. */}
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12, fill: tokens.tick }}
                stroke={tokens.axis}
                width={56}
                tickFormatter={(value: number) => formatMetric(value, 0)}
              />
              <Tooltip content={<ScoreTooltip />} isAnimationActive={false} />
              <Line
                type="monotone"
                dataKey="score"
                name="score"
                stroke={color}
                strokeWidth={2}
                dot={{ r: 2, fill: color, strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="chart-card__empty">
          Not enough days logged in this window to score it yet. Log a few more days and the
          timeline appears here.
        </p>
      )}
    </section>
  );
}

export const HealthScoreChart = memo(HealthScoreChartBase);
