import { useCallback, useEffect, useState } from 'react'
import { TeamMembersCard } from './TeamMembersCard'
import { WorkforceGroupsWeekendsCard } from './WorkforceGroupsWeekendsCard'
import './group-tabs.css'
import './settings-toast.css'

type Toast = { message: string; type: 'success' | 'warning' }

export function SettingsPage() {
  const [toast, setToast] = useState<Toast | null>(null)

  const showSuccessToast = useCallback((message: string) => {
    setToast({ message, type: 'success' })
  }, [])

  const showWarningToast = useCallback((message: string) => {
    setToast({ message, type: 'warning' })
  }, [])

  useEffect(() => {
    if (!toast) {
      return undefined
    }

    const timer = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  return (
    <div className="page page-wide">
      <header className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Workforce groups, team, and holidays</p>
        </div>
      </header>

      <WorkforceGroupsWeekendsCard
        onSuccess={showSuccessToast}
        onWarning={showWarningToast}
      />

      <TeamMembersCard
        onSuccess={showSuccessToast}
        onWarning={showWarningToast}
      />

      {toast && (
        <div
          className={`settings-toast${toast.type === 'warning' ? ' settings-toast-warning' : ''}`}
          role="status"
          aria-live="polite"
          data-testid="settings-toast"
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
