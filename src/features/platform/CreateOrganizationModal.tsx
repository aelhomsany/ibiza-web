import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CreateOrganizationRequest } from '../../api/generated/types'
import { Modal } from '../../components/ui/Modal'
import { CloseIcon } from '../../components/ui/icons'
import { PlatformApiError } from '../platform-auth/platformApiClient'
import { useContactSalesLeads } from './useContactSalesLeads'
import { useCreateOrganization } from './useCreateOrganization'

type Props = {
  onClose: () => void
}

type Plan = CreateOrganizationRequest['plan']

const plans: Plan[] = ['FREE', 'GROWTH', 'INTERNAL']

const NO_HANDOFF = ''

export function CreateOrganizationModal({ onClose }: Props) {
  const { t } = useTranslation(['platform', 'common'])
  const createMutation = useCreateOrganization()
  const [name, setName] = useState('')
  const [primaryContact, setPrimaryContact] = useState('')
  const [initialHrAdminEmail, setInitialHrAdminEmail] = useState('')
  const [plan, setPlan] = useState<Plan>('GROWTH')
  const [assistedHandoffId, setAssistedHandoffId] = useState<string>(NO_HANDOFF)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // A lead list that cannot be read is not a reason to block provisioning: the operator can
  // always create an unassisted Organization, which is what this form did before the picker.
  const { data: leads } = useContactSalesLeads()
  const linkableLeads = leads ?? []

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setErrorMessage(null)

    createMutation.mutate(
      {
        name,
        primaryContact,
        initialHrAdminEmail,
        plan,
        // Omitted rather than sent empty: the server treats a blank handoff id as "none", but an
        // absent key says so without relying on that.
        ...(assistedHandoffId === NO_HANDOFF ? {} : { assistedHandoffId }),
      },
      {
        onSuccess: () => {
          onClose()
        },
        onError: (error) => {
          if (error instanceof PlatformApiError) {
            setErrorMessage(error.problem.detail ?? t('platform:create.errors.submit'))
            return
          }
          setErrorMessage(t('platform:create.errors.submit'))
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
            {t('platform:create.title')}
          </span>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t('common:actions.close')}>
            <CloseIcon size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="org-name">{t('platform:create.fields.name')}</label>
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
              <label htmlFor="org-primary-contact">{t('platform:create.fields.primaryContact')}</label>
              <input
                id="org-primary-contact"
                type="text"
                value={primaryContact}
                onChange={(event) => setPrimaryContact(event.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="org-initial-hr">{t('platform:create.fields.hrEmail')}</label>
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
            <label htmlFor="org-plan">{t('platform:create.fields.plan')}</label>
            <select
              id="org-plan"
              value={plan}
              onChange={(event) => setPlan(event.target.value as Plan)}
              required
            >
              {plans.map((option) => (
                <option key={option} value={option}>
                  {t(`platform:plans.${option.toLowerCase()}`)}
                </option>
              ))}
            </select>
          </div>

          {linkableLeads.length > 0 ? (
            <div className="form-group">
              <label htmlFor="org-assisted-handoff">
                {t('platform:create.fields.assistedHandoff')}
              </label>
              <select
                id="org-assisted-handoff"
                value={assistedHandoffId}
                onChange={(event) => setAssistedHandoffId(event.target.value)}
              >
                <option value={NO_HANDOFF}>{t('platform:create.assistedHandoff.none')}</option>
                {linkableLeads.map((lead) => (
                  // Company and contact names are user data and are never translated. Without
                  // dir="auto" an Arabic company name reorders the trailing "(N users)" clause.
                  <option key={lead.id} value={lead.id} dir="auto">
                    {t('platform:create.assistedHandoff.option', {
                      company: lead.companyName,
                      contact: lead.contactName,
                      users: lead.intendedActiveUserCount,
                    })}
                  </option>
                ))}
              </select>
              <p className="form-hint" dir="auto">
                {t('platform:create.assistedHandoff.hint')}
              </p>
            </div>
          ) : null}

          {errorMessage ? (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              {t('common:actions.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-admin"
              disabled={createMutation.isPending}
              data-busy={createMutation.isPending ? 'true' : undefined}
            >
              {createMutation.isPending ? t('platform:create.creating') : t('platform:actions.create')}
            </button>
          </div>
        </form>
    </Modal>
  )
}
