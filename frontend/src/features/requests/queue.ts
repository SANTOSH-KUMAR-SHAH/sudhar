// Business: The queue's tabs, labels and "how long ago" are PRESENTATION, not stored data. The API
// Business: hands back a lifecycle record; we decide here what "Needs Action" means and how a status reads.
// Technical: Operates on the live ApiRequest shape (the joined admin view). Nothing here fabricates a
// field the API never sent — if a value is absent (no urgency, no photo count) we simply don't show it.
import type { ApiRequest } from '../../lib/api-client';
import { SERVICE_STATUS_LABEL, getBadgeClass, type ServiceStatusKey } from '../../lib/service-status';

const NEEDS_ACTION: ServiceStatusKey[] = ['NEW_REQUEST', 'ORDER_CONFIRMED', 'PRICE_APPROVAL'];
const ACTIVE: ServiceStatusKey[] = [
  'ASSIGNED', 'TECHNICIAN_CONFIRMED', 'TECHNICIAN_ON_THE_WAY', 'ARRIVED',
  'DIAGNOSING', 'PRICE_APPROVAL', 'IN_PROGRESS', 'WAITING_FOR_PARTS',
];
const DONE: ServiceStatusKey[] = ['COMPLETED', 'INVOICED', 'PAID', 'CLOSED'];

// Technical: The status-only helpers below take just `{ status }` so BOTH the admin queue (ApiRequest) and
// the technician job view (which omits the technician join) share the exact same active/done/label rules.
export function statusKey(row: { status: string }): ServiceStatusKey {
  return row.status as ServiceStatusKey;
}

export function needsAction(row: { status: string }): boolean {
  return NEEDS_ACTION.includes(statusKey(row));
}
export function isActive(row: { status: string }): boolean {
  return ACTIVE.includes(statusKey(row));
}
export function isDone(row: { status: string }): boolean {
  return DONE.includes(statusKey(row));
}

// Business: One row can be "live" and "needs action" at once (a price awaiting approval is both).
// Technical: Membership is encoded as space-separated tab keys the client filter reads literally.
export function tabsFor(row: ApiRequest): string {
  return [needsAction(row) && 'action', isActive(row) && 'active', isDone(row) && 'done']
    .filter(Boolean)
    .join(' ');
}

export function applianceLabel(row: ApiRequest): string {
  return `${row.appliance.brand} ${row.appliance.type}`.trim();
}

export function customerName(row: ApiRequest): string {
  return row.customer?.name ?? '—';
}

export function areaLabel(row: ApiRequest): string {
  return row.customer?.area ?? '';
}

export function technicianName(row: ApiRequest): string | null {
  return row.technician?.name ?? null;
}

export function statusLabel(row: { status: string }): string {
  return SERVICE_STATUS_LABEL[statusKey(row)] ?? row.status;
}

export function badgeClass(row: { status: string }): string {
  return getBadgeClass(statusKey(row));
}

// Business: The Nepal clock stamped every update; staff read "4 hrs ago" far faster than an ISO string.
// Technical: Coarse buckets — precise to how an ops queue is actually scanned, never misleadingly exact.
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.round((Date.now() - then) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(then).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
