import type { RecentRequestResponse } from '../../api/generated/types'

type Props = {
  status: RecentRequestResponse['status']
}

const LABELS: Record<NonNullable<RecentRequestResponse['status']>, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
}

export function LeaveStatusBadge({ status }: Props) {
  if (!status) {
    return null
  }

  const label = LABELS[status]
  const className = `badge badge-${status.toLowerCase()}`

  return <span className={className}>{label}</span>
}
