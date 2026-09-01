import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getPolicySettingsOverview } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { BuildingIcon } from '../../components/ui/icons'
// The rail's own layout is global (styles/support-rail.css); this is for the card's
// .organization-settings-* rules, which SettingsPage happens to load first but this
// card should not depend on it doing.
import './settings-ia.css'

export function OrganizationSettingsCard() {
  const { t } = useTranslation('settings')
  const { user } = useAuth()
  const orgId = user?.organizationId

  // Keyed under this card rather than reusing another feature's key for the same endpoint, so a
  // Policy- or Schedules-side invalidation cannot silently drive these figures (the reasoning is
  // spelled out on ScheduleLocationSettingsPage's copy of this query).
  const glanceQuery = useQuery({
    queryKey: ['organization-glance', orgId] as const,
    queryFn: getPolicySettingsOverview,
    enabled: orgId != null,
  })

  // The rail states a figure or says nothing -- a "0" that actually means "not loaded" would be
  // read as "this organization has no leave types", which is a different and alarming claim.
  const glance = glanceQuery.data
  const count = (list: unknown[] | undefined) => (list ? String(list.length) : '—')

  return (
    <div className="panel-with-aside">
      <section className="settings-card organization-settings-card" data-testid="organization-settings-card">
        <div className="organization-settings-heading">
          <span className="organization-settings-icon" aria-hidden="true">
            <BuildingIcon size={20} />
          </span>
          <div>
            <h3 className="card-section-title">{user?.organizationName ?? t('organization.unknown')}</h3>
            <p>{t('organization.helper')}</p>
          </div>
        </div>
        <dl className="organization-settings-facts">
          <div>
            <dt>{t('organization.fields.name')}</dt>
            <dd dir="auto">{user?.organizationName ?? t('organization.unknown')}</dd>
          </div>
          <div>
            <dt>{t('organization.fields.timezone')}</dt>
            <dd>
              <bdi>{user?.timezone ?? t('organization.notAvailable')}</bdi>
            </dd>
          </div>
        </dl>
        <p className="organization-settings-note">
          {t('organization.planNote')}
        </p>
      </section>

      <aside className="support-rail">
        {/* This panel shows two read-only facts and no controls, so nothing here explains what
            they reach. The consequences are the point: a timezone is not a display preference. */}
        <section className="support-note" aria-labelledby="organization-affects-title">
          <h3 className="support-note-title" id="organization-affects-title">
            {t('organization.affects.title')}
          </h3>
          <ul className="support-note-bullets">
            <li>{t('organization.affects.timezone')}</li>
            <li>{t('organization.affects.name')}</li>
            <li>{t('organization.affects.groups')}</li>
          </ul>
        </section>

        <section className="support-note" aria-labelledby="organization-glance-title">
          <h3 className="support-note-title" id="organization-glance-title">
            {t('organization.glance.title')}
          </h3>
          <dl className="support-note-list">
            <div className="support-note-kv">
              <dt>{t('organization.glance.people')}</dt>
              <dd data-testid="glance-people">{count(glance?.users)}</dd>
            </div>
            <div className="support-note-kv">
              <dt>{t('organization.glance.groups')}</dt>
              <dd data-testid="glance-groups">{count(glance?.workforceGroups)}</dd>
            </div>
            <div className="support-note-kv">
              <dt>{t('organization.glance.leaveTypes')}</dt>
              <dd data-testid="glance-leave-types">{count(glance?.leaveTypes)}</dd>
            </div>
          </dl>
        </section>
      </aside>
    </div>
  )
}
