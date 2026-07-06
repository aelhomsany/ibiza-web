import type { ReactNode } from 'react'
import { MenuIcon, CloseIcon, UmbrellaIcon } from '../ui/icons'
import './app-header.css'

type AppHeaderProps = {
  variant: 'org' | 'admin'
  /** Brand title shown next to the hamburger below 900px. */
  title: string
  /** Organization name (org shell) or platform context label (admin shell); desktop only. */
  contextLabel?: string | null
  /** Right-aligned header actions (e.g. notification bell). */
  actions?: ReactNode
  /** Mobile drawer state — the hamburger is hidden on desktop. */
  navOpen: boolean
  onToggleNav: () => void
}

/**
 * Persistent shell header (UX-DR29). Above the 900px breakpoint: white bar
 * right of the sidebar with the context label and actions. At or below 900px
 * it doubles as the mobile top bar: teal, hamburger for the drawer, brand.
 */
export function AppHeader({
  variant,
  title,
  contextLabel,
  actions,
  navOpen,
  onToggleNav,
}: AppHeaderProps) {
  return (
    <header
      className={`app-header app-header--${variant}`}
      data-testid="app-header"
    >
      <button
        type="button"
        className="app-header-menu"
        aria-expanded={navOpen}
        aria-controls="app-sidebar"
        aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
        data-testid="shell-topbar-menu"
        onClick={onToggleNav}
      >
        {navOpen ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
      </button>
      <span className="app-header-brand" aria-hidden="true">
        <UmbrellaIcon size={18} />
      </span>
      <span className="app-header-brand-title">{title}</span>
      {contextLabel ? (
        <span
          className="app-header-context"
          title={contextLabel}
          data-testid="app-header-context"
        >
          {contextLabel}
        </span>
      ) : null}
      <div className="app-header-actions">{actions}</div>
    </header>
  )
}
