// Business: Presentation-side role helpers. The canonical role names live in
// Business: packages/shared; only the portal landing routes stay here.
// Technical: Re-export shared roles, then add the frontend PORTAL_HOME map.

import { ROLES, type Role, isStaffRole } from '../../../packages/shared/src/roles';

export { ROLES, isStaffRole };
export type { Role };

export const PORTAL_HOME: Record<Role, string> = {
  customer: '/',
  admin: '/admin/dashboard',
  technician: '/tech/dashboard',
  system: '/',
};

// isStaffRole is re-exported from packages/shared above.
