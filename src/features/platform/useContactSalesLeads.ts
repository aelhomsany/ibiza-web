import { useQuery } from '@tanstack/react-query'
import { getPlatformContactSalesLeads } from '../platform-auth/platformApiClient'

export const contactSalesLeadsQueryKey = ['platform', 'contact-sales-leads'] as const

/**
 * Leads are only read while the create-organization modal is open, and a failure here must not
 * block unassisted provisioning — the modal hides the picker instead of surfacing an error, so
 * retries are pointless noise.
 */
export function useContactSalesLeads() {
  return useQuery({
    queryKey: contactSalesLeadsQueryKey,
    queryFn: getPlatformContactSalesLeads,
    retry: false,
  })
}
