import { useMemo, useState } from 'react';
import { formatLongDate, formatShortDate } from '../lib/date.ts';
import { formatMetric } from '../lib/stats.ts';
import type { DailyEntry, MetricKey } from '../types.ts';
import { METRIC_KEYS, METRIC_UNITS } from '../types.ts';

export interface HistoryTableProps {
  entries: DailyEntry[];
  onDelete: (date: string) => void;
}

const DIGITS: Record<MetricKey, number> = { weight: 1, steps: 0, sleep: 1, calories: 0 };

const EMPTY_MESSAGE: Record<MetricKey, string> = {
  weight: '—',
  steps: '—',
  sleep: '—',
  calories: '—',
};

function cell(entry: DailyEntry, key: MetricKey): string {
  const field = key === 'weight' ? 'weightKg' : key;
  const value = (entry as unknown as Record<string, unknown>)[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) return EMPTY_MESSAGE[key];
  return formatMetric(value, DIGITS[key]);
}

export function HistoryTable({ entries, onDelete }: HistoryTableProps) {
  const [query, setQuery] = useState('');

  const sorted = useMemo(() => [...entries].reverse(), [entries]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter(
      (entry) => entry.note?.toLowerCase().includes(needle) || entry.date.includes(needle),
    );
  }, [sorted, query]);

  return (
    <section className="card history" aria-label="Logged entries">
      <header className="history__header">
        <h3>
          Entries
          <span className="history__count">{entries.length}</span>
        </h3>
        <label className="history__search">
          <span className="sr-only">Filter entries</span>
          <input
            type="search"
            placeholder="Filter by date or note"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </header>

      {filtered.length === 0 ? (
        <p className="history__empty">
          {entries.length === 0
            ? 'No entries yet. Add your first day using the form.'
            : 'Nothing matches that filter.'}
        </p>
      ) : (
        <div className="history__scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Date</th>
                {METRIC_KEYS.map((key) => (
                  <th scope="col" key={key}>
                    {key} <span className="history__unit">({METRIC_UNITS[key]})</span>
                  </th>
                ))}
                <th scope="col">Note</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
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
                    <td key={key} className={cell(entry, key) === '—' ? 'is-empty' : undefined}>
                      {cell(entry, key)}
                    </td>
                  ))}
                  <td className="history__note">{entry.note ?? ''}</td>
                  <td>
                    <button
                      type="button"
                      className="button button--danger"
                      onClick={() => onDelete(entry.date)}
                      aria-label={`Delete entry for ${formatLongDate(entry.date)}`}
                    >
                      Delete
                    </button>
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