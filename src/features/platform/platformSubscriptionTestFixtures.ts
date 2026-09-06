import type { OrganizationSummaryResponse, UpdateSubscriptionRequest } from '../../api/generated/types'

export const mockAcmeForEditSubscription: OrganizationSummaryResponse = {
  id: 1,
  name: 'Nile Harbor',
  primaryContact: 'Jordan Lee',
  initialOrganizationAdminEmail: 'jordan@company.com',
  plan: 'INTERNAL',
  userCount: 6,
  userLimit: 9999,
  status: 'ACTIVE',
  effectiveDate: '2026-06-05',
}

export const validUpdateSubscriptionRequest: UpdateSubscriptionRequest = {
  plan: 'GROWTH',
  billingStatus: 'MANUAL_ACTIVE',
  effectiveDate: '2026-06-27',
}

export const mockUpdatedAcmeSubscription: OrganizationSummaryResponse = {
  ...mockAcmeForEditSubscription,
  plan: 'GROWTH',
  userLimit: 200,
  effectiveDate: '2026-06-27',
}
