import { useCallback, useEffect, useMemo, useState } from 'react';
import { analyzeHealth, type AnalyzeOptions } from '../lib/insights.ts';
import { mergeEntries, sortEntries } from '../lib/series.ts';
import {
  clearState,
  loadProfile,
  loadState,
  resolveStorage,
  saveEntries,
  saveProfile,
  type StorageLike,
} from '../lib/storage.ts';
import { DEFAULT_PROFILE } from '../types.ts';
import type { DailyEntry, HealthReport, Profile } from '../types.ts';

export interface UseHealthData {
  entries: DailyEntry[];
  profile: Profile;
  report: HealthReport;
  /** Adds or partially updates the entry for a date. */
  upsertEntry: (entry: DailyEntry) => void;
  removeEntry: (date: string) => void;
  updateProfile: (patch: Profile) => void;
  clearAll: () => void;
  /** True when persisted data had to be discarded on load. */
  recovered: boolean;
}

export function useHealthData(
  options: AnalyzeOptions = {},
  storageOverride?: StorageLike,
): UseHealthData {
  const storage = useMemo(() => storageOverride ?? resolveStorage(), [storageOverride]);

  // Read persisted state exactly once, then let React own it.
  const initial = useMemo(() => {
    const state = loadState(storage);
    return {
      entries: state.entries,
      recovered: state.recovered,
      profile: { ...DEFAULT_PROFILE, ...loadProfile(storage) },
    };
  }, [storage]);

  const [entries, setEntries] = useState<DailyEntry[]>(initial.entries);
  const [profile, setProfile] = useState<Profile>(initial.profile);
  const [recovered, setRecovered] = useState<boolean>(initial.recovered);

  useEffect(() => {
    saveEntries(storage, entries);
  }, [storage, entries]);

  useEffect(() => {
    saveProfile(storage, profile);
  }, [storage, profile]);

  const upsertEntry = useCallback((entry: DailyEntry) => {
    setEntries((current) => mergeEntries(current, [entry]));
  }, []);

  const removeEntry = useCallback((date: string) => {
    setEntries((current) => current.filter((entry) => entry.date !== date));
  }, []);

  const updateProfile = useCallback((patch: Profile) => {
    setProfile((current) => ({ ...current, ...patch }));
  }, []);

  const clearAll = useCallback(() => {
    clearState(storage);
    setEntries([]);
    setRecovered(false);
  }, [storage]);

  const { referenceDate, windowDays } = options;
  const report = useMemo(
    () => analyzeHealth(entries, profile, { referenceDate, windowDays }),
    [entries, profile, referenceDate, windowDays],
  );

  return {
    entries: sortEntries(entries),
    profile,
    report,
    upsertEntry,
    removeEntry,
    updateProfile,
    clearAll,
    recovered,
  };
}