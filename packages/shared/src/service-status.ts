// Business: The ONE canonical list of service-request states, shared by the website,
// Business: the API and (later) the database, so a status never goes by two names.
// Technical: Pure string-union + adjacency table. No UI (labels/colours) lives here —
// that stays in the frontend. This file must not import anything app-specific.

export const SERVICE_STATUSES = [
  'NEW_REQUEST',
  'UNDER_REVIEW',
  'ORDER_CONFIRMED',
  'ASSIGNED',
  'TECHNICIAN_CONFIRMED',
  'TECHNICIAN_ON_THE_WAY',
  'ARRIVED',
  'DIAGNOSING',
  'PRICE_APPROVAL',
  'IN_PROGRESS',
  'WAITING_FOR_PARTS',
  'COMPLETED',
  'INVOICED',
  'PAID',
  'CLOSED',
  'CANCELLED',
  'UNABLE_TO_COMPLETE',
] as const;

export type ServiceStatusKey = (typeof SERVICE_STATUSES)[number];

// Business: Every transition must have a defined rule. Anything not listed is blocked,
// Business: which is what keeps a case from jumping "new" straight to "done".
// Technical: Adjacency of the happy path + explicit escape hatches (CANCELLED,
// UNABLE_TO_COMPLETE). This is the state machine the API enforces on every write.
export const ALLOWED_TRANSITIONS: Record<ServiceStatusKey, ServiceStatusKey[]> = {
  NEW_REQUEST: ['UNDER_REVIEW', 'CANCELLED'],
  UNDER_REVIEW: ['ORDER_CONFIRMED', 'CANCELLED'],
  ORDER_CONFIRMED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['TECHNICIAN_CONFIRMED', 'CANCELLED', 'UNABLE_TO_COMPLETE'],
  TECHNICIAN_CONFIRMED: ['TECHNICIAN_ON_THE_WAY', 'CANCELLED', 'UNABLE_TO_COMPLETE'],
  TECHNICIAN_ON_THE_WAY: ['ARRIVED', 'UNABLE_TO_COMPLETE'],
  ARRIVED: ['DIAGNOSING', 'UNABLE_TO_COMPLETE'],
  DIAGNOSING: ['PRICE_APPROVAL', 'IN_PROGRESS', 'UNABLE_TO_COMPLETE'],
  PRICE_APPROVAL: ['IN_PROGRESS', 'CANCELLED', 'UNABLE_TO_COMPLETE'],
  IN_PROGRESS: ['WAITING_FOR_PARTS', 'COMPLETED', 'UNABLE_TO_COMPLETE'],
  WAITING_FOR_PARTS: ['IN_PROGRESS', 'UNABLE_TO_COMPLETE'],
  COMPLETED: ['INVOICED'],
  INVOICED: ['PAID'],
  PAID: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
  UNABLE_TO_COMPLETE: [],
};

// Business: The single yes/no the API asks before applying any status change.
// Technical: Cancellation is only reachable where it is listed, so it is naturally
// locked once the admin has confirmed the order and moved past CANCELLED-eligible steps.
export function isValidTransition(from: ServiceStatusKey, to: ServiceStatusKey): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isServiceStatus(value: unknown): value is ServiceStatusKey {
  return typeof value === 'string' && (SERVICE_STATUSES as readonly string[]).includes(value);
}
