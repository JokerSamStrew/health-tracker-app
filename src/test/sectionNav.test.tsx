import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.tsx';
import { I18nProvider } from '../i18n/context.tsx';
import { createMemoryStorage, STORAGE_KEYS } from '../lib/storage.ts';

/** The menu must reach every section that actually exists in the app. */
describe('Section menu', () => {
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

  afterEach(() => {
    document.documentElement.lang = 'en';
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('links to real sections and closes after a jump', async () => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <App />
      </I18nProvider>,
    );

    const toggle = screen.getByRole('button', { name: 'Sections' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('section-nav-sections')).toHaveAttribute('hidden');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(8);
    // Moods now live inside the charts section rather than having their own.
    expect(screen.queryByRole('link', { name: 'Mood tags' })).not.toBeInTheDocument();
    expect(document.getElementById('section-moods')).toBeNull();
    const chartGrid = document.querySelector('#section-charts .charts__grid');
    expect(chartGrid).toContainElement(document.getElementById('mood-chart')!);
    expect(screen.getByRole('link', { name: 'Goal pace' })).toHaveAttribute(
      'href',
      '#section-goal-plan',
    );
    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      expect(href).toMatch(/^#section-/);
      expect(document.getElementById(href.slice(1))).not.toBeNull();
    }

    await user.click(screen.getByRole('link', { name: 'Insights' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('dismisses with Escape and restores focus to the toggle', async () => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <App />
      </I18nProvider>,
    );

    const toggle = screen.getByRole('button', { name: 'Sections' });
    await user.click(toggle);
    await user.keyboard('{Escape}');

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
  });

  it('uses translated section names', async () => {
    vi.stubGlobal(
      'localStorage',
      createMemoryStorage({ [STORAGE_KEYS.locale]: 'ru' }),
    );
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <App />
      </I18nProvider>,
    );

    const toggle = screen.getByRole('button', { name: 'Разделы' });
    await user.click(toggle);

    expect(screen.getByRole('link', { name: 'Анализ' })).toHaveAttribute(
      'href',
      '#section-insights',
    );
    expect(screen.getByRole('link', { name: 'Темп к целям' })).toHaveAttribute(
      'href',
      '#section-goal-plan',
    );
  });
});
