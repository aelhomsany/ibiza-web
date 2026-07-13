import { useState } from 'react'
import { ApiError } from '../../api/client'
import type { CreateOrganizationRequest } from '../../api/generated/types'
import { Modal } from '../../components/ui/Modal'
import { CloseIcon } from '../../components/ui/icons'
import '../settings/team-members.css'
import { useCreateOrganization } from './useCreateOrganization'

type Props = {
  onClose: () => void
}

type Plan = CreateOrganizationRequest['plan']

const plans: { value: Plan; label: string }[] = [
  { value: 'FREE', label: 'Free' },
  { value: 'STARTER', label: 'Starter' },
  { value: 'GROWTH', label: 'Growth' },
  { value: 'INTERNAL', label: 'Internal' },
]

export function CreateOrganizationModal({ onClose }: Props) {
  const createMutation = useCreateOrganization()
  const [name, setName] = useState('')
  const [primaryContact, setPrimaryContact] = useState('')
  const [initialHrAdminEmail, setInitialHrAdminEmail] = useState('')
  const [plan, setPlan] = useState<Plan>('STARTER')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setErrorMessage(null)

    createMutation.mutate(
      {
        name,
        primaryContact,
        initialHrAdminEmail,
        plan,
      },
      {
        onSuccess: () => {
          onClose()
        },
        onError: (error) => {
          if (error instanceof ApiError) {
            setErrorMessage(error.problem.detail ?? 'Unable to create organization')
            return
          }
          setErrorMessage('Unable to create organization')
        },
      },
    )
  }

  return (
    <Modal
      labelledBy="create-organization-modal-title"
      onClose={onClose}
      className="create-organization-modal"
    >
        <div className="modal-header">
          <span className="modal-title" id="create-organization-modal-title">
            Create Organization
          </span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <CloseIcon size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="org-name">Organization name</label>
            <input
              id="org-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label htmlFor="org-primary-contact">Primary contact</label>
              <input
                id="org-primary-contact"
                type="text"
                value={primaryContact}
                onChange={(event) => setPrimaryContact(event.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="org-initial-hr">Initial HR Admin email</label>
              <input
                id="org-initial-hr"
                type="email"
                value={initialHrAdminEmail}
                onChange={(event) => setInitialHrAdminEmail(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="org-plan">Subscription plan</label>
            <select
              id="org-plan"
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

          {errorMessage ? (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-admin"
              disabled={createMutation.isPending}
              data-busy={createMutation.isPending ? 'true' : undefined}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Organization'}
            </button>
          </div>
        </form>
    </Modal>
  )
}
