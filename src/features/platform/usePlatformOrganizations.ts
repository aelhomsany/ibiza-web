import { useQuery } from '@tanstack/react-query'
import { getPlatformOrganizations } from '../../api/client'

export const platformOrganizationsQueryKey = ['platform', 'organizations'] as const

export function usePlatformOrganizations() {
  return useQuery({
    queryKey: platformOrganizationsQueryKey,
    queryFn: getPlatformOrganizations,
  })
}
