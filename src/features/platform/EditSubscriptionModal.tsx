import { useState } from 'react'
import { ApiError } from '../../api/client'
import type { OrganizationSummaryResponse, UpdateSubscriptionRequest } from '../../api/generated/types'
import { DateField } from '../../components/DateField'
import { Modal } from '../../components/ui/Modal'
import { CloseIcon } from '../../components/ui/icons'
import '../settings/team-members.css'
import { useUpdateSubscription } from './useUpdateSubscription'

type Props = {
  organization: OrganizationSummaryResponse
  onClose: () => void
  onSuccess?: () => void
}

type Plan = UpdateSubscriptionRequest['plan']
type BillingStatus = UpdateSubscriptionRequest['billingStatus']

const plans: { value: Plan; label: string }[] = [
  { value: 'FREE', label: 'Free (3 users)' },
  { value: 'STARTER', label: 'Starter (50 users)' },
  { value: 'GROWTH', label: 'Growth (200 users)' },
  { value: 'INTERNAL', label: 'Internal (unlimited)' },
]

const billingStatuses: { value: BillingStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
]

export function EditSubscriptionModal({ organization, onClose, onSuccess }: Props) {
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
      setErrorMessage('Unable to update subscription')
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
            setErrorMessage(error.problem.detail ?? 'Unable to update subscription')
            return
          }
          setErrorMessage('Unable to update subscription')
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
            Edit Subscription — {organization.name}
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <CloseIcon size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="edit-subscription-plan">Plan</label>
            <select
              id="edit-subscription-plan"
              data-testid="edit-subscription-plan"
              value={plan}
              onChange={(event) => setPlan(event.target.value as Plan)}
              required
            >
              {plans.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="edit-subscription-billing-status">Billing status</label>
            <select
              id="edit-subscription-billing-status"
              data-testid="edit-subscription-billing-status"
              value={billingStatus}
              onChange={(event) => setBillingStatus(event.target.value as BillingStatus)}
              required
            >
              {billingStatuses.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="edit-subscription-effective-date">Effective date</label>
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
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-admin"
              data-testid="edit-subscription-submit"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Subscription'}
            </button>
          </div>
        </form>
    </Modal>
  )
}
