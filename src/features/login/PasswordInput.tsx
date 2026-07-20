import { useId, useState, type InputHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import { EyeIcon, EyeOffIcon } from '../../components/ui/icons'

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string
  testId: string
  toggleTestId?: string
}

export function PasswordInput({
  id,
  label,
  testId,
  toggleTestId,
  className,
  disabled,
  ...inputProps
}: PasswordInputProps) {
  const { t } = useTranslation('auth')
  const generatedId = useId()
  const inputId = id ?? generatedId
  const [visible, setVisible] = useState(false)

  return (
    <div className="auth-form-group">
      <label htmlFor={inputId}>{label}</label>
      <div className="auth-password-field">
        <input
          {...inputProps}
          id={inputId}
          data-testid={testId}
          className={['auth-input', className].filter(Boolean).join(' ')}
          type={visible ? 'text' : 'password'}
          disabled={disabled}
        />
        <button
          type="button"
          className="btn btn-ghost auth-password-toggle"
          data-testid={toggleTestId ?? `${testId}-toggle`}
          aria-label={visible ? t('password.hide') : t('password.show')}
          aria-pressed={visible}
          disabled={disabled}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
        </button>
      </div>
    </div>
  )
}
