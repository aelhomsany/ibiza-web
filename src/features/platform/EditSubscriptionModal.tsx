import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import type { OrganizationSummaryResponse, UpdateSubscriptionRequest } from '../../api/generated/types'
import { DateField } from '../../components/DateField'
import { Modal } from '../../components/ui/Modal'
import { CloseIcon } from '../../components/ui/icons'
import { useUpdateSubscription } from './useUpdateSubscription'

type Props = {
  organization: OrganizationSummaryResponse
  onClose: () => void
  onSuccess?: () => void
}

type Plan = UpdateSubscriptionRequest['plan']
type BillingStatus = UpdateSubscriptionRequest['billingStatus']

const plans: Plan[] = ['FREE', 'STARTER', 'GROWTH', 'INTERNAL']

const billingStatuses: BillingStatus[] = ['ACTIVE', 'SUSPENDED']

export function EditSubscriptionModal({ organization, onClose, onSuccess }: Props) {
  const { t } = useTranslation(['platform', 'common'])
  const updateMutation = useUpdateSubscription()
  const [plan, setPlan] = useState<Plan>(organization.plan ?? 'FREE')
  const [billingStatus, setBillingStatus] = useState<BillingStatus>(
    organization.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
  )
  const [effectiveDate, setEffectiveDate] = useState(organization.effectiveDate ?? '')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
          if (error instanceof ApiError) {
            setErrorMessage(error.problem.detail ?? t('platform:edit.errors.submit'))
            return
          }
          setErrorMessage(t('platform:edit.errors.submit'))
        },
      },
    )
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
            {t('platform:edit.title', { name: organization.name })}
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
    </Modal>
  )
}
