/**
 * Persistence.
 *
 * Data lives in `localStorage` so the app works fully offline with no account
 * and no backend. Everything here is defensive: a corrupt or hand-edited blob
 * must never crash the app, it just falls back to empty state.
 *
 * The storage backend is injected, which keeps the parsing logic testable
 * without touching a real browser store.
 */

import { isValidISODate } from './date.ts';
import { mergeEntries, sortEntries } from './series.ts';
import { METRIC_RANGES } from '../types.ts';
import type { DailyEntry, Profile } from '../types.ts';

export const STORAGE_KEYS = {
  entries: 'health-tracker:entries',
  profile: 'health-tracker:profile',
  version: 'health-tracker:version',
} as const;

/** Bump when the persisted shape changes incompatibly. */
export const SCHEMA_VERSION = 1;

/** Minimal slice of the `Storage` interface we depend on. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LoadResult {
  entries: DailyEntry[];
  /** True when the stored payload could not be parsed and was discarded. */
  recovered: boolean;
}

function safeParse(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Coerces an arbitrary parsed value into a number inside the metric range. */
function coerceMetric(
  value: unknown,
  range: { min: number; max: number },
): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  if (parsed < range.min || parsed > range.max) return undefined;
  return parsed;
}

function coerceString(value: unknown, maxLength = 500): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.slice(0, maxLength);
}

/** Validates and normalizes a single entry. Invalid dates are dropped. */
export function sanitizeEntry(value: unknown): DailyEntry | null {
  if (!isRecord(value)) return null;
  const date = coerceString(value.date);
  if (!date || !isValidISODate(date)) return null;

  const entry: DailyEntry = { date };

  const weight = coerceMetric(value.weightKg, METRIC_RANGES.weight);
  if (weight !== undefined) entry.weightKg = weight;

  const steps = coerceMetric(value.steps, METRIC_RANGES.steps);
  if (steps !== undefined) entry.steps = steps;

  const sleep = coerceMetric(value.sleepQuality, METRIC_RANGES.sleep);
  if (sleep !== undefined) entry.sleepQuality = sleep;

  const calories = coerceMetric(value.calories, METRIC_RANGES.calories);
  if (calories !== undefined) entry.calories = calories;

  const note = coerceString(value.note, 400);
  if (note !== undefined) entry.note = note;

  return entry;
}

/** Parses an array of entries, dropping anything malformed. */
export function sanitizeEntries(value: unknown): { entries: DailyEntry[]; dropped: number } {
  if (!Array.isArray(value)) return { entries: [], dropped: 0 };
  const sanitized: DailyEntry[] = [];
  let dropped = 0;
  for (const raw of value) {
    const entry = sanitizeEntry(raw);
    if (entry) sanitized.push(entry);
    else dropped += 1;
  }
  return { entries: mergeEntries([], sanitized), dropped };
}

function coerceOptionalNumber(value: unknown, min: number, max: number): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  if (parsed < min || parsed > max) return undefined;
  return parsed;
}

const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'athlete'] as const;

/** Validates a profile blob, keeping only known and in-range fields. */
export function sanitizeProfile(value: unknown): Profile {
  if (!isRecord(value)) return {};

  const profile: Profile = {};

  const name = coerceString(value.name, 60);
  if (name) profile.name = name;

  const birthDate = coerceString(value.birthDate, 10);
  if (birthDate && isValidISODate(birthDate)) profile.birthDate = birthDate;

  if (value.sex === 'male' || value.sex === 'female') profile.sex = value.sex;

  const heightCm = coerceOptionalNumber(value.heightCm, 100, 260);
  if (heightCm !== undefined) profile.heightCm = heightCm;

  if (
    typeof value.activityLevel === 'string' &&
    (ACTIVITY_LEVELS as readonly string[]).includes(value.activityLevel)
  ) {
    profile.activityLevel = value.activityLevel as Profile['activityLevel'];
  }

  const targetWeightKg = coerceOptionalNumber(value.targetWeightKg, 20, 400);
  if (targetWeightKg !== undefined) profile.targetWeightKg = targetWeightKg;

  const dailyCalorieGoal = coerceOptionalNumber(value.dailyCalorieGoal, 800, 10_000);
  if (dailyCalorieGoal !== undefined) profile.dailyCalorieGoal = dailyCalorieGoal;

  const dailyStepGoal = coerceOptionalNumber(value.dailyStepGoal, 500, 60_000);
  if (dailyStepGoal !== undefined) profile.dailyStepGoal = dailyStepGoal;

  const sleepGoalQuality = coerceOptionalNumber(value.sleepGoalQuality, 1, 5);
  if (sleepGoalQuality !== undefined) profile.sleepGoalQuality = sleepGoalQuality;

  return profile;
}

/** Reads and validates persisted state. */
export function loadState(storage: StorageLike): LoadResult {
  const rawText = storage.getItem(STORAGE_KEYS.entries);
  if (rawText === null) return { entries: [], recovered: false };

  const raw = safeParse(rawText);

  // Accept both the bare array and the `{ version, entries }` envelope.
  const payload = Array.isArray(raw) ? raw : isRecord(raw) ? raw.entries : null;
  if (payload === null) {
    // Unparseable JSON or an unexpected shape: start clean rather than crash.
    return { entries: [], recovered: true };
  }

  const { entries, dropped } = sanitizeEntries(payload);
  return { entries: sortEntries(entries), recovered: dropped > 0 };
}

export function loadProfile(storage: StorageLike): Profile {
  return sanitizeProfile(safeParse(storage.getItem(STORAGE_KEYS.profile)));
}

export function saveEntries(storage: StorageLike, entries: readonly DailyEntry[]): void {
  const payload = JSON.stringify({ version: SCHEMA_VERSION, entries: sortEntries(entries) });
  storage.setItem(STORAGE_KEYS.entries, payload);
}

export function saveProfile(storage: StorageLike, profile: Profile): void {
  storage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
}

export function clearState(storage: StorageLike): void {
  storage.removeItem(STORAGE_KEYS.entries);
  storage.removeItem(STORAGE_KEYS.profile);
  storage.removeItem(STORAGE_KEYS.version);
}

/** `localStorage` when available, otherwise an in-memory stub (SSR, tests). */
export function resolveStorage(): StorageLike {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__health_tracker_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return localStorage;
    }
  } catch {
    // Private-mode Safari and blocked third-party storage land here.
  }
  return createMemoryStorage();
}

export function createMemoryStorage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}