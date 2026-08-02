import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updatePlatformOrganizationSubscription } from '../platform-auth/platformApiClient'
import type { UpdateSubscriptionRequest } from '../../api/generated/types'
import { platformOrganizationsQueryKey } from './usePlatformOrganizations'

type UpdateSubscriptionVariables = {
  organizationId: number
  payload: UpdateSubscriptionRequest
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ organizationId, payload }: UpdateSubscriptionVariables) =>
      updatePlatformOrganizationSubscription(organizationId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: platformOrganizationsQueryKey })
    },
  })
}
