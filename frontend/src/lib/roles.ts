// Business: Who is allowed to do what — customer, admin, technician, system.
// Business: Frontend uses this only to decide what to SHOW, never to enforce access.
// Technical: Single union; API will enforce every permission check server-side.
export const ROLES = ['customer', 'admin', 'technician', 'system'] as const;

export type Role = (typeof ROLES)[number];

export const PORTAL_HOME: Record<Role, string> = {
  customer: '/',
  admin: '/admin/dashboard',
  technician: '/tech/dashboard',
  system: '/',
};

export function isStaffRole(role: Role): boolean {
  return role === 'admin' || role === 'technician';
}
