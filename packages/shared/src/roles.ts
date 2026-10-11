// Business: Who is in the system — customer, admin, technician, or the system itself.
// Business: The frontend uses this only to decide what to SHOW; the API enforces access.
// Technical: One union reused by both sides so role words never drift. Portal routes
// (e.g. where an admin lands) stay in the frontend, not here.

export const ROLES = ['customer', 'admin', 'technician', 'system'] as const;

export type Role = (typeof ROLES)[number];

// Business: "Staff" = the two authenticated internal roles; customers are guests.
export function isStaffRole(role: Role): boolean {
  return role === 'admin' || role === 'technician';
}
