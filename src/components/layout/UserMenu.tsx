import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import '../../i18n/config'
import type { UserRole } from '../../api/generated/types'
import { ProfileAvatar } from '../../features/profile/ProfileAvatar'
import { canAccessSettings } from '../../auth/settingsAccess'
import {
  ClipboardListIcon,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
  type IconProps,
} from '../ui/icons'
import { announceHeaderMenuOpen, onOtherHeaderMenuOpen } from './headerMenuCoordination'
import { LANGUAGE_SWITCHER_MENU_ID } from './LanguageSwitcher'
import './user-menu.css'

const HEADER_MENU_ID = 'user-menu'

type UserMenuProps = {
  userName: string
  userRole: UserRole
  profileImageUrl?: string | null
  onSignOut: () => void
  variant: 'org' | 'admin'
  languageSwitcher?: ReactNode
}

type MenuAction = {
  id: string
  testId: string
  label: string
  icon: ComponentType<IconProps>
  kind: 'link' | 'button'
  to?: string
  onSelect?: () => void
}

export function UserMenu({ userName, userRole, profileImageUrl, onSignOut, variant, languageSwitcher }: UserMenuProps) {
  const { t } = useTranslation(['layout', 'common'])
  const [open, setOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLAnchorElement | HTMLButtonElement | null)[]>([])

  const close = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  const actions: MenuAction[] =
    variant === 'org'
      ? [
          {
            id: 'profile',
            testId: 'user-menu-item-profile',
            label: t('menu.profile'),
            icon: UserIcon,
            kind: 'link',
            to: '/profile',
          },
          {
            id: 'my-requests',
            testId: 'user-menu-item-my-requests',
            label: t('menu.myRequests'),
            icon: ClipboardListIcon,
            kind: 'link',
            to: '/my-leaves',
          },
          ...(canAccessSettings(userRole)
            ? [
                {
                  id: 'settings',
                  testId: 'user-menu-item-settings',
                  label: t('nav.settings'),
                  icon: SettingsIcon,
                  kind: 'link' as const,
                  to: '/settings',
                },
              ]
            : []),
          {
            id: 'sign-out',
            testId: 'user-menu-item-sign-out',
            label: t('menu.signOut'),
            icon: LogOutIcon,
            kind: 'button',
            onSelect: () => void onSignOut(),
          },
        ]
      : [
          {
            id: 'profile',
            testId: 'user-menu-item-profile',
            label: t('menu.profile'),
            icon: UserIcon,
            kind: 'link',
            to: '/app-admin/profile',
          },
          {
            id: 'sign-out',
            testId: 'user-menu-item-sign-out',
            label: t('menu.signOut'),
            icon: LogOutIcon,
            kind: 'button',
            onSelect: () => void onSignOut(),
          },
        ]

  const focusItem = useCallback(
    (index: number) => {
      const total = actions.length
      const nextIndex = ((index % total) + total) % total
      setFocusedIndex(nextIndex)
      itemRefs.current[nextIndex]?.focus()
    },
    [actions.length],
  )

  const openMenu = useCallback(
    (focusFirst = true) => {
      setOpen(true)
      setFocusedIndex(focusFirst ? 0 : -1)
      announceHeaderMenuOpen(HEADER_MENU_ID)
      if (focusFirst) {
        requestAnimationFrame(() => {
          itemRefs.current[0]?.focus()
        })
      }
    },
    [],
  )

  useEffect(
    () =>
      onOtherHeaderMenuOpen(HEADER_MENU_ID, (openedId) => {
        // The compact LanguageSwitcher renders nested inside this menu's own panel;
        // its open announcement must not close its parent.
        if (openedId !== LANGUAGE_SWITCHER_MENU_ID) {
          setOpen(false)
        }
      }),
    [],
  )

  useEffect(() => {
    if (!open) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, close])

  function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
    if (!open) {
      return
    }
    const nextTarget = event.relatedTarget as Node | null
    if (!nextTarget || !containerRef.current?.contains(nextTarget)) {
      setOpen(false)
    }
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (open) {
        close()
      } else {
        openMenu()
      }
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) {
        openMenu()
      } else {
        focusItem(focusedIndex + 1)
      }
      return
    }

    if (event.key === 'ArrowUp' && open) {
      event.preventDefault()
      focusItem(focusedIndex - 1)
    }
  }

  function handleItemKeyDown(
    event: React.KeyboardEvent<HTMLAnchorElement | HTMLButtonElement>,
    index: number,
  ) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusItem(index + 1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusItem(index - 1)
      return
    }

    if (event.key === ' ' && event.currentTarget.tagName === 'A') {
      event.preventDefault()
      event.currentTarget.click()
    }
  }

  function handleNavigate() {
    setOpen(false)
  }

  function handleActionSelect(action: MenuAction) {
    action.onSelect?.()
    setOpen(false)
  }

  return (
    <div className="user-menu-wrap" ref={containerRef} onBlur={handleBlur}>
      <button
        ref={triggerRef}
        type="button"
        className="user-menu-trigger"
        aria-label={t('header.userMenu', { name: userName })}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="user-menu-panel"
        data-testid="user-menu-trigger"
        onClick={() => (open ? close() : openMenu(false))}
        onKeyDown={handleTriggerKeyDown}
      >
        <ProfileAvatar fullName={userName} profileImageUrl={profileImageUrl} />
      </button>

      {open ? (
        <div
          id="user-menu-panel"
          className="user-menu-panel"
          role="menu"
          aria-label={t('header.accountMenu')}
          data-testid="user-menu-panel"
        >
          <div className="user-menu-header">
            <div className="user-menu-name" title={userName}>{userName}</div>
            <div className="user-menu-role">{t(`common:roles.${roleKey(userRole)}`)}</div>
          </div>

          {languageSwitcher}

          {actions.map((action, index) => {
            const Icon = action.icon
            const showSeparator = action.id === 'sign-out'

            if (action.kind === 'link' && action.to) {
              return (
                <Fragment key={action.id}>
                  {showSeparator ? <div className="user-menu-separator" role="separator" /> : null}
                  <Link
                    ref={(node) => {
                      itemRefs.current[index] = node
                    }}
                    to={action.to}
                    role="menuitem"
                    className="user-menu-item"
                    data-testid={action.testId}
                    onClick={handleNavigate}
                    onKeyDown={(event) => handleItemKeyDown(event, index)}
                  >
                    <span className="user-menu-item-icon" aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    {action.label}
                  </Link>
                </Fragment>
              )
            }

            return (
              <Fragment key={action.id}>
                {showSeparator ? <div className="user-menu-separator" role="separator" /> : null}
                <button
                  ref={(node) => {
                    itemRefs.current[index] = node
                  }}
                  type="button"
                  role="menuitem"
                  className="user-menu-item"
                  data-testid={action.testId}
                  onClick={() => handleActionSelect(action)}
                  onKeyDown={(event) => handleItemKeyDown(event, index)}
                >
                  <span className="user-menu-item-icon" aria-hidden="true">
                    <Icon size={16} />
                  </span>
                  {action.label}
                </button>
              </Fragment>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function roleKey(role: UserRole): string {
  if (role === 'ORGANIZATION_ADMIN') return 'organizationAdmin'
  if (role === 'PLATFORM_ADMIN') return 'platformAdmin'
  return role.toLowerCase()
}
