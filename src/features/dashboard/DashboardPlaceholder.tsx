import { PagePlaceholder } from '../shared/PagePlaceholder'
import { useTranslation } from 'react-i18next'

export function DashboardPlaceholder() {
  const { t } = useTranslation('dashboard')
  return (
    <PagePlaceholder
      title={t('title')}
      subtitle={t('subtitle')}
    />
  )
}
