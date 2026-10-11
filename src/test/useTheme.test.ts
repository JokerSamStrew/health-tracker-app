import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTheme } from '../hooks/useTheme.ts';
import { createMemoryStorage, STORAGE_KEYS } from '../lib/storage.ts';

afterEach(() => {
  // Leave the document as the tests found it; the hook mirrors state there.
  document.documentElement.removeAttribute('data-theme');
  Reflect.deleteProperty(window, 'matchMedia');
});

// jsdom has no matchMedia, so define the shape the hook reads, per test.
function stubDarkScheme(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue({
      matches,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

describe('useTheme', () => {
  it('defaults to light with nothing saved and no system preference', () => {
    const { result } = renderHook(() => useTheme(createMemoryStorage()));

    expect(result.current.theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('honours a saved dark theme', () => {
    const storage = createMemoryStorage({ [STORAGE_KEYS.theme]: 'dark' });
    const { result } = renderHook(() => useTheme(storage));

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('falls back to the system preference when nothing is saved', () => {
    stubDarkScheme(true);
    const { result } = renderHook(() => useTheme(createMemoryStorage()));

    expect(result.current.theme).toBe('dark');
  });

  it('lets a saved choice win over the system preference', () => {
    stubDarkScheme(true);
    const storage = createMemoryStorage({ [STORAGE_KEYS.theme]: 'light' });
    const { result } = renderHook(() => useTheme(storage));

    expect(result.current.theme).toBe('light');
  });

  it('toggles and persists, and flips it back', () => {
    const storage = createMemoryStorage();
    const { result } = renderHook(() => useTheme(storage));

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('dark');
    expect(storage.getItem(STORAGE_KEYS.theme)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('light');
    expect(storage.getItem(STORAGE_KEYS.theme)).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});