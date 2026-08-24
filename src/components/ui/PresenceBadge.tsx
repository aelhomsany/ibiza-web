import type { OutTodayResponse } from '../../api/generated/types'
import { useTranslation } from 'react-i18next'

type Props = {
  presence: OutTodayResponse['presence']
  /**
   * Overrides the badge's own wording.
   *
   * The Report Center names the same two states "Working from home" and "Away" through
   * `reports:values`, and its result table already prints those. Letting the badge impose
   * "WFH"/"Off" there put two vocabularies for one concept on a single screen, so a caller
   * that owns a vocabulary passes it in. Styling and semantics stay here.
   */
  label?: string
}

export function PresenceBadge({ presence, label }: Props) {
  const { t } = useTranslation('common')
  if (presence === 'WFH') {
    return <span className="badge badge-wfh">{label ?? t('presence.wfh')}</span>
  }

  return <span className="badge badge-off">{label ?? t('presence.off')}</span>
}
