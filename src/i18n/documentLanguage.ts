export type SupportedLocale = 'en' | 'ar'

export const DEFAULT_LOCALE: SupportedLocale = 'en'
export const PREFERRED_LANGUAGE_STORAGE_KEY = 'ibiza.preferredLanguage'

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return value === 'en' || value === 'ar'
}

export function applyDocumentLanguage(locale: string | null | undefined): SupportedLocale {
  const resolved = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE
  document.documentElement.lang = resolved
  document.documentElement.dir = resolved === 'ar' ? 'rtl' : 'ltr'
  return resolved
}

export function getStoredPreferredLanguage(): SupportedLocale {
  try {
    const stored = window.localStorage.getItem(PREFERRED_LANGUAGE_STORAGE_KEY)
    return isSupportedLocale(stored) ? stored : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

export function storePreferredLanguage(locale: string | null | undefined): SupportedLocale {
  const resolved = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE
  try {
    window.localStorage.setItem(PREFERRED_LANGUAGE_STORAGE_KEY, resolved)
  } catch {
    // Storage can be unavailable in privacy-restricted contexts. The in-memory
    // locale and document direction still apply for the current session.
  }
  return resolved
}
