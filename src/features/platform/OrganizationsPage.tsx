import { useState } from 'react'
import type { OrganizationSummaryResponse } from '../../api/generated/types'
import { PlusIcon } from '../../components/ui/icons'
import { useToast } from '../../components/ui/useToast'
import { CreateOrganizationModal } from './CreateOrganizationModal'
import { EditSubscriptionModal } from './EditSubscriptionModal'
import { usePlatformOrganizations } from './usePlatformOrganizations'
import './organizations-page.css'

export function OrganizationsPage() {
  const { data: organizations = [], isPending, isError } = usePlatformOrganizations()
  const [createOpen, setCreateOpen] = useState(false)
  const [editingOrganization, setEditingOrganization] =
    useState<OrganizationSummaryResponse | null>(null)
  const { showToast } = useToast()

  function showSubscriptionSavedToast() {
    showToast('Subscription updated')
  }

  return (
    <div className="page page-wide organizations-page" data-testid="organizations-page">
      <header className="page-header organizations-page__header">
        <div>
          <h1 className="page-title">Organizations</h1>
          <p className="page-sub">
            Provision orgs and manage subscriptions — no workforce leave data
          </p>
        </div>
        <button type="button" className="btn btn-admin" onClick={() => setCreateOpen(true)}>
          <PlusIcon size={14} /> Create Organization
        </button>
      </header>

      {isPending ? (
        <section className="organizations-page__empty" aria-live="polite">
          <p className="body-text">Loading organizations…</p>
        </section>
      ) : isError ? (
        <section className="organizations-page__empty" aria-live="polite">
          <p className="body-text">Unable to load organizations.</p>
        </section>
      ) : organizations.length === 0 ? (
        <section className="organizations-page__empty" aria-live="polite">
          <>
            <h2>No organizations yet</h2>
            <p>
              Create the first customer organization to start provisioning HR access.
            </p>
            <button type="button" className="btn btn-admin" onClick={() => setCreateOpen(true)}>
              <PlusIcon size={14} /> Create Organization
            </button>
          </>
        </section>
      ) : (
        <OrganizationsTable
          organizations={organizations}
          onEditSubscription={setEditingOrganization}
        />
      )}

      {createOpen ? <CreateOrganizationModal onClose={() => setCreateOpen(false)} /> : null}
      {editingOrganization ? (
        <EditSubscriptionModal
          organization={editingOrganization}
          onClose={() => setEditingOrganization(null)}
          onSuccess={showSubscriptionSavedToast}
        />
      ) : null}
    </div>
  )
}

function OrganizationsTable({
  organizations,
  onEditSubscription,
}: {
  organizations: OrganizationSummaryResponse[]
  onEditSubscription: (organization: OrganizationSummaryResponse) => void
}) {
  return (
    <section className="card table-wrap organizations-table-card" aria-labelledby="org-table-title">
      <div className="organizations-table-card__header">
        <h2 id="org-table-title">All Organizations</h2>
      </div>
      <table className="organizations-table">
        <thead>
          <tr>
            <th scope="col">Organization</th>
            <th scope="col">Plan</th>
            <th scope="col">Users</th>
            <th scope="col">Status</th>
            <th scope="col">Effective</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {organizations.map((organization) => (
            <tr key={organization.id ?? organization.name}>
              <td>
                <div className="org-cell">
                  <span className="org-cell__name">{organization.name}</span>
                  <span className="org-cell__subline">
                    {organization.primaryContact}
                    {organization.initialHrAdminEmail ? ` · ${organization.initialHrAdminEmail}` : ''}
                  </span>
                </div>
              </td>
              <td>
                <span className={`plan-badge plan-${planClass(organization.plan)}`}>
                  {planLabel(organization.plan)}
                </span>
              </td>
              <td>
                <span className="org-users-cell">
                  <span>{formatUserCount(organization.userCount, organization.userLimit)}</span>
                  {isAtPlanLimit(organization) ? (
                    <span
                      className="org-at-limit"
                      data-testid={`org-at-limit-${organization.id}`}
                    >
                      AT LIMIT
                    </span>
                  ) : null}
                </span>
              </td>
              <td>
                <span className="status-label">
                  <span className={`status-dot status-${statusClass(organization.status)}`} />
                  {statusLabel(organization.status)}
                </span>
              </td>
              <td>{organization.effectiveDate ?? '—'}</td>
              <td>
                <button
                  type="button"
                  className="btn btn-outline btn-sm organizations-table__action"
                  onClick={() => onEditSubscription(organization)}
                >
                  Edit Subscription
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function planClass(plan: OrganizationSummaryResponse['plan']): string {
  return (plan ?? 'free').toLowerCase()
}

function planLabel(plan: OrganizationSummaryResponse['plan']): string {
  if (!plan) return 'Free'
  return plan.charAt(0) + plan.slice(1).toLowerCase()
}

function statusClass(status: OrganizationSummaryResponse['status']): string {
  return (status ?? 'active').toLowerCase()
}

function statusLabel(status: OrganizationSummaryResponse['status']): string {
  return status === 'SUSPENDED' ? 'Suspended' : 'Active'
}

function isAtPlanLimit(organization: OrganizationSummaryResponse): boolean {
  const count = organization.userCount ?? 0
  const limit = organization.userLimit

  return Boolean(
    limit &&
      count >= limit &&
      organization.userLimit !== 9999 &&
      organization.plan !== 'INTERNAL',
  )
}

function formatUserCount(userCount?: number, userLimit?: number): string {
  const count = userCount ?? 0
  if (userLimit === 9999) {
    return `${count} / ∞`
  }
  return `${count} / ${userLimit ?? 0}`
}
