import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { updateUserPreferences } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { applyDocumentLanguage, type SupportedLocale } from '../../i18n/documentLanguage'
import i18n from '../../i18n/config'
import { CheckIcon, GlobeIcon } from '../ui/icons'
import { useToast } from '../ui/useToast'
import { announceHeaderMenuOpen, onOtherHeaderMenuOpen } from './headerMenuCoordination'
import './language-switcher.css'

export const LANGUAGE_SWITCHER_MENU_ID = 'language-switcher'
const HEADER_MENU_ID = LANGUAGE_SWITCHER_MENU_ID
const locales: SupportedLocale[] = ['en', 'ar']

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation('layout')
  const { user, refreshUser } = useAuth()
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const selectRequestIdRef = useRef(0)
  const selected = user?.preferredLanguage === 'ar' ? 'ar' : 'en'

  useEffect(() => onOtherHeaderMenuOpen(HEADER_MENU_ID, () => setOpen(false)), [])

  useEffect(() => {
    if (!open) return undefined
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])

  async function select(locale: SupportedLocale) {
    const requestId = ++selectRequestIdRef.current
    const previousLocale = selected
    await i18n.changeLanguage(locale)
    applyDocumentLanguage(locale)
    setOpen(false)
    try {
      await updateUserPreferences({ preferredLanguage: locale })
      if (requestId !== selectRequestIdRef.current) {
        // A newer selection superseded this one while the request was in flight.
        return
      }
      await refreshUser()
    } catch {
      if (requestId !== selectRequestIdRef.current) {
        return
      }
      await i18n.changeLanguage(previousLocale)
      applyDocumentLanguage(previousLocale)
      showToast(t('language.saveFailed'), 'warning')
    }
  }

  return (
    <div
      className={`language-switcher${compact ? ' language-switcher--compact' : ''}`}
      ref={containerRef}
    >
      <button
        ref={triggerRef}
        type="button"
        className="language-switcher-trigger"
        aria-label={t('header.language')}
        aria-haspopup="true"
        aria-expanded={open}
        data-testid={compact ? 'mobile-language-switcher' : 'language-switcher'}
        onClick={() => {
          setOpen((current) => !current)
          announceHeaderMenuOpen(HEADER_MENU_ID)
        }}
      >
        <GlobeIcon size={18} />
        <span>{t(`language.${selected}`)}</span>
      </button>
      {open ? (
        <div className="language-switcher-panel" role="menu" data-testid="language-switcher-panel">
          {locales.map((locale) => (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={locale === selected}
              className="language-switcher-option"
              key={locale}
              onClick={() => void select(locale)}
            >
              <span>{t(`language.${locale}`)}</span>
              {locale === selected ? <CheckIcon size={16} aria-label={t('language.current')} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
