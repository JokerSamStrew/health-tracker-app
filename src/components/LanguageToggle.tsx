import { useI18n } from '../i18n/context.tsx';
import type { Locale } from '../types.ts';

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.8 5.6 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.6-3.8-9S9.5 5.5 12 3z" />
    </svg>
  );
}

/** Flips the UI language; the label names the language it will switch to. */
export function LanguageToggle() {
  const { locale, toggleLocale, t } = useI18n();
  const next: Locale = locale === 'en' ? 'ru' : 'en';

  return (
    <button
      type="button"
      className="button button--ghost language-toggle"
      onClick={toggleLocale}
      aria-label={next === 'ru' ? t('language.switchToRussian') : t('language.switchToEnglish')}
    >
      <GlobeIcon />
      <span>{next === 'ru' ? t('language.russian') : t('language.english')}</span>
    </button>
  );
}
