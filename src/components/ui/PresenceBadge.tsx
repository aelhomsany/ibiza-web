import type { OutTodayResponse } from '../../api/generated/types'
import { useTranslation } from 'react-i18next'

type Props = {
  presence: OutTodayResponse['presence']
}

export function PresenceBadge({ presence }: Props) {
  const { t } = useTranslation('common')
  if (presence === 'WFH') {
    return <span className="badge badge-wfh">{t('presence.wfh')}</span>
  }

  return <span className="badge badge-off">{t('presence.off')}</span>
}
