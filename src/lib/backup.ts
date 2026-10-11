/**
 * JSON backup / restore for everything the user has entered.
 *
 * Pure serialization: `buildBackup` turns entries + profile into a portable
 * JSON string, `parseBackup` turns one back into sanitized state. No DOM and
 * no clock — the export timestamp is injected, so output stays deterministic
 * to test. Imported data flows through the same sanitizers as storage, so an
 * untrusted file can never crash the app.
 */

import { sortEntries } from './series.ts';
import { sanitizeEntries, sanitizeProfile } from './storage.ts';
import type { DailyEntry, Profile } from '../types.ts';

/** Identifies files produced by this app, so foreign JSON is rejected. */
export const BACKUP_FORMAT = 'health-tracker' as const;

/** Bump when the backup shape changes incompatibly. */
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  /** ISO datetime the file was created; informational only. */
  exportedAt: string;
  entries: DailyEntry[];
  profile: Profile;
}

export interface ParsedBackup {
  entries: DailyEntry[];
  profile: Profile;
  /** Number of entries dropped while sanitizing (bad dates, out-of-range). */
  dropped: number;
}

/**
 * Serializes state into a pretty-printed backup file. Entries are sorted so
 * two exports of the same state are byte-identical.
 */
export function buildBackup(
  entries: readonly DailyEntry[],
  profile: Profile,
  exportedAt: string,
): string {
  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    entries: sortEntries(entries),
    profile,
  };
  return JSON.stringify(backup, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parses a backup file back into sanitized state. Returns `null` when the
 * text is not JSON or is a recognized-shape file from somewhere else. Accepts
 * the full envelope, a bare entries array, and the legacy `{ entries }` shape.
 */
export function parseBackup(rawText: string): ParsedBackup | null {
  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    return null;
  }

  if (Array.isArray(raw)) {
    const { entries, dropped } = sanitizeEntries(raw);
    return { entries, profile: {}, dropped };
  }

  if (!isRecord(raw)) return null;

  // A `format` field means this claims to be one of our files; reject foreign
  // formats and newer versions rather than guess at their shape.
  if ('format' in raw && (raw.format !== BACKUP_FORMAT || raw.version !== BACKUP_VERSION)) {
    return null;
  }

  const rawEntries = raw.entries ?? [];
  if (!Array.isArray(rawEntries)) return null;

  const { entries, dropped } = sanitizeEntries(rawEntries);
  return { entries, profile: sanitizeProfile(raw.profile), dropped };
}