import type { RecentRequestResponse } from '../../api/generated/types'
import { useTranslation } from 'react-i18next'

type Props = {
  status: RecentRequestResponse['status']
}

const LABEL_KEYS: Record<NonNullable<RecentRequestResponse['status']>, string> = {
  PENDING: 'status.pending',
  APPROVED: 'status.approved',
  DECLINED: 'status.declined',
  CANCELLED: 'status.cancelled',
}

export function LeaveStatusBadge({ status }: Props) {
  const { t } = useTranslation('common')
  if (!status) {
    return null
  }

  const label = t(LABEL_KEYS[status])
  const className = `badge badge-${status.toLowerCase()}`

  return <span className={className}>{label}</span>
}
