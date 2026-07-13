export type SupportedLocale = 'en' | 'ar'

export const DEFAULT_LOCALE: SupportedLocale = 'en'

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return value === 'en' || value === 'ar'
}

export function applyDocumentLanguage(locale: string | null | undefined): SupportedLocale {
  const resolved = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE
  document.documentElement.lang = resolved
  document.documentElement.dir = resolved === 'ar' ? 'rtl' : 'ltr'
  return resolved
}
