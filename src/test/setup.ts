import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Unmount any component left behind by a failing test.
afterEach(() => {
  cleanup();
});

// Node's experimental `localStorage` can shadow the jsdom one and be undefined
// when no `--localstorage-file` is passed, so probe before touching it.
function clearBrowserStorage(): void {
  try {
    globalThis.localStorage?.clear();
  } catch {
    // Storage is unavailable in this environment; nothing to clear.
  }
}

afterEach(clearBrowserStorage);