import { memo, useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatShortDate } from '../lib/date.ts';
import type { MoodTagCount } from '../lib/moods.ts';
import type { ThemeMode } from '../types.ts';

export interface MoodChartProps {
  /** Tag counts for the window, as returned by `countMoods`. */
  counts: MoodTagCount[];
  /** First day of the analysed window; shown in the subtitle. */
  windowStart: string;
  /** Last day of the analysed window; shown in the subtitle. */
  windowEnd: string;
  height?: number;
  /** Visual theme; defaults to 'light'. */
  theme?: ThemeMode;
}

/** Categorical palette, long enough for the full mood catalog. */
const TAG_COLORS: Record<ThemeMode, string[]> = {
  light: [
    '#0f766e', '#2563eb', '#7c3aed', '#ea580c', '#c026d3',
    '#0891b2', '#65a30d', '#d97706', '#e11d48', '#4f46e5',
    '#0d9488', '#9333ea', '#b45309', '#059669', '#db2777',
    '#1d4ed8', '#a21caf', '#15803d', '#dc2626', '#475569',
  ],
  dark: [
    '#2dd4bf', '#60a5fa', '#a78bfa', '#fb923c', '#e879f9',
    '#22d3ee', '#a3e635', '#fbbf24', '#fb7185', '#818cf8',
    '#5eead4', '#c084fc', '#f59e0b', '#4ade80', '#f472b6',
    '#93c5fd', '#f0abfc', '#86efac', '#fca5a5', '#94a3b8',
  ],
};

const PERCENT_DIGITS = 0;

interface TooltipEntry {
  payload?: { tag: string; count: number; share: number };
}

function MoodTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
}) {
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__date">{item.tag}</p>
      <ul>
        <li>
          <span>Logged days</span>
          <strong>{item.count}</strong>
        </li>
        <li>
          <span>Share</span>
          <strong>{item.share.toFixed(PERCENT_DIGITS)}%</strong>
        </li>
      </ul>
    </div>
  );
}

function MoodChartBase({
  counts,
  windowStart,
  windowEnd,
  height = 240,
  theme = 'light',
}: MoodChartProps) {
  const palette = TAG_COLORS[theme];

  const slices = useMemo(() => {
    const total = counts.reduce((acc, item) => acc + item.count, 0);
    return counts.map((item, index) => ({
      tag: item.tag,
      count: item.count,
      share: total > 0 ? (item.count / total) * 100 : 0,
      color: palette[index % palette.length]!,
    }));
  }, [counts, palette]);

  const taggedDays = slices.reduce((acc, slice) => acc + slice.count, 0);

  return (
    <section className="card chart-card mood-card" aria-labelledby="mood-chart">
      <header className="chart-card__header">
        <div>
          <h3 id="mood-chart">Mood tags</h3>
          <p className="chart-card__subtitle">
            {slices.length > 0
              ? `${slices.length} ${slices.length === 1 ? 'tag' : 'tags'} across ${taggedDays} tagged ${
                  taggedDays === 1 ? 'day' : 'days'
                } · ${formatShortDate(windowStart)} – ${formatShortDate(windowEnd)}`
              : 'No mood tags in this window'}
          </p>
        </div>
      </header>

      {slices.length > 0 ? (
        <div className="mood-card__body">
          <div
            className="mood-card__pie"
            style={{ height }}
            role="img"
            aria-label={`Mood tag distribution across ${taggedDays} tagged days`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="count"
                  nameKey="tag"
                  cx="50%"
                  cy="50%"
                  innerRadius="45%"
                  outerRadius="80%"
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {slices.map((slice) => (
                    <Cell key={slice.tag} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip content={<MoodTooltip />} isAnimationActive={false} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="mood-card__legend">
            {slices.map((slice) => (
              <li className="mood-card__legend-item" key={slice.tag}>
                <span
                  className="mood-card__swatch"
                  style={{ background: slice.color }}
                  aria-hidden="true"
                />
                <span className="mood-card__legend-tag">{slice.tag}</span>
                <span className="mood-card__legend-value">
                  {slice.count} ({slice.share.toFixed(PERCENT_DIGITS)}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="chart-card__empty">
          Tag your days with moods to see how they are distributed across this window.
        </p>
      )}
    </section>
  );
}

export const MoodChart = memo(MoodChartBase);
