import type { OrganizationSummaryResponse, UpdateSubscriptionRequest } from '../../api/generated/types'

export const mockAcmeForEditSubscription: OrganizationSummaryResponse = {
  id: 1,
  name: 'Acme Corp',
  primaryContact: 'Jordan Lee',
  initialHrAdminEmail: 'jordan@company.com',
  plan: 'INTERNAL',
  userCount: 6,
  userLimit: 9999,
  status: 'ACTIVE',
  effectiveDate: '2026-06-05',
}

export const validUpdateSubscriptionRequest: UpdateSubscriptionRequest = {
  plan: 'STARTER',
  billingStatus: 'ACTIVE',
  effectiveDate: '2026-06-27',
}

export const mockUpdatedAcmeSubscription: OrganizationSummaryResponse = {
  ...mockAcmeForEditSubscription,
  plan: 'STARTER',
  userLimit: 50,
  effectiveDate: '2026-06-27',
}
