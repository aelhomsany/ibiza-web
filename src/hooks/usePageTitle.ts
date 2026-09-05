import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export function usePageTitle(pageTitle: string) {
  const { t } = useTranslation('common')
  const brand = t('brand.name')
  useEffect(() => {
    document.title = `${pageTitle} — ${brand}`
  }, [pageTitle, brand])
}
