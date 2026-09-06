import type { UserRole } from '../api/generated/types'

/**
 * Which roles may reach org Settings.
 *
 * Deliberately its own module, free of nav catalog data and icon imports: `UserMenu`
 * is shared by the org and Platform Admin shells, so anything it imports statically
 * lands in BOTH built artifacts. Importing `ORG_NAV_ITEMS` here shipped the org nav
 * labels, paths, and testids (`nav-calendar`, `nav-my-leaves`, `nav-approvals`) into
 * the admin bundle, which `verify-artifact-boundaries.mjs` does not grep for.
 * `rolePermissions.ts` consumes this constant so there is still one source of truth.
 */
export const SETTINGS_REQUIRED_ROLES: UserRole[] = ['ORGANIZATION_ADMIN']

export function canAccessSettings(role: UserRole): boolean {
  return SETTINGS_REQUIRED_ROLES.includes(role)
}
