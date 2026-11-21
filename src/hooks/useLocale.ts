import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadLocale, resolveStorage, saveLocale, type StorageLike } from '../lib/storage.ts';
import type { Locale } from '../types.ts';

export interface UseLocale {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Flips between English and Russian. Handy for a two-language toggle. */
  toggleLocale: () => void;
}

/**
 * Language state + persistence.
 *
 * Mirrors the resolved locale onto `document.documentElement.lang` so screen
 * readers and the browser's spell-checker follow the UI. The no-flash script in
 * `index.html` sets the attribute before React mounts; this effect keeps it in
 * sync afterwards. The saved choice is read exactly once on mount.
 */
export function useLocale(storageOverride?: StorageLike): UseLocale {
  const storage = useMemo(() => storageOverride ?? resolveStorage(), [storageOverride]);

  const [locale, setLocale] = useState<Locale>(() => loadLocale(storage) ?? 'en');

  const toggleLocale = useCallback(() => {
    setLocale((current) => (current === 'en' ? 'ru' : 'en'));
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    saveLocale(storage, locale);
  }, [storage, locale]);

  return { locale, setLocale, toggleLocale };
}
