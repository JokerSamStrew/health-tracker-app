import { memo, useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useI18n } from '../i18n/context.tsx';
import type { MoodTagCount } from '../lib/moods.ts';
import type { ThemeMode } from '../types.ts';

export interface MoodChartProps {
  /** Anchor id used by the mobile section menu. */
  id?: string;
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
  const { t, formatNumber, moodLabel } = useI18n();
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__date">{moodLabel(item.tag)}</p>
      <ul>
        <li>
          <span>{t('chart.loggedDays')}</span>
          <strong>{item.count}</strong>
        </li>
        <li>
          <span>{t('chart.share')}</span>
          <strong>{formatNumber(item.share, PERCENT_DIGITS)}%</strong>
        </li>
      </ul>
    </div>
  );
}

function MoodChartBase({
  id,
  counts,
  windowStart,
  windowEnd,
  height = 240,
  theme = 'light',
}: MoodChartProps) {
  const { t, plural, formatNumber, formatShortDate, moodLabel } = useI18n();
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
    <section id={id} className="card chart-card mood-card" aria-labelledby="mood-chart">
      <header className="chart-card__header">
        <div>
          <h3 id="mood-chart">{t('chart.moodTags')}</h3>
          <p className="chart-card__subtitle">
            {slices.length > 0
              ? t('chart.moodSubtitle', {
                  count: slices.length,
                  noun: plural(slices.length, {
                    one: 'noun.tag.one',
                    few: 'noun.tag.few',
                    many: 'noun.tag.many',
                  }),
                  days: taggedDays,
                  dayNoun: plural(taggedDays, {
                    one: 'noun.day.one',
                    few: 'noun.day.few',
                    many: 'noun.day.many',
                  }),
                  start: formatShortDate(windowStart),
                  end: formatShortDate(windowEnd),
                })
              : t('chart.noMoodTags')}
          </p>
        </div>
      </header>

      {slices.length > 0 ? (
        <div className="mood-card__body">
          <div
            className="mood-card__pie"
            style={{ height }}
            role="img"
            aria-label={t('chart.moodDistribution', { days: taggedDays })}
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
                <span className="mood-card__legend-tag">{moodLabel(slice.tag)}</span>
                <span className="mood-card__legend-value">
                  {slice.count} ({formatNumber(slice.share, PERCENT_DIGITS)}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="chart-card__empty">{t('chart.tagYourDays')}</p>
      )}
    </section>
  );
}

export const MoodChart = memo(MoodChartBase);
