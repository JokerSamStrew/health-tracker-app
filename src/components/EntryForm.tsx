import { useMemo, useState, type FormEvent } from 'react';
import { addDays, fromISODate, toISODate } from '../lib/date.ts';
import { METRIC_RANGES } from '../types.ts';
import type { DailyEntry, MetricKey } from '../types.ts';

export interface EntryFormProps {
  /** Defaults to today. */
  defaultDate?: string;
  onSave: (entry: DailyEntry) => void;
}

interface FormState {
  date: string;
  weightKg: string;
  steps: string;
  sleepHours: string;
  calories: string;
  note: string;
}

type FieldName = 'weightKg' | 'steps' | 'sleepHours' | 'calories';

const METRIC_FIELDS: FieldName[] = ['weightKg', 'steps', 'sleepHours', 'calories'];

/** Form field -> metric key, needed because `weightKg` maps to `weight`. */
const METRIC_FOR_FIELD: Record<FieldName, MetricKey> = {
  weightKg: 'weight',
  steps: 'steps',
  sleepHours: 'sleep',
  calories: 'calories',
};

function emptyForm(date: string): FormState {
  return { date, weightKg: '', steps: '', sleepHours: '', calories: '', note: '' };
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

  if (!fromISODate(form.date)) {
    errors.date = 'Pick a valid date.';
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
  if (!hasValue && form.note.trim() === '') {
    errors.note = 'Fill in at least one measurement.';
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

  const sleep = parseNumber(form.sleepHours);
  if (sleep !== null) entry.sleepHours = sleep;

  const calories = parseNumber(form.calories);
  if (calories !== null) entry.calories = Math.round(calories);

  const note = form.note.trim();
  if (note !== '') entry.note = note;

  return entry;
}

export function EntryForm({ defaultDate, onSave }: EntryFormProps) {
  const today = defaultDate ?? toISODate(new Date());
  const [form, setForm] = useState<FormState>(() => emptyForm(today));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saved, setSaved] = useState(false);

  // Keep the date field on today without clobbering typed measurements.
  const [lastToday, setLastToday] = useState(today);
  if (today !== lastToday) {
    setLastToday(today);
    setForm((current) => ({ ...current, date: today }));
  }

  const minDate = useMemo(() => addDays(today, -365 * 3), [today]);
  const maxDate = today;

  function update(field: keyof FormState, value: string): void {
    setSaved(false);
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
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

    onSave(formToEntry(form));
    // Keep the date so several days can be entered in a row; clear the numbers.
    setForm((current) => emptyForm(current.date));
    setErrors({});
    setSaved(true);
  }

  return (
    <form className="card entry-form" onSubmit={handleSubmit} noValidate>
      <h3>Log an entry</h3>

      <div className="entry-form__row">
        <label className="field">
          <span>Date</span>
          <input
            type="date"
            value={form.date}
            min={minDate}
            max={maxDate}
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
      </div>

      <div className="entry-form__row">
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

        <label className="field">
          <span>Sleep (h)</span>
          <input
            type="number"
            inputMode="decimal"
            step={METRIC_RANGES.sleep.step}
            min={METRIC_RANGES.sleep.min}
            max={METRIC_RANGES.sleep.max}
            placeholder="7.5"
            value={form.sleepHours}
            onChange={(event) => update('sleepHours', event.target.value)}
            aria-invalid={errors.sleepHours ? 'true' : undefined}
            aria-describedby={errors.sleepHours ? 'entry-sleep-error' : undefined}
          />
          {errors.sleepHours ? (
            <small className="field__error" id="entry-sleep-error">
              {errors.sleepHours}
            </small>
          ) : null}
        </label>
      </div>

      <div className="entry-form__row">
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

        <label className="field">
          <span>Note (optional)</span>
          <input
            type="text"
            maxLength={400}
            placeholder="Long run, felt great"
            value={form.note}
            onChange={(event) => update('note', event.target.value)}
            aria-invalid={errors.note ? 'true' : undefined}
            aria-describedby={errors.note ? 'entry-note-error' : undefined}
          />
          {errors.note ? (
            <small className="field__error" id="entry-note-error">
              {errors.note}
            </small>
          ) : null}
        </label>
      </div>

      <div className="entry-form__actions">
        <button type="submit" className="button button--primary">
          Save entry
        </button>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => {
            setForm(emptyForm(form.date));
            setErrors({});
            setSaved(false);
          }}
        >
          Reset
        </button>
        <span role="status" className="entry-form__status">
          {saved ? 'Saved. Values merged into that day.' : ''}
        </span>
      </div>
    </form>
  );
}