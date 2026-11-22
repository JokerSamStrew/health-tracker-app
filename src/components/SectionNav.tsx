/**
 * Compact section menu, available at every screen size.
 *
 * The ids live here so the menu and the sections it points at cannot drift.
 */

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/context.tsx';
import type { TranslationKey } from '../i18n/strings.ts';

export const SECTION_IDS = {
  summary: 'section-summary',
  moods: 'section-moods',
  charts: 'section-charts',
  insights: 'section-insights',
  entry: 'section-entry',
  history: 'section-history',
  profile: 'section-profile',
  backup: 'section-backup',
} as const;

const SECTION_LINKS: { id: string; label: TranslationKey }[] = [
  { id: SECTION_IDS.summary, label: 'summary.ariaLabel' },
  { id: SECTION_IDS.moods, label: 'chart.moodTags' },
  { id: SECTION_IDS.charts, label: 'app.timelines' },
  { id: SECTION_IDS.insights, label: 'insight.ariaLabel' },
  { id: SECTION_IDS.entry, label: 'entry.log' },
  { id: SECTION_IDS.history, label: 'history.title' },
  { id: SECTION_IDS.profile, label: 'profile.title' },
  { id: SECTION_IDS.backup, label: 'backup.title' },
];

export function SectionNav() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Dismiss on outside interaction or Escape, and return focus to the toggle
    // so keyboard users are not stranded on a link inside a hidden panel.
    const onOutside = (event: MouseEvent | TouchEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="section-nav" ref={containerRef}>
      <div id="section-nav-sections" className="section-nav__panel" hidden={!open}>
        <p className="section-nav__title">{t('nav.sections')}</p>
        <nav aria-label={t('nav.sections')}>
          <ul className="section-nav__list">
            {SECTION_LINKS.map(({ id, label }) => (
              <li key={id}>
                <a className="section-nav__link" href={`#${id}`} onClick={() => setOpen(false)}>
                  {t(label)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <button
        ref={toggleRef}
        type="button"
        className="button button--ghost section-nav__toggle"
        aria-label={t('nav.sections')}
        aria-controls="section-nav-sections"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M3 5h14M3 10h14M3 15h14" />
        </svg>
      </button>
    </div>
  );
}
