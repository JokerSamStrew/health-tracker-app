import { useMemo, useState } from 'react';
import { useI18n, type I18n } from '../i18n/context.tsx';
import type { TranslationKey } from '../i18n/strings.ts';
import { METRIC_FIELD } from '../lib/series.ts';
import type { DailyEntry, MetricKey } from '../types.ts';
import { METRIC_KEYS, METRIC_UNITS } from '../types.ts';

export interface HistoryTableProps {
  /** Anchor id used by the mobile section menu. */
  id?: string;
  entries: DailyEntry[];
  onEdit: (entry: DailyEntry) => void;
  onDelete: (date: string) => void;
}

const DIGITS: Record<MetricKey, number> = {
  weight: 1,
  steps: 0,
  sleep: 1,
  activity: 1,
  calories: 0,
};

const METRIC_LABEL_KEYS: Record<MetricKey, TranslationKey> = {
  weight: 'metricShort.weight',
  steps: 'metricShort.steps',
  sleep: 'metricShort.sleep',
  activity: 'metricShort.activity',
  calories: 'metricShort.calories',
};

const EMPTY_MESSAGE: Record<MetricKey, string> = {
  weight: '—',
  steps: '—',
  sleep: '—',
  activity: '—',
  calories: '—',
};

function cell(
  entry: DailyEntry,
  key: MetricKey,
  formatMetric: I18n['formatMetric'],
): string {
  const field = METRIC_FIELD[key];
  const value = (entry as unknown as Record<string, unknown>)[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) return EMPTY_MESSAGE[key];
  return formatMetric(value, DIGITS[key]);
}

export function HistoryTable({ id, entries, onEdit, onDelete }: HistoryTableProps) {
  const { t, formatMetric, formatLongDate, formatShortDate, moodLabel } = useI18n();
  const [query, setQuery] = useState('');

  const sorted = useMemo(() => [...entries].reverse(), [entries]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter(
      (entry) =>
        entry.date.includes(needle) ||
        (entry.moods ?? []).some((tag) => tag.toLowerCase().includes(needle)),
    );
  }, [sorted, query]);

  return (
    <section id={id} className="card history" aria-label={t('history.ariaLabel')}>
      <header className="history__header">
        <h3>
          {t('history.title')}
          <span className="history__count">{entries.length}</span>
        </h3>
        <label className="history__search">
          <span className="sr-only">{t('history.filterAria')}</span>
          <input
            type="search"
            placeholder={t('history.filterPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </header>

      {filtered.length === 0 ? (
        <p className="history__empty">
          {entries.length === 0 ? t('history.empty') : t('history.noMatches')}
        </p>
      ) : (
        <div className="history__scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('common.date')}</th>
                {METRIC_KEYS.map((key) => (
                  <th scope="col" key={key}>
                    {t(METRIC_LABEL_KEYS[key])}{' '}
                    <span className="history__unit">({METRIC_UNITS[key]})</span>
                  </th>
                ))}
                <th scope="col">{t('history.moods')}</th>
                <th scope="col">
                  <span className="sr-only">{t('common.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.date}>
                  <th scope="row" title={formatLongDate(entry.date)}>
                    {formatShortDate(entry.date)}
                  </th>
                  {METRIC_KEYS.map((key) => (
                    <td
                      key={key}
                      className={cell(entry, key, formatMetric) === '—' ? 'is-empty' : undefined}
                    >
                      {cell(entry, key, formatMetric)}
                    </td>
                  ))}
                  <td className="history__moods">
                    {(entry.moods ?? []).map((tag) => (
                      <span className="history__mood" key={tag}>
                        {moodLabel(tag)}
                      </span>
                    ))}
                  </td>
                  <td>
                    <div className="history__actions">
                      <button
                        type="button"
                        className="button button--ghost"
                        onClick={() => onEdit(entry)}
                        aria-label={t('history.editAria', { date: formatLongDate(entry.date) })}
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        type="button"
                        className="button button--danger"
                        onClick={() => onDelete(entry.date)}
                        aria-label={t('history.deleteAria', { date: formatLongDate(entry.date) })}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
