// Business: Turn the ONE live job record into everything the detail screen shows. Every value here is
// Business: either read straight from the API response or derived from it (a step, a label, "4 hrs ago").
// Business: Anything the backend does NOT store — photos, free-text internal notes, a separate "extra
// Business: notes" — is simply absent here, never invented. When private Storage arrives (M7) the photo
// Business: count becomes real data and this module will show it; until then the section stays hidden.
// Technical: Pure functions on ApiRequestDetail (the joined admin view + server-derived recommendations).
// No DOM, no fetch — the page script just renders this. Keeps the derivation unit-testable and drift-free.

import type { ApiRequestDetail } from '../../lib/api-client';
import { SERVICE_STATUS_LABEL, getBadgeClass, type ServiceStatusKey } from '../../lib/service-status';

export const REQUEST_STEPS = [
  'Request received',
  'Customer confirmed',
  'Technician assigned',
  'Diagnosis completed',
  'Price approved',
  'Repair completed',
] as const;

// Business: Which of the six steps the case has REACHED (7 = fully done/closed). Presentation mapping,
// Business: kept here rather than in the API because it is about the story we tell, not a stored fact.
const STEP_FOR_STATUS: Record<ServiceStatusKey, number> = {
  NEW_REQUEST: 2, UNDER_REVIEW: 2, ORDER_CONFIRMED: 3, ASSIGNED: 4, TECHNICIAN_CONFIRMED: 4,
  TECHNICIAN_ON_THE_WAY: 4, ARRIVED: 4, DIAGNOSING: 4, PRICE_APPROVAL: 5, IN_PROGRESS: 6,
  WAITING_FOR_PARTS: 6, COMPLETED: 7, INVOICED: 7, PAID: 7, CLOSED: 7, CANCELLED: 7, UNABLE_TO_COMPLETE: 7,
};

// Business: One action the admin can take next, named honestly. Anything needing a write we haven't
// Business: wired on THIS screen renders as a disabled button, not a broken link.
const NEXT_ACTION_FOR_STATUS: Record<ServiceStatusKey, string> = {
  NEW_REQUEST: 'Call and confirm', UNDER_REVIEW: 'Call and confirm', ORDER_CONFIRMED: 'Assign technician',
  ASSIGNED: 'View technician', TECHNICIAN_CONFIRMED: 'View technician', TECHNICIAN_ON_THE_WAY: 'View technician',
  ARRIVED: 'View technician', DIAGNOSING: 'View technician', PRICE_APPROVAL: 'Follow up with customer',
  IN_PROGRESS: 'View technician', WAITING_FOR_PARTS: 'Order parts', COMPLETED: 'Generate invoice',
  INVOICED: 'Record payment', PAID: 'Close request', CLOSED: 'None', CANCELLED: 'None',
  UNABLE_TO_COMPLETE: 'Reassign visit',
};

const NEXT_STEP_FOR_STATUS: Record<ServiceStatusKey, string> = {
  NEW_REQUEST: "Confirm the customer's visit before assigning a technician.",
  UNDER_REVIEW: "Confirm the customer's visit before assigning a technician.",
  ORDER_CONFIRMED: 'Assign the right technician for this appliance.',
  ASSIGNED: 'Await the technician confirming they can take the job.',
  TECHNICIAN_CONFIRMED: 'The technician has confirmed — dispatch is next.',
  TECHNICIAN_ON_THE_WAY: 'The technician is en route to the visit.',
  ARRIVED: 'The technician is on site and diagnosing.',
  DIAGNOSING: 'Await the technician’s findings and repair price.',
  PRICE_APPROVAL: 'Share the quote and get the customer’s approval.',
  IN_PROGRESS: 'Repair underway — await completion.',
  WAITING_FOR_PARTS: 'Awaiting a part before the repair can continue.',
  COMPLETED: 'Repair done — generate the invoice.',
  INVOICED: 'Invoice issued — record the payment.',
  PAID: 'Payment received — close the request.',
  CLOSED: 'This job is complete and closed.',
  CANCELLED: 'This job was cancelled.',
  UNABLE_TO_COMPLETE: 'The technician could not complete — reassign if needed.',
};

const ACTOR_LABEL: Record<string, string> = { admin: 'Admin', technician: 'Technician', customer: 'Customer' };

