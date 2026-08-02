import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getBillingSubscription, type BillingSubscription } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import './billing.css'

export function BillingNotice() {
  const { t } = useTranslation('billing')
  const { user } = useAuth()
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null)

  useEffect(() => {
    if (user?.role !== 'HR_ADMIN') return
    let active = true
    void getBillingSubscription().then((value) => active && setSubscription(value)).catch(() => undefined)
    return () => { active = false }
  }, [user?.role])

  if (!subscription || !['PAST_DUE_GRACE', 'RESTRICTED'].includes(subscription.billingStatus)) return null
  const restricted = subscription.billingStatus === 'RESTRICTED'
  return (
    <aside
      className={`billing-notice billing-notice--${restricted ? 'restricted' : 'grace'}`}
      data-testid={restricted ? 'billing-restricted-banner' : 'billing-grace-notice'}
      role={restricted ? 'alert' : 'status'}
    >
      <div>
        <strong>{t(restricted ? 'notice.restrictedTitle' : 'notice.graceTitle')}</strong>
        <p>{t(restricted ? 'notice.restrictedBody' : 'notice.graceBody', {
          date: subscription.graceEndsAt ? new Date(subscription.graceEndsAt).toLocaleDateString() : '',
        })}</p>
      </div>
      <a className="btn btn-outline btn-sm" href="/settings/billing" data-testid="cta-update-payment">
        {t('actions.remediate')}
      </a>
    </aside>
  )
}
