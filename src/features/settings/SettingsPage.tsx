import { useCallback } from 'react'
import { useToast } from '../../components/ui/useToast'
import { LeaveTypesCard } from './LeaveTypesCard'
import { TeamMembersCard } from './TeamMembersCard'
import { WorkforceGroupsWeekendsCard } from './WorkforceGroupsWeekendsCard'
import { CalendarSyncSettings } from './CalendarSyncSettings'
import { NotificationPreferencesSettings } from './NotificationPreferencesSettings'
import './group-tabs.css'

export function SettingsPage() {
  const { showToast } = useToast()

  const showSuccessToast = useCallback(
    (message: string) => showToast(message, 'success'),
    [showToast],
  )

  const showWarningToast = useCallback(
    (message: string) => showToast(message, 'warning'),
    [showToast],
  )

  return (
    <div className="page page-wide">
      <header className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Company policy, team, and leave entitlements</p>
        </div>
      </header>

      <WorkforceGroupsWeekendsCard
        onSuccess={showSuccessToast}
        onWarning={showWarningToast}
      />

      <LeaveTypesCard onWarning={showWarningToast} />

      <CalendarSyncSettings
        onSuccess={showSuccessToast}
        onWarning={showWarningToast}
      />

      <NotificationPreferencesSettings
        onSuccess={showSuccessToast}
        onWarning={showWarningToast}
      />

      <TeamMembersCard
        onSuccess={showSuccessToast}
        onWarning={showWarningToast}
      />
    </div>
  )
}
