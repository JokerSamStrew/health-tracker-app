/**
 * Date helpers for `YYYY-MM-DD` calendar dates.
 *
 * Everything is done in the local timezone and at noon to sidestep DST shifts,
 * because the app groups measurements by *calendar* day, not by elapsed hours.
 */

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` for a `Date`, in local time. */
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parses `YYYY-MM-DD` into a local `Date` at noon, or `null` when malformed. */
export function fromISODate(iso: string): Date | null {
  if (!ISO_DATE_PATTERN.test(iso)) return null;
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  // Guards against overflow like 2024-02-31 -> 2024-03-02.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

export function isValidISODate(iso: string): boolean {
  return fromISODate(iso) !== null;
}

export function addDays(iso: string, amount: number): string {
  const date = fromISODate(iso);
  if (!date) return iso;
  date.setDate(date.getDate() + amount);
  return toISODate(date);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number | null {
  const a = fromISODate(from);
  const b = fromISODate(to);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Whole completed years from `birthDate` up to `onDate`, so someone born on
 * 1994-03-14 is 30 on 2024-03-14 but still 29 on 2024-03-13.
 * Returns `null` when either date is malformed or `birthDate` is in the future.
 */
export function ageFromBirthDate(birthDate: string, onDate: string): number | null {
  const birth = fromISODate(birthDate);
  const now = fromISODate(onDate);
  if (!birth || !now) return null;
  let age = now.getFullYear() - birth.getFullYear();
  const birthdayDone =
    now.getMonth() > birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  if (!birthdayDone) age -= 1;
  return age < 0 ? null : age;
}

/** Inclusive list of dates from `start` to `end`, ascending. */
export function dateRange(start: string, end: string): string[] {
  const span = daysBetween(start, end);
  if (span === null || span < 0) return [];
  const dates: string[] = [];
  for (let i = 0; i <= span; i += 1) dates.push(addDays(start, i));
  return dates;
}

/** The last `days` calendar days ending at `end` (inclusive). */
export function lastNDays(end: string, days: number): string[] {
  if (days <= 0) return [];
  return dateRange(addDays(end, -(days - 1)), end);
}

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** `"2024-03-08"` -> `"Mar 8"`. Invalid input is returned unchanged. */
export function formatShortDate(iso: string): string {
  const date = fromISODate(iso);
  if (!date) return iso;
  return `${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`;
}

/** `"2024-03-08"` -> `"Fri, Mar 8, 2024"`. */
export function formatLongDate(iso: string): string {
  const date = fromISODate(iso);
  if (!date) return iso;
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}