export interface TimelineEntry {
  title: string;
  desc: string;
  time: string;
  done: boolean;
  current: boolean;
}

export interface RecommendationCard {
  name: string;
  area: string;
  availability: string;
  activeJobs: number;
  reason: string;
}

export interface DetailView {
  code: string;
  title: string;
  statusKey: ServiceStatusKey;
  statusLabel: string;
  badgeClass: string;
  urgent: boolean;
  customerName: string;
  phone: string;
  address: string;
  receivedAgo: string;
  applianceType: string;
  brand: string;
  model: string;
  problem: string;
  preferredVisit: string;
  submitted: string;
  sourceLabel: string;
  createdAt: string;
  lastUpdated: string;
  currentStep: number;
  steps: readonly string[];
  nextAction: string;
  nextStep: string;
  assignedTechnician: string | null;
  timeline: TimelineEntry[];
  diagnosis: { fault: string; quote: string; approved: string } | null;
  recommendations: RecommendationCard[];
}

export function deriveDetail(row: ApiRequestDetail): DetailView {
  const statusKey = row.status as ServiceStatusKey;
  const timeline = buildTimeline(row);
  return {
    code: row.code,
    title: `${row.appliance.type} — ${row.problem}`,
    statusKey,
    statusLabel: SERVICE_STATUS_LABEL[statusKey] ?? row.status,
    badgeClass: getBadgeClass(statusKey),
    urgent: row.urgent === true,
    customerName: row.customer?.name ?? '—',
    phone: row.customer?.phone ?? '',
    address: row.customer?.area ?? '',
    receivedAgo: relativeTime(row.createdAt),
    applianceType: row.appliance.type,
    brand: row.appliance.brand,
    model: row.appliance.model ?? 'Not provided',
    problem: row.problem,
    preferredVisit: row.visitDate ? formatDay(row.visitDate) : 'Not specified',
    submitted: formatDateTime(row.createdAt),
    sourceLabel: row.source === 'Phone' ? 'Phone request' : 'Website request',
    createdAt: formatDateTime(row.createdAt),
    lastUpdated: formatDateTime(row.updatedAt),
    currentStep: STEP_FOR_STATUS[statusKey] ?? 1,
    steps: REQUEST_STEPS,
    nextAction: NEXT_ACTION_FOR_STATUS[statusKey] ?? 'None',
    nextStep: NEXT_STEP_FOR_STATUS[statusKey] ?? '',
    assignedTechnician: row.technician?.name ?? null,
    timeline,
    diagnosis: buildDiagnosis(row),
    recommendations: (row.recommendedTechnicians ?? []).map((t) => ({
      name: t.name,
      area: t.area,
      availability: t.availability,
      activeJobs: t.activeJobs,
      reason: t.matchReason,
    })),
  };
}

// Business: The timeline IS the record's event log — the same events that drive the workflow. We add no
// Business: invented copy: a note the admin wrote is shown; without one we say plainly who moved it.
function buildTimeline(row: ApiRequestDetail): TimelineEntry[] {
  const events = row.timeline ?? [];
  return events.map((event, index) => ({
    title: SERVICE_STATUS_LABEL[event.status as ServiceStatusKey] ?? event.status,
    desc: event.note?.trim() ? event.note : `${ACTOR_LABEL[event.actor] ?? event.actor} updated the status`,
    time: formatDateTime(event.at),
    done: index < events.length - 1,
    current: index === events.length - 1,
  }));
}

// Business: "Diagnosis and repair" comes from the fault + price the admin recorded — nothing else. If
// Business: neither exists yet, the section shows its empty state; we never guess a repair proposal.
function buildDiagnosis(row: ApiRequestDetail): DetailView['diagnosis'] {
  if (!row.fault && !row.price) return null;
  const quote = row.price ? `Rs. ${row.price.amount.toLocaleString('en-IN')} · ${row.price.paymentStatus}` : 'Not quoted yet';
  const approved =
    row.status === 'PRICE_APPROVAL' ? 'Waiting for customer approval'
      : row.price?.paymentStatus === 'Paid' ? 'Paid'
        : row.price ? 'Customer approved — repair proceeding' : '—';
  return { fault: row.fault ?? 'Not recorded yet', quote, approved };
}

function relativeTime(iso: string): string {
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

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
