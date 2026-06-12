import { NavLink } from 'react-router-dom'
import { formatRole } from '../../auth/authUtils'
import type { UserRole } from '../../api/generated/types'
import './sidebar.css'

export type NavItem = {
  label: string
  path: string
  icon?: string
  end?: boolean
  testId?: string
}

type SidebarProps = {
  variant: 'org' | 'admin'
  navItems: NavItem[]
  userName?: string
  userRole?: UserRole
  onSignOut?: () => void
}

export function Sidebar({
  variant,
  navItems,
  userName = 'User',
  userRole = 'EMPLOYEE',
  onSignOut,
}: SidebarProps) {
  const variantClass = variant === 'org' ? 'sidebar--org' : 'sidebar--admin'

  return (
    <aside className={`sidebar ${variantClass}`} data-testid="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-icon" aria-hidden="true">
          🏖️
        </span>
        <div>
          <div className="sidebar-logo-text">Ibiza</div>
          <div className="sidebar-logo-sub">Team Leave Management</div>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-nav-item${isActive ? ' active' : ''}`
            }
            end={item.end ?? item.path === '/'}
            data-testid={item.testId}
          >
            {item.icon && <span aria-hidden="true">{item.icon}</span>}
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-user-name">{userName}</div>
        <div className="sidebar-user-role">
          {userRole ? formatRole(userRole) : 'Employee'}
        </div>
        {onSignOut && (
          <button
            type="button"
            className="sidebar-sign-out"
            data-testid="sign-out-button"
            onClick={() => void onSignOut()}
          >
            Sign out
          </button>
        )}
      </div>
    </aside>
  )
}
