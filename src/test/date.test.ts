import { describe, expect, it } from 'vitest';
import {
  addDays,
  ageFromBirthDate,
  dateRange,
  daysBetween,
  formatLongDate,
  formatShortDate,
  fromISODate,
  isValidISODate,
  lastNDays,
  toISODate,
} from '../lib/date.ts';

describe('toISODate', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(toISODate(new Date(2024, 2, 8, 14, 30))).toBe('2024-03-08');
  });

  it('zero-pads single digits', () => {
    expect(toISODate(new Date(2024, 0, 5))).toBe('2024-01-05');
  });

  it('round-trips with fromISODate', () => {
    expect(toISODate(fromISODate('2024-11-30')!)).toBe('2024-11-30');
  });
});

describe('fromISODate', () => {
  it('parses a valid date at local noon', () => {
    const date = fromISODate('2024-03-08')!;
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(8);
    expect(date.getHours()).toBe(12);
  });

  it('returns null for a malformed string', () => {
    expect(fromISODate('08/03/2024')).toBeNull();
    expect(fromISODate('')).toBeNull();
    expect(fromISODate('2024-3-8')).toBeNull();
    expect(fromISODate('nonsense')).toBeNull();
  });

  it('rejects dates that overflow into the next month', () => {
    expect(fromISODate('2024-02-31')).toBeNull();
    expect(fromISODate('2023-02-29')).toBeNull();
  });

  it('accepts a real leap day', () => {
    expect(fromISODate('2024-02-29')).not.toBeNull();
  });
});

describe('isValidISODate', () => {
  it('mirrors fromISODate', () => {
    expect(isValidISODate('2024-03-08')).toBe(true);
    expect(isValidISODate('2024-02-31')).toBe(false);
  });
});

describe('addDays', () => {
  it('moves forward', () => {
    expect(addDays('2024-03-08', 3)).toBe('2024-03-11');
  });

  it('moves backward', () => {
    expect(addDays('2024-03-08', -8)).toBe('2024-02-29');
  });

  it('crosses a year boundary', () => {
    expect(addDays('2023-12-31', 1)).toBe('2024-01-01');
    expect(addDays('2024-01-01', -1)).toBe('2023-12-31');
  });

  it('crosses a leap day', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
  });

  it('is zero-stable', () => {
    expect(addDays('2024-03-08', 0)).toBe('2024-03-08');
  });

  it('returns the input unchanged when it is invalid', () => {
    expect(addDays('bad-date', 5)).toBe('bad-date');
  });
});

describe('daysBetween', () => {
  it('counts whole days forward', () => {
    expect(daysBetween('2024-03-01', '2024-03-08')).toBe(7);
  });

  it('is negative when reversed', () => {
    expect(daysBetween('2024-03-08', '2024-03-01')).toBe(-7);
  });

  it('is 0 for the same date', () => {
    expect(daysBetween('2024-03-08', '2024-03-08')).toBe(0);
  });

  it('spans a leap year correctly', () => {
    expect(daysBetween('2024-01-01', '2025-01-01')).toBe(366);
    expect(daysBetween('2023-01-01', '2024-01-01')).toBe(365);
  });

  it('returns null for invalid dates', () => {
    expect(daysBetween('2024-02-31', '2024-03-08')).toBeNull();
  });
});

describe('dateRange', () => {
  it('is inclusive on both ends', () => {
    expect(dateRange('2024-03-01', '2024-03-04')).toEqual([
      '2024-03-01',
      '2024-03-02',
      '2024-03-03',
      '2024-03-04',
    ]);
  });

  it('returns a single date when start equals end', () => {
    expect(dateRange('2024-03-01', '2024-03-01')).toEqual(['2024-03-01']);
  });

  it('returns an empty array when end is before start', () => {
    expect(dateRange('2024-03-04', '2024-03-01')).toEqual([]);
  });

  it('has the right length for a long span', () => {
    expect(dateRange('2024-01-01', '2024-12-31')).toHaveLength(366);
  });
});

describe('lastNDays', () => {
  it('returns exactly N days ending at the given date', () => {
    const range = lastNDays('2024-03-08', 5);
    expect(range).toEqual(['2024-03-04', '2024-03-05', '2024-03-06', '2024-03-07', '2024-03-08']);
  });

  it('always ends on the reference date', () => {
    const range = lastNDays('2024-03-08', 14);
    expect(range.at(-1)).toBe('2024-03-08');
    expect(range).toHaveLength(14);
  });

  it('returns an empty array for a non-positive size', () => {
    expect(lastNDays('2024-03-08', 0)).toEqual([]);
    expect(lastNDays('2024-03-08', -3)).toEqual([]);
  });
});

describe('formatShortDate', () => {
  it('formats as "Mon D"', () => {
    expect(formatShortDate('2024-03-08')).toBe('Mar 8');
  });

  it('returns the raw string when the date is invalid', () => {
    expect(formatShortDate('not-a-date')).toBe('not-a-date');
  });
});

describe('formatLongDate', () => {
  it('includes weekday, year, month and day', () => {
    expect(formatLongDate('2024-03-08')).toBe('Fri, Mar 8, 2024');
  });

  it('returns the raw string when the date is invalid', () => {
    expect(formatLongDate('bad')).toBe('bad');
  });
});

describe('ageFromBirthDate', () => {
  it('counts whole completed years', () => {
    // Turns 30 exactly on the reference date, so it counts as 30.
    expect(ageFromBirthDate('1994-03-14', '2024-03-14')).toBe(30);
    // A day before the birthday means the 30th is not complete yet.
    expect(ageFromBirthDate('1994-03-15', '2024-03-14')).toBe(29);
    // The birthday has passed months ago, so the full years count.
    expect(ageFromBirthDate('1984-01-01', '2024-03-14')).toBe(40);
  });

  it('treats a leap-day birthday as elapsed from 1 March in common years', () => {
    // Born 2000-02-29: 24 on 2024-03-01, but still 23 on 2024-02-28.
    expect(ageFromBirthDate('2000-02-29', '2024-03-01')).toBe(24);
    expect(ageFromBirthDate('2000-02-29', '2024-02-28')).toBe(23);
  });

  it('returns null when either date is malformed', () => {
    expect(ageFromBirthDate('1994-02-31', '2024-03-14')).toBeNull();
    expect(ageFromBirthDate('1994-03-14', 'not-a-date')).toBeNull();
    expect(ageFromBirthDate('', '2024-03-14')).toBeNull();
  });

  it('returns null when the birth date is in the future', () => {
    expect(ageFromBirthDate('2025-01-01', '2024-03-14')).toBeNull();
  });
});