import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { applyDocumentLanguage, DEFAULT_LOCALE, getStoredPreferredLanguage } from './documentLanguage'
import enCommon from './locales/en/common.json'
import enErrors from './locales/en/errors.json'
import enLayout from './locales/en/layout.json'
import enCalendar from './locales/en/calendar.json'
import enDashboard from './locales/en/dashboard.json'
import enLeaves from './locales/en/leaves.json'
import enApprovals from './locales/en/approvals.json'
import enSettings from './locales/en/settings.json'
import enProfile from './locales/en/profile.json'
import enAuth from './locales/en/auth.json'
import enPlatform from './locales/en/platform.json'
import enPlatformAuth from './locales/en/platformAuth.json'
import enPublic from './locales/en/public.json'
import enBilling from './locales/en/billing.json'
import enOnboarding from './locales/en/onboarding.json'
import enReports from './locales/en/reports.json'
import arCommon from './locales/ar/common.json'
import arErrors from './locales/ar/errors.json'
import arLayout from './locales/ar/layout.json'
import arCalendar from './locales/ar/calendar.json'
import arDashboard from './locales/ar/dashboard.json'
import arLeaves from './locales/ar/leaves.json'
import arApprovals from './locales/ar/approvals.json'
import arSettings from './locales/ar/settings.json'
import arProfile from './locales/ar/profile.json'
import arAuth from './locales/ar/auth.json'
import arPlatform from './locales/ar/platform.json'
import arPlatformAuth from './locales/ar/platformAuth.json'
import arPublic from './locales/ar/public.json'
import arBilling from './locales/ar/billing.json'
import arOnboarding from './locales/ar/onboarding.json'
import arReports from './locales/ar/reports.json'

const initialLocale = getStoredPreferredLanguage()
applyDocumentLanguage(initialLocale)

void i18n.use(initReactI18next).init({
  resources: {
    en: {
      approvals: enApprovals,
      billing: enBilling,
      auth: enAuth,
      calendar: enCalendar,
      common: enCommon,
      dashboard: enDashboard,
      errors: enErrors,
      layout: enLayout,
      leaves: enLeaves,
      onboarding: enOnboarding,
      platform: enPlatform,
      platformAuth: enPlatformAuth,
      profile: enProfile,
      public: enPublic,
      reports: enReports,
      settings: enSettings,
    },
    ar: {
      approvals: arApprovals,
      billing: arBilling,
      auth: arAuth,
      calendar: arCalendar,
      common: arCommon,
      dashboard: arDashboard,
      errors: arErrors,
      layout: arLayout,
      leaves: arLeaves,
      onboarding: arOnboarding,
      platform: arPlatform,
      platformAuth: arPlatformAuth,
      profile: arProfile,
      public: arPublic,
      reports: arReports,
      settings: arSettings,
    },
  },
  lng: initialLocale,
  fallbackLng: DEFAULT_LOCALE,
  defaultNS: 'common',
  returnNull: false,
  parseMissingKeyHandler: (key) => {
    if (import.meta.env.DEV) {
      console.warn(`[i18n] missing translation key: ${key}`)
    }
    return ''
  },
  interpolation: { escapeValue: false },
})

export default i18n
