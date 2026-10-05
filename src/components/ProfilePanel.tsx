import { useState, type FormEvent } from 'react';
import {
  ACTIVITY_LABELS,
  ACTIVITY_MULTIPLIERS,
  basalMetabolicRate,
  totalDailyEnergyExpenditure,
} from '../lib/health.ts';
import { formatNumber } from '../lib/stats.ts';
import type { ActivityLevel, Profile, Sex } from '../types.ts';

export interface ProfilePanelProps {
  profile: Profile;
  /** Latest logged weight, used to estimate burn. `null` when there is none. */
  latestWeightKg: number | null;
  onChange: (patch: Profile) => void;
  onClearAll: () => void;
}

const ACTIVITY_LEVELS = Object.keys(ACTIVITY_MULTIPLIERS) as ActivityLevel[];

type FormState = {
  name: string;
  age: string;
  sex: string;
  heightCm: string;
  activityLevel: ActivityLevel;
  targetWeightKg: string;
  dailyCalorieGoal: string;
  dailyStepGoal: string;
  sleepGoalHours: string;
};

function toFormState(profile: Profile): FormState {
  return {
    name: profile.name ?? '',
    age: profile.age !== undefined ? String(profile.age) : '',
    sex: profile.sex ?? '',
    heightCm: profile.heightCm !== undefined ? String(profile.heightCm) : '',
    activityLevel: profile.activityLevel ?? 'moderate',
    targetWeightKg: profile.targetWeightKg !== undefined ? String(profile.targetWeightKg) : '',
    dailyCalorieGoal: profile.dailyCalorieGoal !== undefined ? String(profile.dailyCalorieGoal) : '',
    dailyStepGoal: profile.dailyStepGoal !== undefined ? String(profile.dailyStepGoal) : '',
    sleepGoalHours: profile.sleepGoalHours !== undefined ? String(profile.sleepGoalHours) : '',
  };
}

function optionalNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : undefined;
}

