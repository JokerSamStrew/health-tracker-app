import { describe, expect, it } from 'vitest';
import {
  clearState,
  createMemoryStorage,
  loadProfile,
  loadState,
  loadTheme,
  resolveStorage,
  sanitizeEntries,
  sanitizeEntry,
  sanitizeProfile,
  saveEntries,
  saveProfile,
  saveTheme,
  SCHEMA_VERSION,
  STORAGE_KEYS,
} from '../lib/storage.ts';
import { METRIC_FIELD } from '../lib/series.ts';
import { METRIC_KEYS, METRIC_RANGES } from '../types.ts';

describe('sanitizeEntry', () => {
  it('keeps a valid entry', () => {
    expect(sanitizeEntry({ date: '2024-03-08', weightKg: 80.5 })).toEqual({
      date: '2024-03-08',
      weightKg: 80.5,
    });
  });

  it('drops entries with a missing or invalid date', () => {
    expect(sanitizeEntry({ weightKg: 80 })).toBeNull();
    expect(sanitizeEntry({ date: '08/03/2024', weightKg: 80 })).toBeNull();
    expect(sanitizeEntry({ date: '2024-02-31' })).toBeNull();
    expect(sanitizeEntry({ date: 20240308 })).toBeNull();
  });

  it('drops non-object input', () => {
    expect(sanitizeEntry(null)).toBeNull();
    expect(sanitizeEntry('2024-03-08')).toBeNull();
    expect(sanitizeEntry([{ date: '2024-03-08' }])).toBeNull();
  });

  it('coerces numeric strings', () => {
    expect(sanitizeEntry({ date: '2024-03-08', steps: '9500' })).toEqual({
      date: '2024-03-08',
      steps: 9500,
    });
  });

  it('rejects out-of-range values', () => {
    expect(sanitizeEntry({ date: '2024-03-08', weightKg: 5 })).toEqual({ date: '2024-03-08' });
    expect(sanitizeEntry({ date: '2024-03-08', sleepQuality: 30 })).toEqual({
      date: '2024-03-08',
    });
    expect(sanitizeEntry({ date: '2024-03-08', calories: -5 })).toEqual({ date: '2024-03-08' });
  });

  it('rejects non-finite values', () => {
    expect(sanitizeEntry({ date: '2024-03-08', steps: 'many' })).toEqual({ date: '2024-03-08' });
    expect(sanitizeEntry({ date: '2024-03-08', steps: Number.NaN })).toEqual({
      date: '2024-03-08',
    });
  });

  it('treats empty strings and null as absent', () => {
    expect(sanitizeEntry({ date: '2024-03-08', steps: '', calories: null })).toEqual({
      date: '2024-03-08',
    });
  });

  it('trims and caps notes', () => {
    const entry = sanitizeEntry({ date: '2024-03-08', note: '  felt good  ' })!;
    expect(entry.note).toBe('felt good');
    expect(sanitizeEntry({ date: '2024-03-08', note: 'x'.repeat(500) })!.note).toHaveLength(400);
  });

  it('accepts every metric at its boundary values', () => {
    for (const key of METRIC_KEYS) {
      const field = METRIC_FIELD[key];
      const range = METRIC_RANGES[key];
      expect(sanitizeEntry({ date: '2024-03-08', [field]: range.min })).toHaveProperty(field);
      expect(sanitizeEntry({ date: '2024-03-08', [field]: range.max })).toHaveProperty(field);
      expect(sanitizeEntry({ date: '2024-03-08', [field]: range.min - 1 })).not.toHaveProperty(
        field,
      );
      expect(sanitizeEntry({ date: '2024-03-08', [field]: range.max + 1 })).not.toHaveProperty(
        field,
      );
    }
  });
});

describe('sanitizeEntries', () => {
  it('drops malformed entries and reports the count', () => {
    const result = sanitizeEntries([
      { date: '2024-03-01', steps: 9000 },
      { date: 'nope' },
      null,
      { date: '2024-03-02', steps: 8000 },
    ]);
    expect(result.entries).toHaveLength(2);
    expect(result.dropped).toBe(2);
  });

  it('sorts and de-duplicates by date', () => {
    const result = sanitizeEntries([
      { date: '2024-03-03', steps: 3 },
      { date: '2024-03-01', steps: 1 },
      { date: '2024-03-01', steps: 2 },
    ]);
    expect(result.entries.map((entry) => entry.date)).toEqual(['2024-03-01', '2024-03-03']);
    expect(result.entries[0]!.steps).toBe(2);
  });

  it('returns empty for non-array input', () => {
    expect(sanitizeEntries('nope').entries).toEqual([]);
    expect(sanitizeEntries({ entries: [] }).entries).toEqual([]);
    expect(sanitizeEntries(null).entries).toEqual([]);
  });
});

describe('sanitizeProfile', () => {
  it('keeps valid fields', () => {
    const profile = sanitizeProfile({
      name: ' Sam ',
      birthDate: '1994-03-14',
      sex: 'male',
      heightCm: 180,
      activityLevel: 'active',
      targetWeightKg: 78,
      dailyCalorieGoal: 2400,
      dailyStepGoal: 10000,
      sleepGoalQuality: 4.5,
    });
    expect(profile).toEqual({
      name: 'Sam',
      birthDate: '1994-03-14',
      sex: 'male',
      heightCm: 180,
      activityLevel: 'active',
      targetWeightKg: 78,
      dailyCalorieGoal: 2400,
      dailyStepGoal: 10000,
      sleepGoalQuality: 4.5,
    });
  });

  it('drops unknown fields', () => {
    expect(sanitizeProfile({ birthDate: '1994-03-14', isAdmin: true })).toEqual({
      birthDate: '1994-03-14',
    });
  });

  it('drops out-of-range values', () => {
    expect(sanitizeProfile({ birthDate: 'not-a-date' })).toEqual({});
    expect(sanitizeProfile({ heightCm: 400 })).toEqual({});
    expect(sanitizeProfile({ sleepGoalQuality: 6 })).toEqual({});
  });

  it('drops an invalid sex or activity level', () => {
    expect(sanitizeProfile({ sex: 'other' })).toEqual({});
    expect(sanitizeProfile({ activityLevel: 'extreme' })).toEqual({});
  });

  it('returns an empty object for non-object input', () => {
    expect(sanitizeProfile(null)).toEqual({});
    expect(sanitizeProfile('nope')).toEqual({});
  });

  it('keeps a birth date given as text', () => {
    expect(sanitizeProfile({ birthDate: '1994-03-14' })).toEqual({ birthDate: '1994-03-14' });
  });
});

