import { memo, useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_KEYS, isEmptySeries, metricValues, paddedDomain, type ChartPoint } from '../lib/charts.ts';
import { formatLongDate } from '../lib/date.ts';
import { formatMetric, formatNumber } from '../lib/stats.ts';
import type { MetricKey, MetricSummary } from '../types.ts';
import { METRIC_UNITS } from '../types.ts';

export interface TimeSeriesChartProps {
  title: string;
  metric: MetricKey;
  data: ChartPoint[];
  summary: MetricSummary;
  /** Goal line, e.g. 8000 steps or a target weight. */
  goal?: number;
  goalLabel?: string;
  height?: number;
  color?: string;
}

const DEFAULT_COLORS: Record<MetricKey, string> = {
  weight: '#0f766e',
  steps: '#2563eb',
  sleep: '#7c3aed',
  calories: '#ea580c',
};

interface TooltipEntry {
  value?: number | string | null;
  dataKey?: string | number;
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
  digits,
  goal,
  goalLabel,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  unit: string;
  digits: number;
  goal?: number;
  goalLabel?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__date">{label ? formatLongDate(label) : ''}</p>
      <ul>
        {payload.map((entry) => (
          <li key={String(entry.dataKey)}>
            <span>{entry.dataKey === 'average' ? '7-day average' : 'Value'}</span>
            <strong>
              {formatMetric(typeof entry.value === 'number' ? entry.value : null, digits)} {unit}
            </strong>
          </li>
        ))}
        {goal !== undefined && goalLabel ? (
          <li className="chart-tooltip__goal">
            <span>{goalLabel}</span>
            <strong>
              {formatNumber(goal, digits)} {unit}
            </strong>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function TimeSeriesChartBase({
  title,
  metric,
  data,
  summary,
  goal,
  goalLabel,
  height = 260,
  color = DEFAULT_COLORS[metric],
}: TimeSeriesChartProps) {
  const unit = METRIC_UNITS[metric];
  const { value: valueKey, average: averageKey } = CHART_KEYS[metric];

  const values = useMemo(() => metricValues(data, metric), [data, metric]);
  // The goal is passed as an anchor so its reference line stays on the chart.
  const domain = useMemo(() => paddedDomain(values, 0.15, [goal]), [values, goal]);
  const hasData = !isEmptySeries(values);
  const digits = metric === 'steps' || metric === 'calories' ? 0 : 1;

  return (
    <section className="card chart-card" aria-labelledby={`chart-${metric}`}>
      <header className="chart-card__header">
        <div>
          <h3 id={`chart-${metric}`}>{title}</h3>
          <p className="chart-card__subtitle">
            {hasData
              ? `${summary.count} ${summary.count === 1 ? 'entry' : 'entries'} in window`
              : 'No data yet'}
          </p>
        </div>
        <dl className="chart-card__stats">
          <div>
            <dt>Latest</dt>
            <dd>{formatMetric(summary.latest, digits)}</dd>
          </div>
          <div>
            <dt>Average</dt>
            <dd>{formatMetric(summary.average, digits)}</dd>
          </div>
          <div>
            <dt>Trend/wk</dt>
            <dd className={trendClass(summary.trendPerWeek, metric)}>
              {summary.trendPerWeek === null
                ? '—'
                : `${summary.trendPerWeek > 0 ? '+' : ''}${formatMetric(summary.trendPerWeek, 2)}`}
            </dd>
          </div>
        </dl>
      </header>

      {hasData ? (
        <div style={{ height }} className="chart-card__canvas">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: '#64748b' }}
                minTickGap={24}
                stroke="#cbd5e1"
              />
              <YAxis
                domain={domain}
                tick={{ fontSize: 12, fill: '#64748b' }}
                stroke="#cbd5e1"
                width={56}
                tickFormatter={(value: number) => formatNumber(value, digits)}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    unit={unit}
                    digits={digits}
                    goal={goal}
                    goalLabel={goalLabel}
                  />
                }
                isAnimationActive={false}
              />
              {goal !== undefined ? (
                <ReferenceLine
                  y={goal}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  label={{ value: goalLabel, position: 'insideTopRight', fontSize: 11, fill: '#64748b' }}
                />
              ) : null}
              <Line
                type="monotone"
                dataKey={averageKey}
                name="average"
                stroke={color}
                strokeWidth={2.5}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey={valueKey}
                name="value"
                stroke={color}
                strokeWidth={1.5}
                strokeOpacity={0.45}
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
          Log {metric} for at least one day in this window to see the timeline.
        </p>
      )}
    </section>
  );
}

function trendClass(trend: number | null, metric: MetricKey): string {
  if (trend === null || metric !== 'weight') return '';
  if (trend > 0.05) return 'trend-up';
  if (trend < -0.05) return 'trend-down';
  return 'trend-flat';
}

export const TimeSeriesChart = memo(TimeSeriesChartBase);