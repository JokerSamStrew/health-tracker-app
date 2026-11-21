import { describe, expect, it } from 'vitest';
import { activityLabel, bmiLabel } from '../lib/health.ts';
import { formatShortDate } from '../lib/date.ts';
import { formatMetric, formatNumber } from '../lib/stats.ts';
import { moodGroupLabel, moodLabel } from '../i18n/moodText.ts';
import { translate, UI_STRINGS, type TranslationKey } from '../i18n/strings.ts';
import type { Locale } from '../types.ts';

const LOCALES: readonly Locale[] = ['en', 'ru'];

describe('UI strings', () => {
  it('has the same keys in English and Russian', () => {
    const enKeys = Object.keys(UI_STRINGS.en).sort();
    const ruKeys = Object.keys(UI_STRINGS.ru).sort();
    expect(ruKeys).toEqual(enKeys);
  });

  it('interpolates parameters and leaves unknown tokens alone', () => {
    expect(translate('en', 'app.lastDays', { days: 30 })).toBe('Last 30 days');
    expect(translate('ru', 'app.lastDays', { days: 30 })).toBe('Последние 30 дн.');
    expect(translate('en', 'app.lastDays', {})).toBe('Last {days} days');
  });

  it('keeps the English wording the existing tests rely on', () => {
    const keys: TranslationKey[] = [
      'app.title',
      'summary.healthScore',
      'insight.disclaimer',
      'chart.sevenDayAverage',
    ];
    expect(keys.map((key) => translate('en', key))).toEqual([
      'Health Tracker',
      'Health score',
      'This is a self-tracking tool, not medical advice. Estimates use standard population formulas and are only as good as the data you enter. Talk to a clinician before making significant changes to your diet, activity or medication.',
      '7-day average',
    ]);
  });

  it('renders every Russian string in Cyrillic (except codes and numbers)', () => {
    for (const [key, value] of Object.entries(UI_STRINGS.ru)) {
      if (key === 'app.footerCode' || key === 'language.english' || key === 'language.russian') {
        continue;
      }
      expect(value, key).toMatch(/[А-Яа-яЁё]/);
    }
  });
});

describe('locale-bound formatting', () => {
  it('formats numbers with locale-specific separators', () => {
    expect(formatNumber(12345, 0, 'en')).toBe('12,345');
    const ru = formatNumber(12345, 0, 'ru');
    expect(ru).not.toContain(',');
    expect(ru.replace(/[^\d]/g, '')).toBe('12345');
    expect(formatMetric(null, 1, 'ru')).toBe('—');
  });

  it('formats dates in the selected language', () => {
    expect(formatShortDate('2024-03-08', 'en')).toBe('Mar 8');
    expect(formatShortDate('2024-03-08', 'ru')).toMatch(/мар/);
    // Parsing is locale-independent: an invalid ISO date is returned as-is.
    expect(formatShortDate('nope', 'ru')).toBe('nope');
  });

  it.each(LOCALES)('resolves activity and BMI labels in %s', (locale) => {
    expect(activityLabel('moderate', locale)).toBe(translate(locale, 'activityLabel.moderate'));
    expect(bmiLabel('healthy', locale)).toBe(translate(locale, 'bmi.healthy'));
  });
});

describe('mood labels', () => {
  it('translates known tags in Russian and leaves English as stored', () => {
    expect(moodLabel('Happy', 'en')).toBe('Happy');
    expect(moodLabel('Happy', 'ru')).toBe('Счастливый');
    expect(moodLabel('Low Energy', 'ru')).toBe('Мало энергии');
  });

  it('falls back to the stored value for custom tags', () => {
    expect(moodLabel('My custom mood', 'ru')).toBe('My custom mood');
  });

  it('translates built-in group names and keeps unknown ones', () => {
    expect(moodGroupLabel('Simple', 'ru', 'Simple')).toBe('Простые');
    expect(moodGroupLabel('Simple', 'en', 'Simple')).toBe('Simple');
    expect(moodGroupLabel('Custom', 'ru', 'Custom')).toBe('Custom');
  });
});
