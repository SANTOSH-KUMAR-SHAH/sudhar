// Business: Presentation layer for the canonical service-request statuses. The status
// Business: names, order and transition rules come from packages/shared (one source of
// Business: truth); only the human labels and badge colours live here, so pages never drift.
// Technical: Re-export the shared domain, then layer UI-only maps on top.

import {
  SERVICE_STATUSES,
  ALLOWED_TRANSITIONS,
  isValidTransition,
  type ServiceStatusKey,
} from '../../../packages/shared/src/service-status';

export { SERVICE_STATUSES, ALLOWED_TRANSITIONS, isValidTransition };
export type { ServiceStatusKey };

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

// Business: ALLOWED_TRANSITIONS and isValidTransition are re-exported from packages/shared above.

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
