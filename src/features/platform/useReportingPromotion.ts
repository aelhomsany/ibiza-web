import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  grantPlatformReportingPromotion,
  revokePlatformReportingPromotion,
  type ReportingPromotionRequest,
} from '../platform-auth/platformApiClient'
import { platformOrganizationsQueryKey } from './usePlatformOrganizations'

export function useGrantReportingPromotion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ organizationId, payload }: { organizationId: number; payload: ReportingPromotionRequest }) =>
      grantPlatformReportingPromotion(organizationId, payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: platformOrganizationsQueryKey }),
  })
}

export function useRevokeReportingPromotion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (organizationId: number) => revokePlatformReportingPromotion(organizationId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: platformOrganizationsQueryKey }),
  })
}
