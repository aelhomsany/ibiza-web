import type { OutTodayResponse } from '../../api/generated/types'

type Props = {
  presence: OutTodayResponse['presence']
}

export function PresenceBadge({ presence }: Props) {
  if (presence === 'WFH') {
    return <span className="badge badge-wfh">WFH</span>
  }

  return <span className="badge badge-off">Off</span>
}
