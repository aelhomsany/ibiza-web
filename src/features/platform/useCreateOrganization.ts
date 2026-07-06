import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createPlatformOrganization } from '../../api/client'
import type { CreateOrganizationRequest } from '../../api/generated/types'
import { platformOrganizationsQueryKey } from './usePlatformOrganizations'

export function useCreateOrganization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateOrganizationRequest) => createPlatformOrganization(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: platformOrganizationsQueryKey })
    },
  })
}
