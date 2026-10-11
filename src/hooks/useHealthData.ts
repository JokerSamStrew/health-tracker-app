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
  /**
   * Replaces the entry that currently lives at `previousDate` (used when
   * editing). The saved entry replaces it outright, so cleared form fields are
   * dropped; an entry moved to a new date merges into that day if it exists.
   */
  replaceEntry: (entry: DailyEntry, previousDate: string) => void;
  removeEntry: (date: string) => void;
  updateProfile: (patch: Profile) => void;
  /** Replaces all current entries and profile with an imported backup. */
  importData: (entries: DailyEntry[], profile: Profile) => void;
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

  // Editing is a full replace, not a merge: clearing a field in the form must
  // remove that field from the stored entry, which `upsertEntry` cannot do.
  // The original date is dropped first so a same-day edit starts from scratch,
  // while moving the entry onto another date merges into whatever is there.
  const replaceEntry = useCallback((entry: DailyEntry, previousDate: string) => {
    setEntries((current) => mergeEntries(current.filter((e) => e.date !== previousDate), [entry]));
  }, []);

  const removeEntry = useCallback((date: string) => {
    setEntries((current) => current.filter((entry) => entry.date !== date));
  }, []);

  const updateProfile = useCallback((patch: Profile) => {
    setProfile((current) => ({ ...current, ...patch }));
  }, []);

  // Import is a full replace (the UI confirms before calling this). The
  // backup's profile is merged over the defaults so goals always resolve,
  // mirroring how state is initialized from storage.
  const importData = useCallback((importedEntries: DailyEntry[], importedProfile: Profile) => {
    setEntries(sortEntries(importedEntries));
    setProfile({ ...DEFAULT_PROFILE, ...importedProfile });
    setRecovered(false);
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
    replaceEntry,
    removeEntry,
    updateProfile,
    importData,
    clearAll,
    recovered,
  };
}