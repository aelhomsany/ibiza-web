import { useTranslation } from 'react-i18next'

type SkipToMainLinkProps = {
  inert?: boolean
}

export function SkipToMainLink({ inert = false }: SkipToMainLinkProps) {
  const { t } = useTranslation('layout')

  const moveFocusToMain = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    document.getElementById('main-content')?.focus()
  }

  return (
    <a
      className="skip-to-main sr-only"
      href="#main-content"
      onClick={moveFocusToMain}
      {...(inert ? { inert: true } : {})}
    >
      {t('skipToMain')}
    </a>
  )
}
