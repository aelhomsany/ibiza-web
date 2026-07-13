import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_LOCALE } from './documentLanguage'
import enCommon from './locales/en/common.json'
import enErrors from './locales/en/errors.json'
import enLayout from './locales/en/layout.json'
import arCommon from './locales/ar/common.json'
import arErrors from './locales/ar/errors.json'
import arLayout from './locales/ar/layout.json'

void i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon, errors: enErrors, layout: enLayout },
    ar: { common: arCommon, errors: arErrors, layout: arLayout },
  },
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  defaultNS: 'common',
  interpolation: { escapeValue: false },
})

export default i18n
