import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import en from './translations/en.json';
import am from './translations/am.json';
import om from './translations/om.json';

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 (Multi-Language Support): a small hand-rolled i18n context instead of
// react-i18next — this sandbox had no network access to verify a new npm
// dependency actually installs, same reasoning as the hand-rolled service
// worker in Phase 3. The public API (useTranslation() -> { t, locale,
// setLocale }) is intentionally similar to react-i18next's, so swapping to
// the real library later is a small, mechanical change if a future session
// has verified npm access and wants to.
// ─────────────────────────────────────────────────────────────────────────────

export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'am', label: 'አማርኛ' },
  { code: 'om', label: 'Afaan Oromoo' },
];

const RESOURCES = { en, am, om };
const STORAGE_KEY = 'timhirthub-locale';
const DEFAULT_LOCALE = 'en';

function getInitialLocale() {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && RESOURCES[stored]) return stored;
  return DEFAULT_LOCALE;
}

function lookup(dict, key) {
  return key.split('.').reduce((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), dict);
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(getInitialLocale);

  const setLocale = useCallback((next) => {
    if (!RESOURCES[next]) return;
    setLocaleState(next);
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  // t(key, fallback?) — looks up a dotted key ('nav.dashboard') in the active
  // locale, falling back to English, then to the provided fallback, then to
  // the key itself so a missing translation is visibly a key, not a crash.
  const t = useCallback((key, fallback) => {
    const value = lookup(RESOURCES[locale], key);
    if (value !== undefined) return value;
    const enValue = lookup(RESOURCES.en, key);
    if (enValue !== undefined) return enValue;
    return fallback ?? key;
  }, [locale]);

  const value = useMemo(() => ({ t, locale, setLocale, locales: SUPPORTED_LOCALES }), [t, locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation() must be used inside <I18nProvider>');
  return ctx;
}
