import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isolate } from '../../i18n/bidi'
import type { OrganizationSummaryResponse, UpdateSubscriptionRequest } from '../../api/generated/types'
import { DateField } from '../../components/DateField'
import { Modal } from '../../components/ui/Modal'
import { CloseIcon } from '../../components/ui/icons'
import { PlatformApiError } from '../platform-auth/platformApiClient'
import { useUpdateSubscription } from './useUpdateSubscription'
import { useGrantReportingPromotion, useRevokeReportingPromotion } from './useReportingPromotion'
import { promotionStateLabel } from './promotionState'

type Props = {
  organization: OrganizationSummaryResponse
  onClose: () => void
  onSuccess?: () => void
}

type Plan = UpdateSubscriptionRequest['plan']
type BillingStatus = UpdateSubscriptionRequest['billingStatus']

const plans: Plan[] = ['FREE', 'STARTER', 'GROWTH', 'INTERNAL']

const billingStatuses: BillingStatus[] = ['MANUAL_ACTIVE', 'MANUAL_SUSPENDED']

export function EditSubscriptionModal({ organization, onClose, onSuccess }: Props) {
  const { t, i18n } = useTranslation(['platform', 'common'])
  const updateMutation = useUpdateSubscription()
  const grantPromotion = useGrantReportingPromotion()
  const revokePromotion = useRevokeReportingPromotion()
  const [plan, setPlan] = useState<Plan>(organization.plan ?? 'FREE')
  const [billingStatus, setBillingStatus] = useState<BillingStatus>(
    organization.status === 'SUSPENDED' ? 'MANUAL_SUSPENDED' : 'MANUAL_ACTIVE',
  )
  const [effectiveDate, setEffectiveDate] = useState(organization.effectiveDate ?? '')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // Deliberately not prefilled from the current promotion. The only submit path is grant, which
  // rejects any window overlapping a non-revoked row - including the row the prefill came from -
  // so prefilled fields could only ever produce a 400. The active grant is shown read-only instead.
  const [campaignCode, setCampaignCode] = useState('')
  const [promotionStart, setPromotionStart] = useState('')
  const [promotionEnd, setPromotionEnd] = useState('')
  const [promotionError, setPromotionError] = useState<string | null>(null)
  const [confirmingRevoke, setConfirmingRevoke] = useState(false)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setErrorMessage(null)

    if (!organization.id) {
      setErrorMessage(t('platform:edit.errors.submit'))
      return
    }

    updateMutation.mutate(
      {
        organizationId: organization.id,
        payload: {
          plan,
          billingStatus,
          effectiveDate,
        },
      },
      {
        onSuccess: () => {
          onSuccess?.()
          onClose()
        },
        onError: (error) => {
          if (error instanceof PlatformApiError) {
            setErrorMessage(error.problem.detail ?? t('platform:edit.errors.submit'))
            return
          }
          setErrorMessage(t('platform:edit.errors.submit'))
        },
      },
    )
  }

  function handlePromotionSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPromotionError(null)
    if (!organization.id) return
    const code = campaignCode.trim().toUpperCase()
    // The form no longer carries noValidate, so `required` and `pattern` fire natively. These
    // checks cover what markup cannot express: a window whose end does not follow its start.
    if (!code || !promotionStart || !promotionEnd) {
      setPromotionError(t('platform:promotion.errors.incomplete'))
      return
    }
    if (promotionEnd <= promotionStart) {
      setPromotionError(t('platform:promotion.errors.range'))
      return
    }
    grantPromotion.mutate({
      organizationId: organization.id,
      payload: {
        campaignCode: code,
        startsAt: `${promotionStart}T00:00:00Z`,
        endsAt: `${promotionEnd}T00:00:00Z`,
      },
    }, {
      onSuccess: () => {
        setCampaignCode('')
        setPromotionStart('')
        setPromotionEnd('')
        onSuccess?.()
      },
      // The server's problem detail is written in English. Surfacing it verbatim would put an
      // untranslated sentence into the Arabic UI, so it is only shown in an English session.
      onError: (error) => setPromotionError(
        error instanceof PlatformApiError && i18n.language.startsWith('en')
          ? error.problem.detail ?? t('platform:promotion.errors.submit')
          : t('platform:promotion.errors.submit')),
    })
  }

  function handlePromotionRevoke() {
    setPromotionError(null)
    if (!organization.id) return
    if (!confirmingRevoke) {
      setConfirmingRevoke(true)
      return
    }
    revokePromotion.mutate(organization.id, {
      onSuccess: () => {
        setConfirmingRevoke(false)
        onSuccess?.()
      },
      onError: () => {
        setConfirmingRevoke(false)
        setPromotionError(t('platform:promotion.errors.revoke'))
      },
    })
  }

  return (
    <Modal
      labelledBy="edit-subscription-modal-title"
      onClose={onClose}
      className="edit-subscription-modal"
      testId="edit-subscription-modal"
    >
        <div className="modal-header">
          <h2 className="modal-title" id="edit-subscription-modal-title">
            {t('platform:edit.title', { name: isolate(organization.name) })}
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t('common:actions.close')}>
            <CloseIcon size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="edit-subscription-plan">{t('platform:edit.fields.plan')}</label>
            <select
              id="edit-subscription-plan"
              data-testid="edit-subscription-plan"
              value={plan}
              onChange={(event) => setPlan(event.target.value as Plan)}
              required
            >
              {plans.map((option) => (
                <option key={option} value={option}>
                  {t(`platform:plans.${option.toLowerCase()}WithLimit`)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="edit-subscription-billing-status">{t('platform:edit.fields.billingStatus')}</label>
            <select
              id="edit-subscription-billing-status"
              data-testid="edit-subscription-billing-status"
              value={billingStatus}
              onChange={(event) => setBillingStatus(event.target.value as BillingStatus)}
              required
            >
              {billingStatuses.map((option) => (
                <option key={option} value={option}>
                  {t(`platform:statuses.${option.toLowerCase()}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="edit-subscription-effective-date">{t('platform:edit.fields.effectiveDate')}</label>
            <DateField
              id="edit-subscription-effective-date"
              data-testid="edit-subscription-effective-date"
              value={effectiveDate}
              onChange={setEffectiveDate}
              required
            />
          </div>

          {errorMessage ? (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              {t('common:actions.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-admin"
              data-testid="edit-subscription-submit"
              disabled={updateMutation.isPending}
              data-busy={updateMutation.isPending ? 'true' : undefined}
            >
              {updateMutation.isPending ? t('platform:actions.saving') : t('platform:actions.saveSubscription')}
            </button>
          </div>
        </form>

        {organization.plan === 'STARTER' ? (
          <form onSubmit={handlePromotionSubmit} aria-labelledby="reporting-promotion-title">
            <h3 id="reporting-promotion-title">{t('platform:promotion.title')}</h3>
            {organization.reportingPromotion ? (
              <p className="body-text" data-testid="reporting-promotion-state">
                {t('platform:promotion.current', {
                  state: promotionStateLabel(t, organization.reportingPromotion.state),
                  campaign: isolate(organization.reportingPromotion.campaignCode),
                })}
              </p>
            ) : null}
            <div className="form-group">
              <label htmlFor="reporting-campaign-code">{t('platform:promotion.fields.campaign')}</label>
              <input id="reporting-campaign-code" value={campaignCode}
                onChange={(event) => setCampaignCode(event.target.value)} required pattern="[A-Z0-9][A-Z0-9_-]{1,63}" />
            </div>
            <div className="form-group">
              <label htmlFor="reporting-promotion-start">{t('platform:promotion.fields.start')}</label>
              <DateField id="reporting-promotion-start" value={promotionStart} onChange={setPromotionStart} required />
            </div>
            <div className="form-group">
              <label htmlFor="reporting-promotion-end">{t('platform:promotion.fields.end')}</label>
              <DateField id="reporting-promotion-end" value={promotionEnd} onChange={setPromotionEnd} required />
              <p className="field-hint">{t('platform:promotion.endHint')}</p>
            </div>
            {promotionError ? (
              <p className="form-error" role="alert" data-testid="reporting-promotion-error">
                {promotionError}
              </p>
            ) : null}
            <div className="modal-actions">
              {organization.reportingPromotion
                && ['ACTIVE', 'SCHEDULED'].includes(organization.reportingPromotion.state ?? '') ? (
                <button type="button" className="btn btn-danger" onClick={handlePromotionRevoke}
                  data-testid="reporting-promotion-revoke"
                  disabled={revokePromotion.isPending}>
                  {confirmingRevoke
                    ? t('platform:promotion.actions.confirmRevoke')
                    : t('platform:promotion.actions.revoke')}
                </button>
              ) : null}
              <button type="submit" className="btn btn-admin" data-testid="reporting-promotion-grant"
                disabled={grantPromotion.isPending}>
                {t('platform:promotion.actions.grant')}
              </button>
            </div>
          </form>
        ) : null}
    </Modal>
  )
}
