import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { OrganizationSummaryResponse } from '../../api/generated/types'
import { PlusIcon } from '../../components/ui/icons'
import { useToast } from '../../components/ui/useToast'
import { CreateOrganizationModal } from './CreateOrganizationModal'
import { EditSubscriptionModal } from './EditSubscriptionModal'
import { usePlatformOrganizations } from './usePlatformOrganizations'
import './organizations-page.css'

export function OrganizationsPage() {
  const { t } = useTranslation('platform')
  const { data: organizations = [], isPending, isError } = usePlatformOrganizations()
  const [createOpen, setCreateOpen] = useState(false)
  const [editingOrganization, setEditingOrganization] =
    useState<OrganizationSummaryResponse | null>(null)
  const { showToast } = useToast()

  function showSubscriptionSavedToast() {
    showToast(t('success.subscription'))
  }

  return (
    <div className="page page-wide organizations-page" data-testid="organizations-page">
      <header className="page-header organizations-page__header">
        <div>
          <h1 className="page-title">{t('title')}</h1>
          <p className="page-sub">{t('subtitle')}</p>
        </div>
        <button type="button" className="btn btn-admin" onClick={() => setCreateOpen(true)}>
          <PlusIcon size={14} /> {t('actions.create')}
        </button>
      </header>

      {isPending ? (
        <section className="organizations-page__empty" aria-live="polite">
          <p className="body-text">{t('loading')}</p>
        </section>
      ) : isError ? (
        <section className="organizations-page__empty" aria-live="polite">
          <p className="body-text">{t('errors.load')}</p>
        </section>
      ) : organizations.length === 0 ? (
        <section className="organizations-page__empty" aria-live="polite">
          <>
            <h2>{t('empty.title')}</h2>
            <p>{t('empty.copy')}</p>
            <button type="button" className="btn btn-admin" onClick={() => setCreateOpen(true)}>
              <PlusIcon size={14} /> {t('actions.create')}
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
  const { t } = useTranslation('platform')
  return (
    <section className="card table-wrap organizations-table-card" aria-labelledby="org-table-title">
      <div className="organizations-table-card__header">
        <h2 id="org-table-title">{t('table.all')}</h2>
      </div>
      <table className="organizations-table">
        <thead>
          <tr>
            <th scope="col">{t('table.organization')}</th>
            <th scope="col">{t('table.plan')}</th>
            <th scope="col">{t('table.users')}</th>
            <th scope="col">{t('table.status')}</th>
            <th scope="col">{t('table.effective')}</th>
            <th scope="col">{t('table.actions')}</th>
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
                  {t(`plans.${(organization.plan ?? 'FREE').toLowerCase()}`)}
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
                      {t('table.atLimit')}
                    </span>
                  ) : null}
                </span>
              </td>
              <td>
                <span className="status-label">
                  <span className={`status-dot status-${statusClass(organization.status)}`} />
                  {t(`statuses.${organization.status === 'SUSPENDED' ? 'suspended' : 'active'}`)}
                </span>
              </td>
              <td>{organization.effectiveDate ?? '—'}</td>
              <td>
                <button
                  type="button"
                  className="btn btn-outline btn-sm organizations-table__action"
                  onClick={() => onEditSubscription(organization)}
                  aria-label={t('aria.editSubscription', { name: organization.name })}
                >
                  {t('actions.editSubscription')}
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

function statusClass(status: OrganizationSummaryResponse['status']): string {
  return (status ?? 'active').toLowerCase()
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
