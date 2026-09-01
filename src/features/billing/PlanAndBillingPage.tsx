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

  // The same sum BillingManagementService applies before allowing a downgrade: active users plus
  // unexpired pending invitations. Neither the summary nor the provider reports it as one number.
  const reserved = subscription ? subscription.activeSeats + subscription.pendingInvitations : 0

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
        <div className="panel-with-aside">
          <div className="panel-stack">
          <section className="card billing-summary" aria-labelledby="billing-summary-title">
            <div className="billing-summary-head">
              <h2 id="billing-summary-title" className="card-title">{t('summary.title')}</h2>
              <strong className="badge billing-plan-badge"><bdi>{subscription.plan}</bdi></strong>
            </div>
            <dl>
              <div><dt>{t('summary.status')}</dt><dd>{t(`statuses.${subscription.billingStatus}`)}</dd></div>
              <div><dt>{t('summary.active')}</dt><dd>{subscription.activeSeats}</dd></div>
              <div><dt>{t('summary.pending')}</dt><dd>{subscription.pendingInvitations}</dd></div>
              <div><dt>{t('summary.billable')}</dt><dd>{subscription.billableQuantity}</dd></div>
              <div><dt>{t('summary.limit')}</dt><dd>{subscription.seatLimit}</dd></div>
            </dl>
            <p className="form-hint">{t('summary.quantityTruth')}</p>
            {subscription.pendingPlan ? <p role="status">{t('summary.pendingPlan', { plan: subscription.pendingPlan })}</p> : null}
          </section>
          <section className="card billing-actions" aria-labelledby="billing-actions-title">
            <h2 id="billing-actions-title" className="card-title">{t('manage.title')}</h2>
            <p>{t('manage.body')}</p>
            <div className="billing-action-row">
              {subscription.plan === 'GROWTH' ? <button className="btn btn-outline" disabled={working} onClick={() => void downgrade('STARTER')}>{t('actions.starter')}</button> : null}
              {subscription.plan === 'STARTER' || subscription.plan === 'GROWTH' ? <button className="btn btn-outline" disabled={working} onClick={() => void downgrade('FREE')}>{t('actions.free')}</button> : null}
              {subscription.plan === 'FREE' ? <a className="btn btn-primary" href="/pricing?intendedCount=6" onClick={() => void trackUpgrade('STARTER', 'billing_page')}>{t('actions.compare')}</a> : null}
              <a className="btn btn-outline" href="/contact-sales" onClick={() => void trackUpgrade('CONTACT_SALES', 'billing_page')}>{t('actions.sales')}</a>
            </div>
          </section>
          </div>

          <aside className="support-rail">
            {/* The summary lists what the provider reports. The rail does the arithmetic nobody
                should be doing in their head: reserved is what the seat-limit check actually
                compares (active people plus invitations that have not expired), and headroom is
                what is left of the plan limit after it. Billable quantity is deliberately absent
                here — it is billing's number and already on the card. */}
            <section className="support-note" aria-labelledby="billing-seats-title">
              <h3 className="support-note-title" id="billing-seats-title">{t('rail.seatsTitle')}</h3>
              <dl className="support-note-list">
                <div className="support-note-kv">
                  <dt>{t('summary.active')}</dt>
                  <dd>{subscription.activeSeats}</dd>
                </div>
                <div className="support-note-kv">
                  <dt>{t('summary.pending')}</dt>
                  <dd>{subscription.pendingInvitations}</dd>
                </div>
                <div className="support-note-kv">
                  <dt>{t('rail.reserved')}</dt>
                  <dd data-testid="billing-reserved">{reserved}</dd>
                </div>
                <div className="support-note-kv">
                  <dt>{t('summary.limit')}</dt>
                  <dd>{subscription.seatLimit}</dd>
                </div>
                <div className="support-note-kv">
                  {/* Clamped at zero: an over-limit organization has no negative headroom, it has
                      none, and a "-2" here would read as a quantity rather than a state. */}
                  <dt>{t('rail.headroom')}</dt>
                  <dd data-testid="billing-headroom">{Math.max(0, subscription.seatLimit - reserved)}</dd>
                </div>
              </dl>
            </section>

            <section className="support-note" aria-labelledby="billing-headroom-title">
              <h3 className="support-note-title" id="billing-headroom-title">{t('rail.headroomTitle')}</h3>
              <p className="support-note-body">{t('rail.headroomBody')}</p>
            </section>

            <section className="support-note" aria-labelledby="billing-lifecycle-title">
              <h3 className="support-note-title" id="billing-lifecycle-title">{t('rail.lifecycleTitle')}</h3>
              <p className="support-note-body">{t('rail.lifecycleBody')}</p>
            </section>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
