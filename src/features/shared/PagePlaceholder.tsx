type PagePlaceholderProps = {
  title: string
  subtitle?: string
}

export function PagePlaceholder({ title, subtitle }: PagePlaceholderProps) {
  const { t } = useTranslation('common')
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-sub">{subtitle}</p>}
        </div>
      </header>
      <p className="body-text">{t('comingSoon')}</p>
    </div>
  )
}
import { useTranslation } from 'react-i18next'
