import { useQuery } from '@tanstack/react-query'
import { getPlatformOrganizations } from '../platform-auth/platformApiClient'

export const platformOrganizationsQueryKey = ['platform', 'organizations'] as const

export function usePlatformOrganizations() {
  return useQuery({
    queryKey: platformOrganizationsQueryKey,
    queryFn: getPlatformOrganizations,
  })
}
