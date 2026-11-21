/**
 * React-facing i18n API.
 *
 * The provider owns only language state; every string and formatter is a pure
 * function of the locale, so components can call `useI18n()` without a store.
 * Insights get their text through a separate injected translator (see
 * `insightText.ts`) to keep `src/lib/` free of React.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useLocale } from '../hooks/useLocale.ts';
import { formatLongDate, formatShortDate } from '../lib/date.ts';
import { formatMetric, formatNumber, formatSigned } from '../lib/stats.ts';
import type { Locale } from '../types.ts';
import { moodGroupLabel, moodLabel } from './moodText.ts';
import { translate, type TranslationKey } from './strings.ts';

export interface PluralForms {
  one: TranslationKey;
  few: TranslationKey;
  many: TranslationKey;
}

export interface I18n {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  /** Translate a key, replacing `{name}` tokens from `params`. */
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  /** Pick the right word form for a count (1 запись / 2 записи / 5 записей). */
  plural: (count: number, forms: PluralForms) => string;
  formatNumber: (value: number, digits?: number) => string;
  formatMetric: (value: number | null | undefined, digits?: number) => string;
  formatSigned: (value: number | null | undefined, digits?: number) => string;
  formatShortDate: (iso: string) => string;
  formatLongDate: (iso: string) => string;
  moodLabel: (tag: string) => string;
  moodGroupLabel: (name: string, fallback: string) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { locale, setLocale, toggleLocale } = useLocale();

  const value = useMemo<I18n>(() => {
    const pluralRules = new Intl.PluralRules(locale === 'ru' ? 'ru-RU' : 'en-US');
    return {
      locale,
      setLocale,
      toggleLocale,
      t: (key, params) => translate(locale, key, params),
      plural: (count, forms) => {
        const category = pluralRules.select(count);
        // English has no 'few'/'many' split, so both map to the generic form.
        const key = category === 'one' ? forms.one : locale === 'ru' && category === 'few'
          ? forms.few
          : forms.many;
        return translate(locale, key);
      },
      formatNumber: (number, digits = 0) => formatNumber(number, digits, locale),
      formatMetric: (number, digits = 1) => formatMetric(number, digits, locale),
      formatSigned: (number, digits = 1) => formatSigned(number, digits, locale),
      formatShortDate: (iso) => formatShortDate(iso, locale),
      formatLongDate: (iso) => formatLongDate(iso, locale),
      moodLabel: (tag) => moodLabel(tag, locale),
      moodGroupLabel: (name, fallback) => moodGroupLabel(name, locale, fallback),
    };
  }, [locale, setLocale, toggleLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside an I18nProvider');
  return value;
}
