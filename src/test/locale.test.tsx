import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.tsx';
import { I18nProvider } from '../i18n/context.tsx';
import { createMemoryStorage, STORAGE_KEYS } from '../lib/storage.ts';

/**
 * End-to-end language coverage: a saved Russian locale must reach the header,
 * charts, analysis and footer, and the toggle must switch the whole UI back.
 */
describe('Russian UI', () => {
  beforeAll(() => {
    // Recharts measures its container; jsdom reports 0x0 without these stubs.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 800,
      height: 240,
      top: 0,
      right: 800,
      bottom: 240,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly callback: ResizeObserverCallback) {}
        observe(target: Element): void {
          const rect = { width: 800, height: 240 } as DOMRectReadOnly;
          this.callback([{ target, contentRect: rect } as ResizeObserverEntry], this as never);
        }
        unobserve(): void {}
        disconnect(): void {}
      },
    );
  });

  beforeEach(() => {
    // Node's experimental localStorage can be undefined under jsdom, so give
    // the hook a predictable in-memory store with Russian already selected.
    vi.stubGlobal('localStorage', createMemoryStorage({ [STORAGE_KEYS.locale]: 'ru' }));
  });

  afterEach(() => {
    document.documentElement.lang = 'en';
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders the whole shell in Russian from a saved locale', () => {
    render(
      <I18nProvider>
        <App />
      </I18nProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Дневник здоровья' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /загрузить пример/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Графики' })).toBeInTheDocument();
    expect(screen.getAllByText('Индекс здоровья').length).toBeGreaterThan(0);
    expect(screen.getByRole('region', { name: 'Анализ' })).toBeInTheDocument();
    expect(screen.getByText(/не медицинская консультация/i)).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('ru');
  });

  it('translates insights as well as static UI copy', () => {
    render(
      <I18nProvider>
        <App />
      </I18nProvider>,
    );

    // With no entries the insufficient-data rule is the only insight; it must
    // come from the injected Russian translator, not from English literals.
    expect(screen.getAllByText('Пока недостаточно данных').length).toBeGreaterThan(0);
  });

  it('switches back to English and persists the choice', async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <App />
      </I18nProvider>,
    );

    await user.click(screen.getByRole('button', { name: /переключиться на английский/i }));

    expect(screen.getByRole('heading', { name: 'Health Tracker' })).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEYS.locale)).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });
});
