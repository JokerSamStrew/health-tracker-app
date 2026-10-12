/**
 * Mood tags.
 *
 * A day's note is an ordered list of mood tags (`DailyEntry.moods`) rather than
 * a free-form string, and the mood panel counts how often each tag appears in
 * the analysis window.
 *
 * Pure by design: no React, no DOM, no clock. Normalisation lives here so the
 * entry form, the storage sanitizer and the backup importer all agree on what
 * counts as a valid tag.
 */

import type { DailyEntry } from '../types.ts';

/** Longest a single tag may be after normalisation. */
export const MAX_MOOD_TAG_LENGTH = 40;

/** Most tags a single day may carry. */
export const MAX_MOOD_TAGS = 20;

export interface MoodTagGroup {
    /** Short label shown above a group of tags. */
    name: string;
    tags: string[];
}

/** The palette the form offers, grouped so a long list stays scannable. */
export const MOOD_TAG_GROUPS: MoodTagGroup[] = [
    {
        name: 'Simple',
        tags: ['Happy', 'Sad', 'Anxious', 'Angry', 'Neutral'],
    },
    {
        name: 'Detailed',
        tags: [
            'Amused',
            'Apathetic',
            'Bored',
            'Burned out',
            'Calm',
            'Comfortable',
            'Compassionate',
            'Confident',
            'Confused',
            'Connected',
            'Content',
            'Contented',
            'Curious',
            'Determined',
            'Disappointed',
            'Disheartened',
            'Distracted',
            'Drained',
            'Embarrassed',
            'Empty',
            'Excited',
            'Exhausted',
            'Fearful',
            'Focused',
            'Frustrated',
            'Grateful',
            'Guilty',
            'Hopeful',
            'Hurt',
            'Impatient',
            'Indifferent',
            'Insecure',
            'Inspired',
            'Irritable',
            'Isolated',
            'Jealous',
            'Joyful',
            'Lethargic',
            'Lonely',
            'Loving',
            'Melancholy',
            'Mixed',
            'Motivated',
            'Nostalgic',
            'Numb',
            'Optimistic',
            'Overstimulated',
            'Overwhelmed',
            'Peaceful',
            'Playful',
            'Productive',
            'Proud',
            'Reflective',
            'Regretful',
            'Relaxed',
            'Resentful',
            'Rested',
            'Restless',
            'Serene',
            'Social',
            'Stressed',
            'Surprised',
            'Tense',
            'Thoughtful',
            'Uncertain',
            'Unmotivated',
            'Unsettled',
            'Vulnerable',
            'Withdrawn',
            'Worried',
        ],
    },
    {
        name: 'Energy',
        tags: ['High Energy', 'Balanced', 'Low Energy'],
    },
];

/** Every offered tag, flattened, in the order the groups declare them. */
export const MOOD_TAGS: string[] = MOOD_TAG_GROUPS.flatMap((group) => group.tags);

/** Trims and collapses whitespace, then caps the length. `null` when empty. */
export function normalizeMoodTag(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim().replace(/\s+/g, ' ');
    if (trimmed === '') return null;
    return trimmed.slice(0, MAX_MOOD_TAG_LENGTH);
}

/**
 * Normalises an unknown value into a de-duplicated (case-insensitive) list of
 * tags, capped at `MAX_MOOD_TAGS`. Accepts an array (the current shape) or a
 * comma-separated string, so the legacy `note` field migrates instead of being
 * discarded.
 */
export function normalizeMoods(value: unknown): string[] {
    const raw =
        typeof value === 'string' ? value.split(',') : Array.isArray(value) ? value : [];

    const seen = new Set<string>();
    const moods: string[] = [];
    for (const item of raw) {
        const tag = normalizeMoodTag(item);
        if (tag === null) continue;
        const key = tag.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        moods.push(tag);
        if (moods.length >= MAX_MOOD_TAGS) break;
    }
    return moods;
}

export interface MoodTagCount {
    /** Display form of the tag, taken from the first entry that used it. */
    tag: string;
    /** How many logged days carried the tag inside the window. */
    count: number;
}

/**
 * Counts how often each tag appears across entries. When `windowStart` and
 * `windowEnd` are given, only days inside that inclusive range contribute.
 * Ordering is by descending count, then alphabetically, so the pie and its
 * legend are stable regardless of entry order.
 */
export function countMoods(
    entries: readonly DailyEntry[],
    windowStart?: string,
    windowEnd?: string,
): MoodTagCount[] {
    const counts = new Map<string, MoodTagCount>();
    for (const entry of entries) {
        if (windowStart !== undefined && entry.date < windowStart) continue;
        if (windowEnd !== undefined && entry.date > windowEnd) continue;
        for (const tag of entry.moods ?? []) {
            const key = tag.toLowerCase();
            const existing = counts.get(key);
            if (existing) existing.count += 1;
            else counts.set(key, { tag, count: 1 });
        }
    }

    return [...counts.values()].sort(
        (a, b) => b.count - a.count || a.tag.localeCompare(b.tag),
    );
}