export function ProfilePanel({
  profile,
  latestWeightKg,
  onChange,
  onClearAll,
}: ProfilePanelProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(profile));
  const [confirmClear, setConfirmClear] = useState(false);

  // Build the profile from the current form values. Unrelated fields are
  // omitted so `updateProfile` can merge them into the stored profile.
  const parsedProfile: Profile = {
    ...(form.name.trim() !== '' ? { name: form.name.trim() } : {}),
    ...(optionalNumber(form.age) !== undefined ? { age: optionalNumber(form.age) } : {}),
    ...(form.sex === 'male' || form.sex === 'female' ? { sex: form.sex as Sex } : {}),
    ...(optionalNumber(form.heightCm) !== undefined
      ? { heightCm: optionalNumber(form.heightCm) }
      : {}),
    activityLevel: form.activityLevel,
    ...(optionalNumber(form.targetWeightKg) !== undefined
      ? { targetWeightKg: optionalNumber(form.targetWeightKg) }
      : {}),
    ...(optionalNumber(form.dailyCalorieGoal) !== undefined
      ? { dailyCalorieGoal: optionalNumber(form.dailyCalorieGoal) }
      : {}),
    ...(optionalNumber(form.dailyStepGoal) !== undefined
      ? { dailyStepGoal: optionalNumber(form.dailyStepGoal) }
      : {}),
    ...(optionalNumber(form.sleepGoalHours) !== undefined
      ? { sleepGoalHours: optionalNumber(form.sleepGoalHours) }
      : {}),
  };

  const bmr = latestWeightKg !== null ? basalMetabolicRate(parsedProfile, latestWeightKg) : null;
  const tdee =
    latestWeightKg !== null ? totalDailyEnergyExpenditure(parsedProfile, latestWeightKg) : null;

  function update<K extends keyof FormState>(field: K, value: FormState[K]): void {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function commit(): void {
    onChange(parsedProfile);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    commit();
  }

  return (
    <section className="card profile" aria-label="Profile and goals">
      <h3>Profile &amp; goals</h3>
      <p className="profile__intro">
        Optional, but it unlocks energy-balance estimates, BMI and goal tracking.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="profile__row">
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              value={form.name}
              maxLength={60}
              placeholder="Optional"
              onChange={(event) => update('name', event.target.value)}
              onBlur={commit}
            />
          </label>

          <label className="field">
            <span>Age</span>
            <input
              type="number"
              inputMode="numeric"
              min={13}
              max={120}
              value={form.age}
              placeholder="32"
              onChange={(event) => update('age', event.target.value)}
              onBlur={commit}
            />
          </label>

          <label className="field">
            <span>Sex</span>
            <select value={form.sex} onChange={(event) => update('sex', event.target.value)} onBlur={commit}>
              <option value="">Not set</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </label>
        </div>

        <div className="profile__row">
          <label className="field">
            <span>Height (cm)</span>
            <input
              type="number"
              inputMode="decimal"
              min={100}
              max={260}
              value={form.heightCm}
              placeholder="178"
              onChange={(event) => update('heightCm', event.target.value)}
              onBlur={commit}
            />
          </label>

          <label className="field">
            <span>Target weight (kg)</span>
            <input
              type="number"
              inputMode="decimal"
              min={20}
              max={400}
              step={0.1}
              value={form.targetWeightKg}
              placeholder="75"
              onChange={(event) => update('targetWeightKg', event.target.value)}
              onBlur={commit}
            />
          </label>
        </div>

        <div className="profile__row">
          <label className="field">
            <span>Activity level</span>
            <select
              value={form.activityLevel}
              onChange={(event) => update('activityLevel', event.target.value as ActivityLevel)}
              onBlur={commit}
            >
              {ACTIVITY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {ACTIVITY_LABELS[level]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="profile__row">
          <label className="field">
            <span>Calorie goal (kcal)</span>
            <input
              type="number"
              inputMode="numeric"
              min={800}
              max={10000}
              value={form.dailyCalorieGoal}
              placeholder={tdee !== null ? String(Math.round(tdee)) : 'Auto'}
              onChange={(event) => update('dailyCalorieGoal', event.target.value)}
              onBlur={commit}
            />
          </label>

          <label className="field">
            <span>Step goal</span>
            <input
              type="number"
              inputMode="numeric"
              min={500}
              max={60000}
              value={form.dailyStepGoal}
              placeholder="8000"
              onChange={(event) => update('dailyStepGoal', event.target.value)}
              onBlur={commit}
            />
          </label>

          <label className="field">
            <span>Sleep goal (h)</span>
            <input
              type="number"
              inputMode="decimal"
              min={4}
              max={14}
              step={0.1}
              value={form.sleepGoalHours}
              placeholder="8"
              onChange={(event) => update('sleepGoalHours', event.target.value)}
              onBlur={commit}
            />
          </label>
        </div>
      </form>

      <dl className="profile__estimates">
        <div>
          <dt>Basal metabolic rate</dt>
          <dd>{bmr !== null ? `${formatNumber(bmr, 0)} kcal` : 'Needs age, sex, height and weight'}</dd>
        </div>
        <div>
          <dt>Estimated daily burn</dt>
          <dd>{tdee !== null ? `${formatNumber(tdee, 0)} kcal` : 'Needs the same, plus weight'}</dd>
        </div>
      </dl>

      <div className="profile__danger">
        {confirmClear ? (
          <>
            <p>This deletes every logged entry and cannot be undone.</p>
            <div className="profile__danger-actions">
              <button
                type="button"
                className="button button--danger"
                onClick={() => {
                  onClearAll();
                  setConfirmClear(false);
                }}
              >
                Yes, delete everything
              </button>
              <button type="button" className="button button--ghost" onClick={() => setConfirmClear(false)}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="button button--ghost" onClick={() => setConfirmClear(true)}>
            Delete all data
          </button>
        )}
      </div>
    </section>
  );
}