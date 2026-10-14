// Business: The customer directory answers "who have we served" purely from live data. Request totals,
// Business: distinct appliance count and the last outcome are JOINED from the admin request queue keyed
// Business: by customerId — the backend has no per-customer history endpoint, and we do not fake one.
// Technical: Pure + deterministic. Reuses the roster avatar helpers so a face-colour/initial is stable
// everywhere. A customer with no requests still lists (they exist), just with no outcome badge.
import type { ApiCustomer, ApiRequest } from '../../lib/api-client';
import { initialsFor } from './roster';

export interface CustomerRow {
  id: string;
  name: string;
  initials: string;
  avatarHue: string;
  phone: string;
  area: string;
  totalRequests: number;
  applianceCount: number;
  // Business: Newest request's status drives the row badge; null when this customer has none yet.
  lastOutcomeStatus: string | null;
  lastDate: string;
  // Business: Space-separated quick-filter keys the client filter reads literally (never re-derived there).
  filters: string;
}

// Business: Same calm rotation as the roster, keyed on customer id, so colours stay consistent site-wide.
const HUES = ['#10263D', '#0C7C82', '#8B5CF6', '#3B82F6', '#D97706', '#4A4E52'];

function hueFor(id: string): string {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return HUES[sum % HUES.length]!;
}

const ACTIVE: string[] = [
  'ASSIGNED', 'TECHNICIAN_CONFIRMED', 'TECHNICIAN_ON_THE_WAY', 'ARRIVED',
  'DIAGNOSING', 'PRICE_APPROVAL', 'IN_PROGRESS', 'WAITING_FOR_PARTS', 'NEW_REQUEST', 'UNDER_REVIEW', 'ORDER_CONFIRMED',
];
const DONE: string[] = ['COMPLETED', 'INVOICED', 'PAID', 'CLOSED'];
const CANCELLED: string[] = ['CANCELLED', 'UNABLE_TO_COMPLETE'];

const ago = (iso: string): string => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

// Business: Fold the flat request queue into one honest row per customer — counts and last activity are
// Business: derived, so the directory, dashboard and detail page can never tell three different stories.
// Technical: Newest = by updatedAt. Filters mark which quick-tabs a row belongs to at render time.
export function deriveDirectory(customers: ApiCustomer[], requests: ApiRequest[]): CustomerRow[] {
  return customers.map((customer) => {
    const theirs = requests.filter((r) => r.customerId === customer.id);
    const ordered = [...theirs].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    const newest = ordered[0] ?? null;

    const filters = [
      theirs.some((r) => ACTIVE.includes(r.status)) && 'active',
      theirs.some((r) => DONE.includes(r.status)) && 'completed',
      theirs.some((r) => CANCELLED.includes(r.status)) && 'cancelled',
    ]
      .filter(Boolean)
      .join(' ');

    return {
      id: customer.id,
      name: customer.name,
      initials: initialsFor(customer.name),
      avatarHue: hueFor(customer.id),
      phone: customer.phone,
      area: customer.area,
      totalRequests: theirs.length,
      applianceCount: new Set(theirs.map((r) => r.appliance.type)).size,
      lastOutcomeStatus: newest?.status ?? null,
      lastDate: newest ? ago(newest.updatedAt) : '',
      filters,
    };
  });
}
