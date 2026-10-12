import { useMemo, useState, type FormEvent } from 'react';
import {
  addDays,
  dateRange,
  daysBetween,
  formatShortDate,
  fromISODate,
  toISODate,
} from '../lib/date.ts';
import {
  MAX_MOOD_TAGS,
  MOOD_TAG_GROUPS,
  normalizeMoods,
} from '../lib/moods.ts';
import { METRIC_RANGES } from '../types.ts';
import type { DailyEntry, MetricKey } from '../types.ts';

export interface EntryFormProps {
  /** Defaults to today. */
  defaultDate?: string;
  /** When set, the form edits this entry instead of logging a new one. */
  editingEntry?: DailyEntry | null;
  onSave: (entry: DailyEntry) => void;
  /** Request to leave edit mode without saving. Ignored when not editing. */
  onCancelEdit?: () => void;
}

export type EntryPeriod = 'day' | 'range';

/** Safety cap so one save cannot grow past a year of entries. */
const MAX_RANGE_DAYS = 366;

interface FormState {
  period: EntryPeriod;
  /** `YYYY-MM-DD`, used when `period` is 'day'. */
  date: string;
  /** `YYYY-MM-DD`, used when `period` is 'range'. */
  start: string;
  /** `YYYY-MM-DD`, used when `period` is 'range'. */
  end: string;
  weightKg: string;
  steps: string;
  sleepQuality: string;
  calories: string;
  /** Selected mood tags, in the order they were toggled on. */
  moods: string[];
}

type FieldName = 'weightKg' | 'steps' | 'sleepQuality' | 'calories';

const METRIC_FIELDS: FieldName[] = ['weightKg', 'steps', 'sleepQuality', 'calories'];

/** Form field -> metric key, needed because `weightKg` maps to `weight`. */
const METRIC_FOR_FIELD: Record<FieldName, MetricKey> = {
  weightKg: 'weight',
  steps: 'steps',
  sleepQuality: 'sleep',
  calories: 'calories',
};

/** Selectable sleep-quality ratings, 1-5 with half-steps. */
export const SLEEP_QUALITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '1', label: '1 - Poor' },
  { value: '1.5', label: '1.5 - Poor to Fair' },
  { value: '2', label: '2 - Fair' },
  { value: '2.5', label: '2.5 - Fair to Good' },
  { value: '3', label: '3 - Good' },
  { value: '3.5', label: '3.5 - Good to Great' },
  { value: '4', label: '4 - Great' },
  { value: '4.5', label: '4.5 - Great to Excellent' },
  { value: '5', label: '5 - Excellent' },
];

function emptyForm(today: string): FormState {
  return {
    period: 'day',
    date: today,
    start: today,
    end: today,
    weightKg: '',
    steps: '',
    sleepQuality: '',
    calories: '',
    moods: [],
  };
}

/** Pre-fills the form with an existing entry so it can be edited. */
function formFromEntry(entry: DailyEntry): FormState {
  return {
    period: 'day',
    date: entry.date,
    start: entry.date,
    end: entry.date,
    weightKg: entry.weightKg !== undefined ? String(entry.weightKg) : '',
    steps: entry.steps !== undefined ? String(entry.steps) : '',
    sleepQuality: entry.sleepQuality !== undefined ? String(entry.sleepQuality) : '',
    calories: entry.calories !== undefined ? String(entry.calories) : '',
    moods: entry.moods ? [...entry.moods] : [],
  };
}

/** Keeps the chosen period and its pickers, clears the measurement values. */
function clearMeasurements(current: FormState): FormState {
  return {
    period: current.period,
    date: current.date,
    start: current.start,
    end: current.end,
    weightKg: '',
    steps: '',
    sleepQuality: '',
    calories: '',
    moods: [],
  };
}

function parseNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  // Accept both `80.5` and `80,5`.
  const normalized = trimmed.replace(',', '.');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function validate(form: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};

  if (form.period === 'day') {
    if (!fromISODate(form.date)) errors.date = 'Pick a valid date.';
  } else {
    if (!fromISODate(form.start)) errors.start = 'Pick a valid start date.';
    if (!fromISODate(form.end)) errors.end = 'Pick a valid end date.';
    const span = daysBetween(form.start, form.end);
    if (span !== null && span < 0) {
      errors.end = 'End date must be on or after the start date.';
    } else if (span !== null && span + 1 > MAX_RANGE_DAYS) {
      errors.end = `Maximum ${MAX_RANGE_DAYS} days per range.`;
    }
  }

  for (const field of METRIC_FIELDS) {
    const raw = form[field];
    if (raw.trim() === '') continue;
    const value = parseNumber(raw);
    if (value === null) {
      errors[field] = 'Enter a number.';
      continue;
    }
    const range = METRIC_RANGES[METRIC_FOR_FIELD[field]];
    if (value < range.min || value > range.max) {
      errors[field] = `Must be between ${range.min} and ${range.max}.`;
    }
  }

  const hasValue = METRIC_FIELDS.some((field) => form[field].trim() !== '');
  if (!hasValue && form.moods.length === 0) {
    errors.moods = 'Fill in at least one measurement.';
  }

  return errors;
}

