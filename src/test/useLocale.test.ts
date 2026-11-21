import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLocale } from '../hooks/useLocale.ts';
import { createMemoryStorage, STORAGE_KEYS } from '../lib/storage.ts';

afterEach(() => {
  document.documentElement.lang = 'en';
});

describe('useLocale', () => {
  it('defaults to English with nothing saved', () => {
    const { result } = renderHook(() => useLocale(createMemoryStorage()));

    expect(result.current.locale).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('honours a saved Russian choice', () => {
    const storage = createMemoryStorage({ [STORAGE_KEYS.locale]: 'ru' });
    const { result } = renderHook(() => useLocale(storage));

    expect(result.current.locale).toBe('ru');
    expect(document.documentElement.lang).toBe('ru');
  });

  it('ignores an unknown saved value', () => {
    const storage = createMemoryStorage({ [STORAGE_KEYS.locale]: 'fr' });
    const { result } = renderHook(() => useLocale(storage));

    expect(result.current.locale).toBe('en');
  });

  it('toggles and persists the choice, and flips it back', () => {
    const storage = createMemoryStorage();
    const { result } = renderHook(() => useLocale(storage));

    act(() => {
      result.current.toggleLocale();
    });
    expect(result.current.locale).toBe('ru');
    expect(storage.getItem(STORAGE_KEYS.locale)).toBe('ru');
    expect(document.documentElement.lang).toBe('ru');

    act(() => {
      result.current.toggleLocale();
    });
    expect(result.current.locale).toBe('en');
    expect(storage.getItem(STORAGE_KEYS.locale)).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('allows setting a locale directly', () => {
    const storage = createMemoryStorage();
    const { result } = renderHook(() => useLocale(storage));

    act(() => {
      result.current.setLocale('ru');
    });
    expect(result.current.locale).toBe('ru');
    expect(storage.getItem(STORAGE_KEYS.locale)).toBe('ru');
  });
});
