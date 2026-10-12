import { describe, expect, it } from 'vitest';
import {
  countMoods,
  MAX_MOOD_TAGS,
  MAX_MOOD_TAG_LENGTH,
  MOOD_TAGS,
  normalizeMoodTag,
  normalizeMoods,
} from '../lib/moods.ts';
import type { DailyEntry } from '../types.ts';

describe('normalizeMoodTag', () => {
  it('trims and collapses inner whitespace', () => {
    expect(normalizeMoodTag('  High   Energy ')).toBe('High Energy');
  });

  it('rejects empty and non-string input', () => {
    expect(normalizeMoodTag('   ')).toBeNull();
    expect(normalizeMoodTag(42)).toBeNull();
    expect(normalizeMoodTag(null)).toBeNull();
  });

  it('caps an over-long tag', () => {
    expect(normalizeMoodTag('x'.repeat(100))).toHaveLength(MAX_MOOD_TAG_LENGTH);
  });
});

describe('normalizeMoods', () => {
  it('de-duplicates case-insensitively, keeping the first casing', () => {
    expect(normalizeMoods(['Calm', 'calm', 'CALM'])).toEqual(['Calm']);
  });

  it('splits a legacy comma-separated string', () => {
    expect(normalizeMoods('Happy, Anxious , Happy')).toEqual(['Happy', 'Anxious']);
  });

  it('drops blanks and non-array, non-string input', () => {
    expect(normalizeMoods(['', '  ', 'Calm'])).toEqual(['Calm']);
    expect(normalizeMoods(undefined)).toEqual([]);
    expect(normalizeMoods({ x: 1 })).toEqual([]);
  });

  it('caps the number of tags', () => {
    const many = Array.from({ length: MAX_MOOD_TAGS + 5 }, (_value, index) => `tag-${index}`);
    expect(normalizeMoods(many)).toHaveLength(MAX_MOOD_TAGS);
  });
});

describe('countMoods', () => {
  const entries: DailyEntry[] = [
    { date: '2024-02-28', moods: ['Happy'] },
    { date: '2024-03-01', moods: ['Happy', 'Calm'] },
    { date: '2024-03-02', moods: ['Happy'] },
    { date: '2024-03-03', moods: ['Calm'] },
  ];

  it('counts occurrences and sorts by frequency then name', () => {
    expect(countMoods(entries)).toEqual([
      { tag: 'Happy', count: 3 },
      { tag: 'Calm', count: 2 },
    ]);
  });

  it('restricts the count to the inclusive window', () => {
    expect(countMoods(entries, '2024-03-01', '2024-03-02')).toEqual([
      { tag: 'Happy', count: 2 },
      { tag: 'Calm', count: 1 },
    ]);
  });

  it('ignores entries with no tags', () => {
    expect(countMoods([{ date: '2024-03-01', steps: 1 }])).toEqual([]);
  });
});

describe('catalog', () => {
  it('exposes a flat, unique tag list', () => {
    expect(MOOD_TAGS.length).toBeGreaterThan(0);
    expect(new Set(MOOD_TAGS).size).toBe(MOOD_TAGS.length);
  });
});
