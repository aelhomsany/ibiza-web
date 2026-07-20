/**
 * Story 9.5 ATDD — keyboard contracts under dir=rtl (menus + modals).
 * No pixel assertions. Implemented; kept as a regression suite for both dirs.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserMenu } from '../components/layout/UserMenu'
import { Modal } from '../components/ui/Modal'
import { LanguageSwitcher } from '../components/layout/LanguageSwitcher'
import { AuthTestProvider, createMockAuthValue } from '../test/authTestUtils'
import { ToastProvider } from '../components/ui/ToastProvider'
import * as apiClient from '../api/client'
import { applyDocumentLanguage, DEFAULT_LOCALE } from './documentLanguage'
import i18n from './config'

function setRtl() {
  applyDocumentLanguage('ar')
  expect(document.documentElement).toHaveAttribute('dir', 'rtl')
}

describe('Story 9.5 ATDD — RTL keyboard contracts', () => {
  afterEach(async () => {
    vi.restoreAllMocks()
    await i18n.changeLanguage(DEFAULT_LOCALE)
    applyDocumentLanguage(DEFAULT_LOCALE)
  })

  it(
    '[P1] UserMenu Escape returns focus to avatar under dir=rtl — enable during RTL shell pass',
    async () => {
      setRtl()
      render(
        <MemoryRouter>
          <UserMenu userName="Sara" userRole="EMPLOYEE" onSignOut={vi.fn()} variant="org" />
        </MemoryRouter>,
      )

      const trigger = screen.getByTestId('user-menu-trigger')
      trigger.focus()
      await userEvent.keyboard('{Enter}')
      expect(screen.getByTestId('user-menu-panel')).toBeInTheDocument()

      await userEvent.keyboard('{Escape}')
      expect(screen.queryByTestId('user-menu-panel')).not.toBeInTheDocument()
      expect(trigger).toHaveFocus()
    },
  )

  it(
    '[P1] Modal cancel/Escape still closes under dir=rtl — enable during RTL modal pass',
    async () => {
      setRtl()
      const onClose = vi.fn()
      const opener = document.createElement('button')
      document.body.appendChild(opener)
      opener.focus()

      render(
        <Modal labelledBy="rtl-modal-title" onClose={onClose} testId="rtl-atdd-modal">
          <h2 id="rtl-modal-title">RTL modal</h2>
          <button type="button">Action</button>
        </Modal>,
      )

      fireEvent(screen.getByTestId('rtl-atdd-modal'), new Event('cancel', { cancelable: true }))
      expect(onClose).toHaveBeenCalledTimes(1)
      opener.remove()
    },
  )

  it(
    '[P0] LanguageSwitcher still updates lang/dir and PATCHes preference under RTL document — locale persistence regression',
    async () => {
      // Regression of Story 9.4 under dir=rtl starting state (e.g. after prior Arabic session)
      setRtl()
      const refreshUser = vi.fn().mockResolvedValue({ preferredLanguage: 'en' })
      vi.spyOn(apiClient, 'updateUserPreferences').mockResolvedValue({ preferredLanguage: 'en' } as never)

      render(
        <ToastProvider>
          <AuthTestProvider value={createMockAuthValue({ refreshUser })}>
            <LanguageSwitcher />
          </AuthTestProvider>
        </ToastProvider>,
      )

      await userEvent.click(screen.getByTestId('language-switcher'))
      await userEvent.click(screen.getByRole('menuitemradio', { name: 'English' }))

      expect(apiClient.updateUserPreferences).toHaveBeenCalledWith({ preferredLanguage: 'en' })
      expect(document.documentElement).toHaveAttribute('lang', 'en')
      expect(document.documentElement).toHaveAttribute('dir', 'ltr')
    },
  )
})
