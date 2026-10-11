import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useHealthData } from '../hooks/useHealthData.ts';
import { createMemoryStorage, STORAGE_KEYS } from '../lib/storage.ts';
import { DEFAULT_PROFILE } from '../types.ts';
import type { Profile } from '../types.ts';

const REFERENCE = '2024-03-14';

function setup(profile?: Partial<Profile>) {
  const storage = createMemoryStorage();
  const { result } = renderHook(() =>
    useHealthData({ referenceDate: REFERENCE, windowDays: 14 }, storage),
  );
  if (profile) {
    act(() => {
      result.current.updateProfile(profile);
    });
  }
  return { result, storage };
}

describe('useHealthData', () => {
  it('starts empty for fresh storage', () => {
    const { result } = setup();
    expect(result.current.entries).toEqual([]);
    expect(result.current.recovered).toBe(false);
  });

  it('adds an entry and reports it', () => {
    const { result } = setup();
    act(() => {
      result.current.upsertEntry({ date: REFERENCE, weightKg: 80, steps: 9000 });
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]!.weightKg).toBe(80);
  });

  it('merges a partial update into an existing day', () => {
    const { result } = setup();
    act(() => {
      result.current.upsertEntry({ date: REFERENCE, weightKg: 80, steps: 9000 });
    });
    act(() => {
      result.current.upsertEntry({ date: REFERENCE, steps: 12000 });
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]!.steps).toBe(12000);
    expect(result.current.entries[0]!.weightKg).toBe(80);
  });

  it('replaces the whole entry for a date when editing', () => {
    const { result, storage } = setup();
    act(() => {
      result.current.upsertEntry({ date: REFERENCE, weightKg: 80, steps: 9000 });
    });
    act(() => {
      result.current.replaceEntry({ date: REFERENCE, steps: 100 }, REFERENCE);
    });

    // Unlike `upsertEntry`, a replaced entry drops fields that are no longer
    // given, so a cleared form field actually removes the stored value.
    expect(result.current.entries).toEqual([{ date: REFERENCE, steps: 100 }]);
    expect(storage.getItem(STORAGE_KEYS.entries)).toContain('"steps":100');
    expect(storage.getItem(STORAGE_KEYS.entries)).not.toContain('weightKg');
  });

  it('moves an entry to its new date on replace', () => {
    const { result } = setup();
    act(() => {
      result.current.upsertEntry({ date: '2024-03-10', weightKg: 80 });
      result.current.upsertEntry({ date: '2024-03-11', steps: 9000 });
    });
    act(() => {
      result.current.replaceEntry({ date: '2024-03-12', weightKg: 81 }, '2024-03-10');
    });

    // The edited entry leaves its old date behind and lands on the new one.
    expect(result.current.entries).toEqual([
      { date: '2024-03-11', steps: 9000 },
      { date: '2024-03-12', weightKg: 81 },
    ]);
  });

  it('keeps one entry per date', () => {
    const { result } = setup();
    act(() => {
      result.current.upsertEntry({ date: REFERENCE, steps: 9000 });
      result.current.upsertEntry({ date: REFERENCE, steps: 9500 });
    });
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]!.steps).toBe(9500);
  });

  it('deletes an entry by date', () => {
    const { result } = setup();
    act(() => {
      result.current.upsertEntry({ date: '2024-03-10', steps: 9000 });
      result.current.upsertEntry({ date: '2024-03-11', steps: 9500 });
    });
    act(() => {
      result.current.removeEntry('2024-03-10');
    });

    expect(result.current.entries.map((entry) => entry.date)).toEqual(['2024-03-11']);
  });

  it('deleting an unknown date is a no-op', () => {
    const { result } = setup();
    act(() => {
      result.current.upsertEntry({ date: REFERENCE, steps: 9000 });
    });
    act(() => {
      result.current.removeEntry('1999-01-01');
    });
    expect(result.current.entries).toHaveLength(1);
  });

  it('returns entries sorted by date', () => {
    const { result } = setup();
    act(() => {
      result.current.upsertEntry({ date: '2024-03-12', steps: 1 });
      result.current.upsertEntry({ date: '2024-03-01', steps: 2 });
      result.current.upsertEntry({ date: '2024-03-06', steps: 3 });
    });
    expect(result.current.entries.map((entry) => entry.date)).toEqual([
      '2024-03-01',
      '2024-03-06',
      '2024-03-12',
    ]);
  });

  it('persists entries to storage', () => {
    const { result, storage } = setup();
    act(() => {
      result.current.upsertEntry({ date: REFERENCE, steps: 9000 });
    });

    expect(storage.getItem(STORAGE_KEYS.entries)).toContain('2024-03-14');
  });

  it('persists the profile', () => {
    const { storage } = setup({ heightCm: 180 });
    expect(storage.getItem(STORAGE_KEYS.profile)).toContain('180');
  });

  it('updates the profile without dropping other fields', () => {
    const { result } = setup();
    act(() => {
      result.current.updateProfile({ heightCm: 180, birthDate: '1994-03-14' });
    });
    act(() => {
      result.current.updateProfile({ birthDate: '1993-03-14' });
    });

    expect(result.current.profile.heightCm).toBe(180);
    expect(result.current.profile.birthDate).toBe('1993-03-14');
  });

  it('clears entries and persisted state on request', () => {
    const { result, storage } = setup();
    act(() => {
      result.current.upsertEntry({ date: REFERENCE, steps: 9000 });
      result.current.updateProfile({ birthDate: '1994-03-14' });
    });

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.entries).toEqual([]);
    // The persist effect rewrites an empty state, so assert the data is gone
    // rather than that the key was removed.
    expect(storage.getItem(STORAGE_KEYS.entries)).not.toContain(REFERENCE);
    // The profile is kept on purpose so "delete all data" does not reset goals.
    expect(result.current.profile.birthDate).toBe('1994-03-14');
  });

  it('reloads persisted entries from storage', () => {
    const storage = createMemoryStorage({
      [STORAGE_KEYS.entries]: JSON.stringify([{ date: REFERENCE, steps: 9000 }]),
    });
    const { result } = renderHook(() =>
      useHealthData({ referenceDate: REFERENCE }, storage),
    );

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]!.steps).toBe(9000);
  });

  it('flags recovered storage', () => {
    const storage = createMemoryStorage({ [STORAGE_KEYS.entries]: 'not json at all' });
    const { result } = renderHook(() => useHealthData({ referenceDate: REFERENCE }, storage));

    expect(result.current.recovered).toBe(true);
    expect(result.current.entries).toEqual([]);
  });

  it('computes a report from the current entries', () => {
    const { result } = setup();
    act(() => {
      for (let day = 0; day < 14; day += 1) {
        const date = new Date(2024, 2, 14 - day);
        const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
          date.getDate(),
        ).padStart(2, '0')}`;
        result.current.upsertEntry({ date: iso, weightKg: 80, sleepQuality: 3, steps: 3000 });
      }
    });

    expect(result.current.report.insights.length).toBeGreaterThan(0);
    expect(result.current.report.score).not.toBeNull();
  });

  it('recomputes the report when the profile changes', () => {
    const { result } = setup();
    act(() => {
      result.current.upsertEntry({ date: REFERENCE, weightKg: 95 });
    });

    const before = result.current.report.insights.some((insight) => insight.id === 'body.bmi');
    expect(before).toBe(false);

    act(() => {
      result.current.updateProfile({ heightCm: 180 });
    });

    expect(result.current.report.insights.some((insight) => insight.id === 'body.bmi')).toBe(true);
  });

  it('keeps the profile after clearing entries', () => {
    const { result } = setup({ heightCm: 180 });
    act(() => {
      result.current.upsertEntry({ date: REFERENCE, steps: 9000 });
    });
    act(() => {
      result.current.clearAll();
    });

    expect(result.current.entries).toEqual([]);
    expect(result.current.profile.heightCm).toBe(180);
  });

  it('replaces entries and profile on import', () => {
    const { result } = setup({ heightCm: 180 });
    act(() => {
      result.current.upsertEntry({ date: '2024-03-10', steps: 9000 });
      result.current.upsertEntry({ date: '2024-03-11', steps: 9500 });
    });

    act(() => {
      result.current.importData([{ date: '2024-03-01', steps: 3000, weightKg: 79 }], {
        birthDate: '1984-03-14',
        sex: 'female',
      });
    });

    // Nothing from before the import survives.
    expect(result.current.entries).toEqual([{ date: '2024-03-01', steps: 3000, weightKg: 79 }]);
    expect(result.current.profile).toEqual({ ...DEFAULT_PROFILE, birthDate: '1984-03-14', sex: 'female' });
    expect(result.current.profile.heightCm).toBeUndefined();
  });

  it('persists imported data to storage', () => {
    const { result, storage } = setup();
    act(() => {
      result.current.importData([{ date: REFERENCE, steps: 7000 }], { birthDate: '1994-03-14' });
    });

    expect(storage.getItem(STORAGE_KEYS.entries)).toContain(REFERENCE);
    expect(storage.getItem(STORAGE_KEYS.profile)).toContain('1994-03-14');
  });

  it('clears the recovered flag after a successful import', () => {
    const storage = createMemoryStorage({ [STORAGE_KEYS.entries]: 'not json' });
    const { result } = renderHook(() => useHealthData({ referenceDate: REFERENCE }, storage));
    expect(result.current.recovered).toBe(true);

    act(() => {
      result.current.importData([{ date: REFERENCE, steps: 100 }], {});
    });

    expect(result.current.recovered).toBe(false);
  });

  it('writes to storage only when the data actually changes', () => {
    const setItem = vi.fn();
    const storage = {
      getItem: () => null,
      setItem,
      removeItem: () => {},
    };
    const { rerender } = renderHook(() => useHealthData({ referenceDate: REFERENCE }, storage));
    const writesAfterMount = setItem.mock.calls.length;

    rerender();

    expect(setItem).toHaveBeenCalledTimes(writesAfterMount);
  });
});