/** Builds the entry to save, omitting any field the user left blank. */
export function formToEntry(form: FormState): DailyEntry {
  const entry: DailyEntry = { date: form.date };

  const weight = parseNumber(form.weightKg);
  if (weight !== null) entry.weightKg = weight;

  const steps = parseNumber(form.steps);
  if (steps !== null) entry.steps = Math.round(steps);

  const sleep = parseNumber(form.sleepQuality);
  if (sleep !== null) entry.sleepQuality = sleep;

  const calories = parseNumber(form.calories);
  if (calories !== null) entry.calories = Math.round(calories);

  const moods = normalizeMoods(form.moods);
  if (moods.length > 0) entry.moods = moods;

  return entry;
}

/**
 * The entries a save produces: one for the chosen day, or one per day in the
 * chosen range. Values are applied to every generated day.
 */
export function formToEntries(form: FormState): DailyEntry[] {
  const dates = form.period === 'range' ? dateRange(form.start, form.end) : [form.date];
  return dates.map((date) => formToEntry({ ...form, date }));
}

export function EntryForm({ defaultDate, editingEntry = null, onSave, onCancelEdit }: EntryFormProps) {
  const today = defaultDate ?? toISODate(new Date());
  const [form, setForm] = useState<FormState>(() =>
    editingEntry ? formFromEntry(editingEntry) : emptyForm(today),
  );
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saved, setSaved] = useState(false);

  // Keep the pickers on today without clobbering typed measurements.
  const [lastToday, setLastToday] = useState(today);
  if (today !== lastToday) {
    setLastToday(today);
    if (editingEntry === null) {
      setForm((current) => ({
        ...current,
        date: today,
        start: today,
        end: today,
      }));
    }
  }

  const minDate = useMemo(() => addDays(today, -365 * 3), [today]);
  const maxDate = today;

  function update<K extends keyof FormState>(field: K, value: FormState[K]): void {
    setSaved(false);
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  /** Adds a mood tag, or removes it when it is already selected. */
  function toggleTag(tag: string): void {
    setSaved(false);
    setErrors((current) => {
      if (!current.moods) return current;
      const next = { ...current };
      delete next.moods;
      return next;
    });
    setForm((current) => {
      const key = tag.toLowerCase();
      const exists = current.moods.some((item) => item.toLowerCase() === key);
      if (exists) {
        return { ...current, moods: current.moods.filter((item) => item.toLowerCase() !== key) };
      }
      if (current.moods.length >= MAX_MOOD_TAGS) return current;
      return { ...current, moods: [...current.moods, tag] };
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const found = validate(form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setSaved(false);
      return;
    }

    // A range save writes several entries; React batches the state updates
    // into a single render, so the app persists one merged state.
    for (const entry of formToEntries(form)) onSave(entry);
    setForm(clearMeasurements);
    setErrors({});
    setSaved(true);
  }

  const savedMessage = editingEntry
    ? 'Saved. Entry updated.'
    : form.period === 'day'
      ? 'Saved. Values merged into that day.'
      : `Saved. Applied to ${formToEntries(form).length} days in that range.`;

  return (
    <form className="card entry-form" onSubmit={handleSubmit} noValidate>
      <h3>{editingEntry ? `Edit entry for ${formatShortDate(editingEntry.date)}` : 'Log an entry'}</h3>

      <div className="entry-form__row">
        {editingEntry === null ? (
          <label className="field">
            <span>Period</span>
            <select
              value={form.period}
              onChange={(event) => update('period', event.target.value as EntryPeriod)}
            >
              <option value="day">Exact date</option>
              <option value="range">Custom range</option>
            </select>
          </label>
        ) : null}

        {editingEntry !== null || form.period === 'day' ? (
          <label className="field">
            <span>Date</span>
            <input
              type="date"
              value={form.date}
              // Editing may target a day outside the 3-year picker window, so
              // only constrain the date when logging a new entry.
              min={editingEntry === null ? minDate : undefined}
              max={editingEntry === null ? maxDate : undefined}
              onChange={(event) => update('date', event.target.value)}
              aria-invalid={errors.date ? 'true' : undefined}
              aria-describedby={errors.date ? 'entry-date-error' : undefined}
            />
            {errors.date ? (
              <small className="field__error" id="entry-date-error">
                {errors.date}
              </small>
            ) : null}
          </label>
        ) : (
          <>
            <label className="field">
              <span>Start</span>
              <input
                type="date"
                value={form.start}
                min={minDate}
                max={maxDate}
                onChange={(event) => update('start', event.target.value)}
                aria-invalid={errors.start ? 'true' : undefined}
                aria-describedby={errors.start ? 'entry-start-error' : undefined}
              />
              {errors.start ? (
                <small className="field__error" id="entry-start-error">
                  {errors.start}
                </small>
              ) : null}
            </label>
            <label className="field">
              <span>End</span>
              <input
                type="date"
                value={form.end}
                min={minDate}
                max={maxDate}
                onChange={(event) => update('end', event.target.value)}
                aria-invalid={errors.end ? 'true' : undefined}
                aria-describedby={errors.end ? 'entry-end-error' : undefined}
              />
              {errors.end ? (
                <small className="field__error" id="entry-end-error">
                  {errors.end}
                </small>
              ) : null}
            </label>
          </>
        )}
      </div>

      {form.period !== 'day' ? (
        <p className="entry-form__hint">
          One set of values is applied to every day from Start to End, both included.
        </p>
      ) : null}

      <div className="entry-form__row">
        <label className="field">
          <span>Weight (kg)</span>
          <input
            type="number"
            inputMode="decimal"
            step={METRIC_RANGES.weight.step}
            min={METRIC_RANGES.weight.min}
            max={METRIC_RANGES.weight.max}
            placeholder="80.5"
            value={form.weightKg}
            onChange={(event) => update('weightKg', event.target.value)}
            aria-invalid={errors.weightKg ? 'true' : undefined}
            aria-describedby={errors.weightKg ? 'entry-weight-error' : undefined}
          />
          {errors.weightKg ? (
            <small className="field__error" id="entry-weight-error">
              {errors.weightKg}
            </small>
          ) : null}
        </label>

        <label className="field">
          <span>Steps</span>
          <input
            type="number"
            inputMode="numeric"
            step={METRIC_RANGES.steps.step}
            min={METRIC_RANGES.steps.min}
            max={METRIC_RANGES.steps.max}
            placeholder="9500"
            value={form.steps}
            onChange={(event) => update('steps', event.target.value)}
            aria-invalid={errors.steps ? 'true' : undefined}
            aria-describedby={errors.steps ? 'entry-steps-error' : undefined}
          />
          {errors.steps ? (
            <small className="field__error" id="entry-steps-error">
              {errors.steps}
            </small>
          ) : null}
        </label>
      </div>

      <div className="entry-form__row">
        <label className="field">
          <span>Sleep quality</span>
          <select
            value={form.sleepQuality}
            onChange={(event) => update('sleepQuality', event.target.value)}
            aria-invalid={errors.sleepQuality ? 'true' : undefined}
            aria-describedby={errors.sleepQuality ? 'entry-sleep-error' : undefined}
          >
            <option value="">Not set</option>
            {SLEEP_QUALITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.sleepQuality ? (
            <small className="field__error" id="entry-sleep-error">
              {errors.sleepQuality}
            </small>
          ) : null}
        </label>

        <label className="field">
          <span>Calories eaten (kcal)</span>
          <input
            type="number"
            inputMode="numeric"
            step={METRIC_RANGES.calories.step}
            min={METRIC_RANGES.calories.min}
            max={METRIC_RANGES.calories.max}
            placeholder="2200"
            value={form.calories}
            onChange={(event) => update('calories', event.target.value)}
            aria-invalid={errors.calories ? 'true' : undefined}
            aria-describedby={errors.calories ? 'entry-calories-error' : undefined}
          />
          {errors.calories ? (
            <small className="field__error" id="entry-calories-error">
              {errors.calories}
            </small>
          ) : null}
        </label>
      </div>

      <div
        className="entry-form__tags"
        role="group"
        aria-label="Mood tags"
        aria-describedby={errors.moods ? 'entry-moods-error' : undefined}
      >
        <p className="entry-form__tags-title">
          Mood tags — click to toggle. Selected {form.moods.length} of {MAX_MOOD_TAGS}.
        </p>
        {MOOD_TAG_GROUPS.map((group) => (
          <div className="entry-form__tags-group" key={group.name}>
            <span className="entry-form__tags-group-name">{group.name}</span>
            {group.tags.map((tag) => {
              const selected = form.moods.some((item) => item.toLowerCase() === tag.toLowerCase());
              return (
                <button
                  key={tag}
                  type="button"
                  className={`entry-form__chip${selected ? ' entry-form__chip--selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        ))}
        {errors.moods ? (
          <small className="field__error" id="entry-moods-error">
            {errors.moods}
          </small>
        ) : null}
      </div>

      <div className="entry-form__actions">
        <button type="submit" className="button button--primary">
          {editingEntry ? 'Update entry' : 'Save entry'}
        </button>
        {editingEntry ? (
          <button type="button" className="button button--ghost" onClick={onCancelEdit}>
            Cancel
          </button>
        ) : (
          <button
            type="button"
            className="button button--ghost"
            onClick={() => {
              setForm(clearMeasurements);
              setErrors({});
              setSaved(false);
            }}
          >
            Reset
          </button>
        )}
        <span role="status" className="entry-form__status">
          {saved ? savedMessage : ''}
        </span>
      </div>
    </form>
  );
}
