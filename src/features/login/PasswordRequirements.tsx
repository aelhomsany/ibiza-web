import { CheckCircleIcon } from '../../components/ui/icons'
import { useTranslation } from 'react-i18next'
import {
  evaluatePasswordRequirements,
  type PasswordRequirement,
} from './passwordRules'

type PasswordRequirementsProps = {
  password: string
  id?: string
}

export function PasswordRequirements({ password, id }: PasswordRequirementsProps) {
  const { t } = useTranslation('auth')
  const requirements = evaluatePasswordRequirements(password)

  return (
    <div id={id} className="auth-password-hints" data-testid="password-requirements">
      <div className="auth-password-hints-title">{t('password.requirementsTitle')}</div>
      <ul className="auth-password-hints-list" aria-live="polite" aria-atomic="false">
        {requirements.map((requirement) => (
          <RequirementItem key={requirement.id} requirement={requirement} />
        ))}
      </ul>
    </div>
  )
}

function RequirementItem({ requirement }: { requirement: PasswordRequirement }) {
  const { t } = useTranslation('auth')
  return (
    <li
      className={
        requirement.met ? 'auth-password-hint auth-password-hint-met' : 'auth-password-hint'
      }
      data-testid={`password-requirement-${requirement.id}`}
      data-met={requirement.met ? 'true' : 'false'}
    >
      <CheckCircleIcon size={16} aria-hidden="true" />
      <span>{t(`password.requirements.${requirement.id}`)}</span>
      <span className="sr-only">
        {requirement.met ? t('password.requirementMet') : t('password.requirementNotMet')}
      </span>
    </li>
  )
}
