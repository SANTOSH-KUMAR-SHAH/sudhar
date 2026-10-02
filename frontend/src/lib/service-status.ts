// Business: One canonical list of service-request states so admin, tech and customer
// Business: pages never drift apart ("Diagnosing" vs "diagnosing" vs "In progress").
// Technical: String-union + lookup tables; mirrors prd.md §8 and systemprompt.md §5.
// NOTE: When packages/shared/src/service-status.ts exists (backend phase), this
// file must re-export from there instead of duplicating. Frontend-only for now.

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

export const SERVICE_STATUS_LABEL: Record<ServiceStatusKey, string> = {
  NEW_REQUEST: 'New Request',
  UNDER_REVIEW: 'Under Review',
  ORDER_CONFIRMED: 'Order Confirmed',
  ASSIGNED: 'Assigned',
  TECHNICIAN_CONFIRMED: 'Technician Confirmed',
  TECHNICIAN_ON_THE_WAY: 'Technician On the Way',
  ARRIVED: 'Arrived',
  DIAGNOSING: 'Diagnosing',
  PRICE_APPROVAL: 'Price Approval',
  IN_PROGRESS: 'In Progress',
  WAITING_FOR_PARTS: 'Waiting for Parts',
  COMPLETED: 'Completed',
  INVOICED: 'Invoiced',
  PAID: 'Paid',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
  UNABLE_TO_COMPLETE: 'Unable to Complete',
};

// Business: Badge colour must stay stable even as labels are reworded.
// Technical: Maps every status to an existing .badge-* class from AdminDashboardLayout
// so no visual change is introduced by this refactor.
export const SERVICE_STATUS_BADGE: Record<ServiceStatusKey, string> = {
  NEW_REQUEST: 'badge-new',
  UNDER_REVIEW: 'badge-warn',
  ORDER_CONFIRMED: 'badge-confirm',
  ASSIGNED: 'badge-assigned',
  TECHNICIAN_CONFIRMED: 'badge-assigned',
  TECHNICIAN_ON_THE_WAY: 'badge-assigned',
  ARRIVED: 'badge-assigned',
  DIAGNOSING: 'badge-progress',
  PRICE_APPROVAL: 'badge-progress',
  IN_PROGRESS: 'badge-progress',
  WAITING_FOR_PARTS: 'badge-warn',
  COMPLETED: 'badge-done',
  INVOICED: 'badge-confirm',
  PAID: 'badge-done',
  CLOSED: 'badge-neutral',
  CANCELLED: 'badge-cancel',
  UNABLE_TO_COMPLETE: 'badge-cancel',
};

// Business: Every transition must have a defined actor and rule (systemprompt §5).
// Technical: Adjacency list of the happy path + explicit escape hatches. Anything
// not listed here is blocked by isValidTransition().
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

// Business: Cancellation is locked once the admin confirms the order with the customer.
// Technical: Check ORDER_CONFIRMED status before allowing any CANCELLED transition.
export function isValidTransition(from: ServiceStatusKey, to: ServiceStatusKey): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getStatusLabel(key: ServiceStatusKey): string {
  return SERVICE_STATUS_LABEL[key];
}

export function getBadgeClass(key: ServiceStatusKey): string {
  return SERVICE_STATUS_BADGE[key];
}

// Business: Legacy mock pages store loose strings ("On the Way", "diagnosing").
// Technical: Normalise them to the canonical key so old mocks keep rendering
// while new code uses the union type. Unknown strings fall back to NEW_REQUEST.
const LEGACY_ALIAS: Record<string, ServiceStatusKey> = {
  'new request': 'NEW_REQUEST',
  new: 'NEW_REQUEST',
  'under review': 'UNDER_REVIEW',
  'needs confirmation': 'UNDER_REVIEW',
  'needs_confirmation': 'UNDER_REVIEW',
  'order confirmed': 'ORDER_CONFIRMED',
  'customer confirmed': 'ORDER_CONFIRMED',
  confirmed: 'ORDER_CONFIRMED',
  assigned: 'ASSIGNED',
  unassigned: 'ASSIGNED',
  'technician confirmed': 'TECHNICIAN_CONFIRMED',
  'on the way': 'TECHNICIAN_ON_THE_WAY',
  'on_the_way': 'TECHNICIAN_ON_THE_WAY',
  arrived: 'ARRIVED',
  diagnosing: 'DIAGNOSING',
  'price approval': 'PRICE_APPROVAL',
  'waiting for customer decision': 'PRICE_APPROVAL',
  'in progress': 'IN_PROGRESS',
  in_progress: 'IN_PROGRESS',
  'waiting for parts': 'WAITING_FOR_PARTS',
  completed: 'COMPLETED',
  done: 'COMPLETED',
  invoiced: 'INVOICED',
  paid: 'PAID',
  closed: 'CLOSED',
  cancelled: 'CANCELLED',
  'unable to complete': 'UNABLE_TO_COMPLETE',
};

export function normaliseStatus(input: string): ServiceStatusKey {
  const key = input.trim().toLowerCase();
  return LEGACY_ALIAS[key] ?? 'NEW_REQUEST';
}
