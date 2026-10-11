import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, BACKUP_VERSION, buildBackup, parseBackup } from '../lib/backup.ts';

const EXPORTED_AT = '2024-03-14T12:00:00.000Z';

describe('buildBackup', () => {
  it('writes a versioned envelope with sorted entries and the profile', () => {
    const json = buildBackup(
      [
        { date: '2024-03-03', steps: 3 },
        { date: '2024-03-01', steps: 1, weightKg: 80 },
      ],
      { name: 'Sam', age: 30 },
      EXPORTED_AT,
    );
    const parsed = JSON.parse(json) as Record<string, unknown>;

    expect(parsed.format).toBe(BACKUP_FORMAT);
    expect(parsed.version).toBe(BACKUP_VERSION);
    expect(parsed.exportedAt).toBe(EXPORTED_AT);
    expect(parsed.profile).toEqual({ name: 'Sam', age: 30 });
    expect((parsed.entries as Array<{ date: string }>).map((entry) => entry.date)).toEqual([
      '2024-03-01',
      '2024-03-03',
    ]);
  });
});

describe('parseBackup', () => {
  it('round-trips an export', () => {
    const entries = [{ date: '2024-03-01', steps: 9000, weightKg: 80 }];
    const profile = { name: 'Sam', age: 30, sex: 'male' as const };
    const result = parseBackup(buildBackup(entries, profile, EXPORTED_AT));

    expect(result).toEqual({ entries, profile, dropped: 0 });
  });

  it('rejects invalid JSON', () => {
    expect(parseBackup('{ not json')).toBeNull();
  });

  it('rejects a file claiming to be from another app or version', () => {
    expect(
      parseBackup(JSON.stringify({ format: 'other-app', version: 1, entries: [] })),
    ).toBeNull();
    expect(
      parseBackup(
        JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION + 1, entries: [] }),
      ),
    ).toBeNull();
  });

  it('rejects JSON that is neither an object nor an array', () => {
    expect(parseBackup('"just a string"')).toBeNull();
    expect(parseBackup('42')).toBeNull();
    expect(parseBackup('null')).toBeNull();
  });

  it('accepts a bare entries array', () => {
    const result = parseBackup(JSON.stringify([{ date: '2024-03-01', steps: '5000' }]));

    expect(result?.entries).toEqual([{ date: '2024-03-01', steps: 5000 }]);
    expect(result?.profile).toEqual({});
    expect(result?.dropped).toBe(0);
  });

  it('accepts the legacy { entries } storage shape', () => {
    const result = parseBackup(
      JSON.stringify({ entries: [{ date: '2024-03-01', steps: 5000 }] }),
    );

    expect(result?.entries).toEqual([{ date: '2024-03-01', steps: 5000 }]);
  });

  it('sanitizes entries and reports how many were dropped', () => {
    const result = parseBackup(
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: EXPORTED_AT,
        entries: [
          { date: '2024-03-01', steps: '9500' },
          { date: 'nope' },
          { date: '2024-03-02', weightKg: 5 },
        ],
      }),
    );

    // Only the invalid date is dropped: an out-of-range metric is stripped but
    // the day survives as a date-only entry, matching `sanitizeEntry`.
    expect(result?.dropped).toBe(1);
    expect(result?.entries).toEqual([
      { date: '2024-03-01', steps: 9500 },
      { date: '2024-03-02' },
    ]);
  });

  it('sanitizes the profile', () => {
    const result = parseBackup(
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: EXPORTED_AT,
        entries: [],
        profile: { age: '30', isAdmin: true, sex: 'other' },
      }),
    );

    expect(result?.profile).toEqual({ age: 30 });
  });

  it('falls back to empty state when entries or profile are missing', () => {
    const result = parseBackup(
      JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: EXPORTED_AT }),
    );

    expect(result?.entries).toEqual([]);
    expect(result?.profile).toEqual({});
    expect(result?.dropped).toBe(0);
  });
});