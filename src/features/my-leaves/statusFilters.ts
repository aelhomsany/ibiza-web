import type { RecentRequestResponse } from '../../api/generated/types'

export type MyLeavesStatusFilter =
  | 'ALL'
  | NonNullable<RecentRequestResponse['status']>

/** Single source of truth for the status segments and URL-param validation. */
export const STATUS_FILTERS: readonly MyLeavesStatusFilter[] = [
  'ALL',
  'PENDING',
  'APPROVED',
  'DECLINED',
]