describe('save / load round-trip', () => {
  it('persists and restores entries sorted by date', () => {
    const storage = createMemoryStorage();
    const entries = [
      { date: '2024-03-03', steps: 3000 },
      { date: '2024-03-01', steps: 1000, weightKg: 80 },
    ];
    saveEntries(storage, entries);

    const loaded = loadState(storage);
    expect(loaded.recovered).toBe(false);
    expect(loaded.entries.map((entry) => entry.date)).toEqual(['2024-03-01', '2024-03-03']);
    expect(loaded.entries[0]!.weightKg).toBe(80);
  });

  it('writes a versioned envelope', () => {
    const storage = createMemoryStorage();
    saveEntries(storage, [{ date: '2024-03-01', steps: 1 }]);
    const parsed = JSON.parse(storage.getItem(STORAGE_KEYS.entries)!);
    expect(parsed.version).toBe(SCHEMA_VERSION);
    expect(parsed.entries).toHaveLength(1);
  });

  it('round-trips a profile', () => {
    const storage = createMemoryStorage();
    saveProfile(storage, { birthDate: '1994-03-14', sex: 'female', heightCm: 165 });
    expect(loadProfile(storage)).toEqual({ birthDate: '1994-03-14', sex: 'female', heightCm: 165 });
  });
});

describe('loadState resilience', () => {
  it('returns empty state when nothing is stored', () => {
    const result = loadState(createMemoryStorage());
    expect(result.entries).toEqual([]);
    expect(result.recovered).toBe(false);
  });

  it('recovers from unparseable JSON', () => {
    const storage = createMemoryStorage({ [STORAGE_KEYS.entries]: '{ not json' });
    const result = loadState(storage);
    expect(result.entries).toEqual([]);
    expect(result.recovered).toBe(true);
  });

  it('recovers from an unexpected shape', () => {
    const storage = createMemoryStorage({ [STORAGE_KEYS.entries]: '"just a string"' });
    expect(loadState(storage).recovered).toBe(true);
  });

  it('accepts a legacy bare array', () => {
    const storage = createMemoryStorage({
      [STORAGE_KEYS.entries]: JSON.stringify([{ date: '2024-03-01', steps: 5000 }]),
    });
    const result = loadState(storage);
    expect(result.entries).toHaveLength(1);
    expect(result.recovered).toBe(false);
  });

  it('reports recovery when only some entries are salvageable', () => {
    const storage = createMemoryStorage({
      [STORAGE_KEYS.entries]: JSON.stringify([{ date: '2024-03-01' }, { date: 'bad' }]),
    });
    const result = loadState(storage);
    expect(result.entries).toHaveLength(1);
    expect(result.recovered).toBe(true);
  });
});

describe('clearState', () => {
  it('removes every key', () => {
    const storage = createMemoryStorage();
    saveEntries(storage, [{ date: '2024-03-01', steps: 1 }]);
    saveProfile(storage, { birthDate: '1994-03-14' });

    clearState(storage);

    expect(storage.getItem(STORAGE_KEYS.entries)).toBeNull();
    expect(storage.getItem(STORAGE_KEYS.profile)).toBeNull();
    expect(loadState(storage).entries).toEqual([]);
    expect(loadProfile(storage)).toEqual({});
  });
});

describe('createMemoryStorage', () => {
  it('behaves like a key-value store', () => {
    const storage = createMemoryStorage({ a: '1' });
    expect(storage.getItem('a')).toBe('1');
    expect(storage.getItem('missing')).toBeNull();
    storage.setItem('b', '2');
    expect(storage.getItem('b')).toBe('2');
    storage.removeItem('a');
    expect(storage.getItem('a')).toBeNull();
  });
});

describe('resolveStorage', () => {
  it('returns a usable store in the jsdom environment', () => {
    const storage = resolveStorage();
    storage.setItem('probe', 'ok');
    expect(storage.getItem('probe')).toBe('ok');
    storage.removeItem('probe');
  });
});

describe('theme storage', () => {
  it('loads a saved theme', () => {
    const storage = createMemoryStorage({ [STORAGE_KEYS.theme]: 'dark' });
    expect(loadTheme(storage)).toBe('dark');
  });

  it('treats anything but light or dark as absent', () => {
    const storage = createMemoryStorage({ [STORAGE_KEYS.theme]: 'midnight' });
    expect(loadTheme(storage)).toBeNull();
  });

  it('round-trips a theme through save and load', () => {
    const storage = createMemoryStorage();
    saveTheme(storage, 'dark');
    expect(storage.getItem(STORAGE_KEYS.theme)).toBe('dark');
    expect(loadTheme(storage)).toBe('dark');
  });

  it('survives clearState, which only wipes health data', () => {
    const storage = createMemoryStorage({ [STORAGE_KEYS.theme]: 'dark' });
    clearState(storage);
    expect(loadTheme(storage)).toBe('dark');
  });
});