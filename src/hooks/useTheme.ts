import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadTheme, resolveStorage, saveTheme, type StorageLike } from '../lib/storage.ts';
import type { ThemeMode } from '../types.ts';

export interface UseTheme {
  theme: ThemeMode;
  toggleTheme: () => void;
}

/** The OS color scheme, when exposed; otherwise light. */
function systemTheme(): ThemeMode {
  try {
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
  } catch {
    // Privacy modes can make matchMedia throw; light is a safe fallback.
  }
  return 'light';
}

/**
 * Theme state + persistence.
 *
 * The saved choice wins over the OS preference, so the setting is sticky, and
 * the resolved theme is mirrored onto `document.documentElement` via the
 * `data-theme` attribute that the dark CSS tokens hang off. The no-flash
 * script in `index.html` sets the attribute before React mounts, so a dark
 * user never sees a light flash.
 */
export function useTheme(storageOverride?: StorageLike): UseTheme {
  const storage = useMemo(() => storageOverride ?? resolveStorage(), [storageOverride]);

  // Read the persisted theme exactly once on mount.
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme(storage) ?? systemTheme());

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  }, []);

  // Apply and persist. Writing on mount is idempotent and keeps the attribute
  // in sync with the no-flash script even when nothing changed.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveTheme(storage, theme);
  }, [storage, theme]);

  return { theme, toggleTheme };
}