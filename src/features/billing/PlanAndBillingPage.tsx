import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  createBillingPortalSession,
  getBillingSubscription,
  scheduleBillingDowngrade,
  type BillingSubscription,
} from '../../api/client'
import { useToast } from '../../components/ui/useToast'
import { emitApprovedPublicEvent } from '../public-site/analyticsGateway'
import './billing.css'

export function PlanAndBillingPage() {
  const { t, i18n } = useTranslation('billing')
  const { showToast } = useToast()
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    void getBillingSubscription()
      .then(setSubscription)
      .catch(() => showToast(t('errors.load'), 'warning'))
      .finally(() => setLoading(false))
  }, [showToast, t])

  async function openPortal() {
    if (working) return
    setWorking(true)
    try {
      const { portalUrl } = await createBillingPortalSession()
      window.location.assign(portalUrl)
    } catch {
      showToast(t('errors.portal'), 'warning')
      setWorking(false)
    }
  }

  async function downgrade(targetPlan: 'FREE' | 'STARTER') {
    if (working) return
    setWorking(true)
    try {
      const updated = await scheduleBillingDowngrade(targetPlan)
      setSubscription(updated)
      showToast(t('success.downgrade'), 'success')
    } catch {
      showToast(t('errors.downgrade'), 'warning')
    } finally {
      setWorking(false)
    }
  }

  async function trackUpgrade(plan: 'STARTER' | 'GROWTH' | 'CONTACT_SALES', interaction: string) {
    await emitApprovedPublicEvent({
      eventName: 'upgrade_prompt_selected.v1',
      dimensions: { route: '/settings/billing', locale: i18n.language === 'ar' ? 'ar' : 'en', plan, interaction },
    })
  }

  return (
    <div className="page page-wide billing-page" data-testid="plan-and-billing-page">
      <header className="page-header">
        <div><h1 className="page-title">{t('title')}</h1><p className="page-sub">{t('subtitle')}</p></div>
        {subscription && subscription.plan !== 'FREE' ? (
          <button type="button" className="btn btn-primary" disabled={working} onClick={() => void openPortal()}>
            {t('actions.portal')}
          </button>
        ) : null}
      </header>
      {loading ? <p aria-live="polite">{t('loading')}</p> : subscription ? (
        <>
          <section className="card billing-summary" aria-labelledby="billing-summary-title">
            <div><h2 id="billing-summary-title">{t('summary.title')}</h2><strong><bdi>{subscription.plan}</bdi></strong></div>
            <dl>
              <div><dt>{t('summary.status')}</dt><dd>{t(`statuses.${subscription.billingStatus}`)}</dd></div>
              <div><dt>{t('summary.active')}</dt><dd>{subscription.activeSeats}</dd></div>
              <div><dt>{t('summary.pending')}</dt><dd>{subscription.pendingInvitations}</dd></div>
              <div><dt>{t('summary.billable')}</dt><dd>{subscription.billableQuantity}</dd></div>
              <div><dt>{t('summary.limit')}</dt><dd>{subscription.seatLimit}</dd></div>
            </dl>
            <p>{t('summary.quantityTruth')}</p>
            {subscription.pendingPlan ? <p role="status">{t('summary.pendingPlan', { plan: subscription.pendingPlan })}</p> : null}
          </section>
          <section className="card billing-actions" aria-labelledby="billing-actions-title">
            <h2 id="billing-actions-title">{t('manage.title')}</h2>
            <p>{t('manage.body')}</p>
            <div className="billing-action-row">
              {subscription.plan === 'GROWTH' ? <button className="btn btn-outline" disabled={working} onClick={() => void downgrade('STARTER')}>{t('actions.starter')}</button> : null}
              {subscription.plan === 'STARTER' || subscription.plan === 'GROWTH' ? <button className="btn btn-outline" disabled={working} onClick={() => void downgrade('FREE')}>{t('actions.free')}</button> : null}
              {subscription.plan === 'FREE' ? <a className="btn btn-primary" href="/pricing?intendedCount=6" onClick={() => void trackUpgrade('STARTER', 'billing_page')}>{t('actions.compare')}</a> : null}
              <a className="btn btn-outline" href="/contact-sales" onClick={() => void trackUpgrade('CONTACT_SALES', 'billing_page')}>{t('actions.sales')}</a>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
