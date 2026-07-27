import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/useAuth'
import { BuildingIcon } from '../../components/ui/icons'

export function OrganizationSettingsCard() {
  const { t } = useTranslation('settings')
  const { user } = useAuth()

  return (
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
  )
}
