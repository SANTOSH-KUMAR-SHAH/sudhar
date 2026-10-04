// Business: One demo database for the whole staff tool. Every admin/tech page reads
// Business: from these arrays, so a request never shows two different truths on two pages.
// Technical: Single source of truth until the backend API replaces it. Pages must not
// define their own mock arrays; they call the selectors below. When GET /api/* lands,
// delete this file and point pages at api-client.ts — no page-level data edits needed.

import type {
  CustomerSummary,
  ServiceRequestDetail,
  ServiceRequestSummary,
  TechnicianSummary,
  TimelineEntry,
  Availability,
} from './types';
import type { ServiceStatusKey } from './service-status';
import { SERVICE_STATUS_LABEL, SERVICE_STATUS_BADGE, getBadgeClass } from './service-status';
import { maskPhone } from './format';

/* ─────────────────────────────────────────────────────────────────────────────
   Progress tracker (admin request detail)
   ─────────────────────────────────────────────────────────────────────────── */

// Business: The six-step tracker is the story of one repair; each status lights it up
// to the step the case actually reached.
// Technical: status → index of the CURRENT (unfinished) step, 1-based. 7 = all done.
export const REQUEST_STEPS = [
  'Request received',
  'Customer confirmed',
  'Technician assigned',
  'Diagnosis completed',
  'Price approved',
  'Repair completed',
] as const;

const STEP_FOR_STATUS: Record<ServiceStatusKey, number> = {
  NEW_REQUEST: 2,
  UNDER_REVIEW: 2,
  ORDER_CONFIRMED: 3,
  ASSIGNED: 4,
  TECHNICIAN_CONFIRMED: 4,
  TECHNICIAN_ON_THE_WAY: 4,
  ARRIVED: 4,
  DIAGNOSING: 4,
  PRICE_APPROVAL: 5,
  IN_PROGRESS: 6,
  WAITING_FOR_PARTS: 6,
  COMPLETED: 7,
  INVOICED: 7,
  PAID: 7,
  CLOSED: 7,
  CANCELLED: 7,
  UNABLE_TO_COMPLETE: 7,
};

// Business: The sidebar "Next step" card always names one action the admin can take.
// Technical: Status → action label; the page decides if it is a tel: link or a
// disabled backend-pending button.
const NEXT_ACTION_FOR_STATUS: Record<ServiceStatusKey, string> = {
  NEW_REQUEST: 'Call and confirm',
  UNDER_REVIEW: 'Call and confirm',
  ORDER_CONFIRMED: 'Assign technician',
  ASSIGNED: 'View technician',
  TECHNICIAN_CONFIRMED: 'View technician',
  TECHNICIAN_ON_THE_WAY: 'View technician',
  ARRIVED: 'View technician',
  DIAGNOSING: 'View technician',
  PRICE_APPROVAL: 'Follow up with customer',
  IN_PROGRESS: 'View technician',
  WAITING_FOR_PARTS: 'Order parts',
  COMPLETED: 'Generate invoice',
  INVOICED: 'Record payment',
  PAID: 'Close request',
  CLOSED: 'None',
  CANCELLED: 'None',
  UNABLE_TO_COMPLETE: 'Reassign visit',
};

/* ─────────────────────────────────────────────────────────────────────────────
   Technicians
   ─────────────────────────────────────────────────────────────────────────── */

export interface TechnicianActivityEntry {
  action: string;
  desc: string;
  time: string;
}

// Business: A technician's day is real work: past visits done, the current one,
// upcoming ones. All three come from the request table, never from a second mock.
// Technical: Schedule rows are derived; only clock times are stored per request.
export interface DemoTechnicianRecord extends TechnicianSummary {
  subtitle: string;
  techCode: string;
  joined: string;
  serviceAreas: string[];
  preference: string;
  workload: { label: string; desc: string; level: number };
  activity: TechnicianActivityEntry[];
  notes: string;
  lastActive: string;
  statusLine: string;
}

export const DEMO_TECHNICIANS: DemoTechnicianRecord[] = [
  {
    id: 'BT', name: 'Bikash Thapa', phone: '9847 220 115',
    area: 'Baneshwor / Koteshwor', availability: 'online',
    currentJobId: null, currentJobStatus: null,
    skills: ['Washing Machine', 'Refrigerator'],
    completedThisWeek: 5, avatarHue: '#10263D',
    subtitle: 'Appliance Repair Technician · Kathmandu Valley',
    techCode: 'TECH-006', joined: 'March 2026',
    serviceAreas: ['Baneshwor', 'Koteshwor', 'Maharajgunj', 'Chabahil'],
    preference: 'Full-time · Kathmandu Valley · Same-day visits',
    workload: { label: 'Light workload', desc: '1 visit scheduled today', level: 2 },
    activity: [
      { action: 'Marked online', desc: 'Available to receive assignments', time: 'Today · 8:15 AM' },
      { action: 'Confirmed on the way', desc: 'Request SL-000122', time: 'Today · 9:05 AM' },
      { action: 'Completed TV repair', desc: 'Request SL-000110', time: 'Yesterday · 4:20 PM' },
    ],
    notes: 'Strong with washing machines and refrigerators. Confirm spare-parts availability before assigning compressor work.',
    lastActive: 'Active now',
    statusLine: 'Online · On the way to a visit',
  },
  {
    id: 'RK', name: 'Ramesh KC', phone: '9802 778 451',
    area: 'Lalitpur / Patan', availability: 'online',
    currentJobId: null, currentJobStatus: null,
    skills: ['TV', 'AC', 'Washing Machine'],
    completedThisWeek: 4, avatarHue: '#0C7C82',
    subtitle: 'Senior AC Technician · Kathmandu Valley',
    techCode: 'TECH-002', joined: 'January 2025',
    serviceAreas: ['Koteshwor', 'Bagbazar', 'Lalitpur', 'Patan'],
    preference: 'Full-time · Morning preferred',
    workload: { label: 'Busy workload', desc: '2 visits today, 1 in progress', level: 4 },
    activity: [
      { action: 'Started travel', desc: 'Request SL-000123', time: 'Today · 10:40 AM' },
      { action: 'Marked online', desc: 'Available to receive assignments', time: 'Today · 8:00 AM' },
      { action: 'Submitted diagnosis', desc: 'Request SL-000104', time: 'Yesterday · 3:10 PM' },
    ],
    notes: 'Expert in AC installations and complex diagnoses. First pick for compressor faults.',
    lastActive: 'Active 5 min ago',
    statusLine: 'Online · On a visit',
  },
  {
    id: 'SR', name: 'Suman Rai', phone: '9818 330 664',
    area: 'Maharajgunj / Baluwatar', availability: 'online',
    currentJobId: null, currentJobStatus: null,
    skills: ['AC', 'Refrigerator'],
    completedThisWeek: 3, avatarHue: '#8B5CF6',
    subtitle: 'Refrigeration Technician · Kathmandu Valley',
    techCode: 'TECH-004', joined: 'June 2025',
    serviceAreas: ['Kirtipur', 'Lalitpur', 'Maharajgunj'],
    preference: 'Full-time · Flexible timings',
    workload: { label: 'Heavy workload', desc: '2 active requests at once', level: 5 },
    activity: [
      { action: 'Started repair', desc: 'Request SL-000118', time: 'Today · 8:05 AM' },
      { action: 'Submitted price proposal', desc: 'Request SL-000121', time: 'Today · 7:50 AM' },
      { action: 'Marked online', desc: 'Available to receive assignments', time: 'Today · 7:40 AM' },
    ],
    notes: 'Handles back-to-back visits well. Pair with younger technicians for training.',
    lastActive: 'Active now',
    statusLine: 'Online · Two active jobs',
  },
  {
    id: 'PS', name: 'Prabin Shrestha', phone: '9860 415 208',
    area: 'Kirtipur / Kalanki', availability: 'offline',
    currentJobId: null, currentJobStatus: null,
    skills: ['TV', 'Washing Machine'],
    completedThisWeek: 6, avatarHue: '#4A4E52',
    subtitle: 'Appliance Repair Technician · Kathmandu Valley',
    techCode: 'TECH-007', joined: 'August 2026',
    serviceAreas: ['Kirtipur', 'Kalanki', 'Patan'],
    preference: 'Part-time · Weekends preferred',
    workload: { label: 'Off duty', desc: 'Not accepting visits right now', level: 0 },
    activity: [
      { action: 'Marked offline', desc: 'End of shift', time: 'Today · 6:30 AM' },
      { action: 'Completed washing machine repair', desc: 'Request SL-000112', time: 'Yesterday · 5:45 PM' },
    ],
    notes: 'Highest weekly completion count on the team. Reliable on weekend peaks.',
    lastActive: '3 hours ago',
    statusLine: 'Offline · Off duty',
  },
  {
    id: 'NG', name: 'Nabin Gurung', phone: '9851 602 374',
    area: 'Bhaktapur / Dhulikhel', availability: 'offline',
    currentJobId: null, currentJobStatus: null,
    skills: ['AC', 'TV'],
    completedThisWeek: 2, avatarHue: '#4A4E52',
    subtitle: 'AC & TV Specialist · Kathmandu Valley',
    techCode: 'TECH-009', joined: 'February 2026',
    serviceAreas: ['Bhaktapur', 'Dhulikhel', 'Sankhu'],
    preference: 'Full-time · Outer-ring areas only',
    workload: { label: 'Off duty', desc: 'Not accepting visits right now', level: 0 },
    activity: [
      { action: 'Marked offline', desc: 'End of shift', time: 'Yesterday · 7:00 PM' },
      { action: 'Completed AC gas refill', desc: 'Request SL-000108', time: 'Yesterday · 4:30 PM' },
    ],
    notes: 'Covers the outer ring where no other technician travels. Long travel times — schedule generously.',
    lastActive: 'Yesterday',
    statusLine: 'Offline · Off duty',
  },
  {
    id: 'DS', name: 'Dev Shrestha', phone: '9844 771 096',
    area: 'Budhanilkantha', availability: 'offline',
    currentJobId: null, currentJobStatus: null,
    skills: ['Refrigerator', 'Washing Machine'],
    completedThisWeek: 1, avatarHue: '#4A4E52',
    subtitle: 'Appliance Repair Technician · Kathmandu Valley',
    techCode: 'TECH-011', joined: 'September 2026',
    serviceAreas: ['Budhanilkantha', 'Chabahil', 'Kathmandu-3'],
    preference: 'Full-time · In training',
    workload: { label: 'Off duty', desc: 'Not accepting visits right now', level: 0 },
    activity: [
      { action: 'Marked offline', desc: 'End of shift', time: 'Today · 5:00 AM' },
      { action: 'Shadowed refrigerator visit', desc: 'With Suman Rai', time: 'Monday · 11:00 AM' },
    ],
    notes: 'Newest technician. Shadowing phase — assign simple refrigerator jobs only for now.',
    lastActive: 'Today',
    statusLine: 'Offline · In training hours',
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Customers
   ─────────────────────────────────────────────────────────────────────────── */

export interface CustomerApplianceRecord {
  name: string;
  model: string;
  lastService: string;
  outcome: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral' | 'active';
}

// Business: Closed cases give the customer's record depth and honest history.
// Technical: Only open queue requests (DEMO_REQUESTS) get a detail page; history
// rows are display records — the UI links a row only when requestExists(id) is true.
export interface CustomerHistoryRow {
  id: string;
  appliance: string;
  problem: string;
  date: string;
  technician: string;
  outcome: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral' | 'active';
}

export interface DemoCustomerRecord {
  id: string;
  name: string;
  initials: string;
  phone: string;
  area: string;
  address: string;
  since: string;
  preferredContact: string;
  avatarColor: string;
  appliances: CustomerApplianceRecord[];
  history: CustomerHistoryRow[];
  internalNotes: Array<{ text: string; author: string; date: string }>;
  billing: { recorded: number; paid: number; pending: number; latestInvoice: string; paymentStatus: 'Paid' | 'Pending' };
  communication: Array<{ type: string; date: string }>;
}

export const DEMO_CUSTOMERS: DemoCustomerRecord[] = [
  {
    id: 'HT', name: 'Hari Thapa', initials: 'HT', phone: '9841 445 220',
    area: 'Baneshwor', address: 'Near the main road, Baneshwor, Kathmandu',
    since: 'September 2026', preferredContact: 'Phone', avatarColor: '#10263D',
    appliances: [
      { name: 'LG Washing Machine', model: 'FHM1207', lastService: 'Today', outcome: 'Successful Repair', tone: 'success' },
      { name: 'Samsung Refrigerator', model: 'Not provided', lastService: 'August 29', outcome: 'Repair Declined', tone: 'warning' },
    ],
    history: [
      { id: 'SL-000089', appliance: 'Samsung Refrigerator', problem: 'Not cooling', date: 'August 29', technician: 'Suman Rai', outcome: 'Repair Declined', tone: 'warning' },
      { id: 'SL-000056', appliance: 'LG Washing Machine', problem: 'Water leakage', date: 'August 12', technician: 'Ramesh KC', outcome: 'Customer Cancelled', tone: 'danger' },
      { id: 'SL-000031', appliance: 'LG Washing Machine', problem: 'Drain pump blockage', date: 'July 20', technician: 'Ramesh KC', outcome: 'Successful Repair', tone: 'success' },
    ],
    internalNotes: [
      { text: 'Customer prefers phone calls.', author: 'Sudhar Lab Admin', date: 'Today' },
      { text: 'Customer has two appliances at the same address.', author: 'Sudhar Lab Admin', date: 'August 20' },
    ],
    billing: { recorded: 2, paid: 1, pending: 1, latestInvoice: 'INV-00031', paymentStatus: 'Pending' },
    communication: [
      { type: 'Phone call', date: 'Today' },
      { type: 'Confirmation discussion', date: 'Yesterday' },
      { type: 'Price discussion', date: 'August 29' },
    ],
  },
  {
    id: 'MS', name: 'Mina Shrestha', initials: 'MS', phone: '9802 118 452',
    area: 'Lalitpur', address: 'Pulchowk, Lalitpur',
    since: 'July 2026', preferredContact: 'Phone', avatarColor: '#0C7C82',
    appliances: [
      { name: 'Samsung AC', model: 'AR18', lastService: 'Today', outcome: 'Awaiting price decision', tone: 'neutral' },
    ],
    history: [
      { id: 'SL-000045', appliance: 'Samsung AC', problem: 'Gas refill', date: 'July 15', technician: 'Suman Rai', outcome: 'Successful Repair', tone: 'success' },
    ],
    internalNotes: [],
    billing: { recorded: 1, paid: 1, pending: 0, latestInvoice: 'INV-00045', paymentStatus: 'Paid' },
    communication: [
      { type: 'Price discussion', date: 'Today' },
    ],
  },
  {
    id: 'SRK', name: 'Suresh Rai', initials: 'SR', phone: '9818 443 220',
    area: 'Koteshwor', address: 'Koteshwor, Kathmandu',
    since: 'May 2026', preferredContact: 'None', avatarColor: '#8B5CF6',
    appliances: [
      { name: 'Samsung AC', model: '1.5 ton', lastService: 'Today', outcome: 'Diagnosing', tone: 'active' },
      { name: 'Whirlpool Microwave', model: 'Not provided', lastService: 'July 30', outcome: 'Successful Repair', tone: 'success' },
      { name: 'LG Washing Machine', model: 'Not provided', lastService: 'June 18', outcome: 'Customer Cancelled', tone: 'danger' },
    ],
    history: [
      { id: 'SL-000098', appliance: 'Whirlpool Microwave', problem: 'Not heating', date: 'July 30', technician: 'Bikash Thapa', outcome: 'Successful Repair', tone: 'success' },
      { id: 'SL-000072', appliance: 'LG Washing Machine', problem: 'Spin vibration', date: 'June 18', technician: 'Prabin Shrestha', outcome: 'Customer Cancelled', tone: 'danger' },
      { id: 'SL-000041', appliance: 'Samsung AC', problem: 'Gas refill', date: 'May 24', technician: 'Ramesh KC', outcome: 'Successful Repair', tone: 'success' },
    ],
    internalNotes: [
      { text: 'Repeat customer. Owns three serviced appliances.', author: 'Sudhar Lab Admin', date: 'May 24' },
    ],
    billing: { recorded: 3, paid: 2, pending: 1, latestInvoice: 'INV-00041', paymentStatus: 'Paid' },
    communication: [
      { type: 'Phone call', date: 'Today' },
      { type: 'Price discussion', date: 'July 30' },
    ],
  },
  {
    id: 'AG', name: 'Anita Gurung', initials: 'AG', phone: '9860 210 778',
    area: 'Maharajgunj', address: 'Maharajgunj, Kathmandu',
    since: 'August 2026', preferredContact: 'Phone', avatarColor: '#4A4E52',
    appliances: [
      { name: 'Sony TV', model: 'Bravia 43"', lastService: 'Today', outcome: 'Technician on the way', tone: 'active' },
    ],
    history: [
      { id: 'SL-000090', appliance: 'Sony TV', problem: 'No picture', date: 'September 10', technician: 'Ramesh KC', outcome: 'Customer Cancelled', tone: 'danger' },
    ],
    internalNotes: [],
    billing: { recorded: 1, paid: 0, pending: 1, latestInvoice: 'INV-00090', paymentStatus: 'Pending' },
    communication: [
      { type: 'Phone call', date: 'Today' },
    ],
  },
  {
    id: 'BR', name: 'Bikash Rai', initials: 'BR', phone: '9851 776 901',
    area: 'Kirtipur', address: 'Kirtipur, Kathmandu',
    since: 'September 2026', preferredContact: 'None', avatarColor: '#D97706',
    appliances: [
      { name: 'Whirlpool Refrigerator', model: 'WB400', lastService: 'Today', outcome: 'Repair in progress', tone: 'active' },
    ],
    history: [
      { id: 'SL-000110', appliance: 'Whirlpool Refrigerator', problem: 'Noise after power cut', date: 'September 8', technician: 'No technician visited', outcome: 'No Technician Visit', tone: 'neutral' },
    ],
    internalNotes: [
      { text: 'Second visit after a no-show. Prioritise completion.', author: 'Sudhar Lab Admin', date: 'Today' },
    ],
    billing: { recorded: 1, paid: 0, pending: 1, latestInvoice: 'INV-00110', paymentStatus: 'Pending' },
    communication: [
      { type: 'Phone call', date: 'Today' },
    ],
  },
  {
    id: 'SU', name: 'Sunita Rai', initials: 'SU', phone: '9803 552 117',
    area: 'Lalitpur', address: 'Kupondole, Lalitpur',
    since: 'September 2026', preferredContact: 'None', avatarColor: '#0A666B',
    appliances: [
      { name: 'Samsung Refrigerator', model: 'Not provided', lastService: 'Today', outcome: 'New request', tone: 'active' },
    ],
    history: [],
    internalNotes: [],
    billing: { recorded: 0, paid: 0, pending: 0, latestInvoice: '—', paymentStatus: 'Pending' },
    communication: [],
  },
  {
    id: 'GS', name: 'Gita Sharma', initials: 'GS', phone: '9841 902 385',
    area: 'Bagbazar', address: 'Bagbazar, Kathmandu',
    since: 'June 2026', preferredContact: 'Phone', avatarColor: '#BE185D',
    appliances: [
      { name: 'Sony TV', model: 'Not provided', lastService: 'Today', outcome: 'Successful Repair', tone: 'success' },
    ],
    history: [
      { id: 'SL-000060', appliance: 'Sony TV', problem: 'Remote not responding', date: 'June 30', technician: 'Nabin Gurung', outcome: 'Successful Repair', tone: 'success' },
    ],
    internalNotes: [],
    billing: { recorded: 2, paid: 2, pending: 0, latestInvoice: 'INV-00117', paymentStatus: 'Paid' },
    communication: [
      { type: 'Phone call', date: 'Today' },
    ],
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Requests — the operational queue (SL-000117 … SL-000126)
   ─────────────────────────────────────────────────────────────────────────── */

export interface RequestDiagnosis {
  fault: string;
  proposal: string;
  submittedAt: string;
}

// Business: One row per live service case. customerName/phone/address are NOT
// stored here — they are joined from the customer record so they can never drift.
// Technical: currentStep, status label, badge and next action all derive from
// the status key; pages consume getRequestById() / getRequestSummary().
export interface DemoRequestRecord
  extends Omit<ServiceRequestDetail, 'customerName' | 'phone' | 'address' | 'currentStep'> {
  customerId: string;
  technicianId: string | null;
  urgent?: boolean;
  visitTime: string;
  diagnosis?: RequestDiagnosis;
  suggestedTechnicianIds?: string[];
}

export const DEMO_REQUESTS: DemoRequestRecord[] = [
  {
    id: 'SL-000126',
    title: 'Washing machine not draining after spin',
    status: 'NEW_REQUEST',
    customerId: 'HT',
    technicianId: null,
    urgent: true,
    applianceType: 'Washing machine', brand: 'LG', model: 'FHM1207',
    problem: 'Not draining after spin cycle',
    preferredVisit: 'Today · 3–5 PM',
    visitTime: '3:00 PM',
    receivedAgo: 'Just now',
    submitted: 'Today · 11:47 AM',
    extraNotes: 'Customer is available after 3 PM.',
    problemDesc: 'The machine fills and spins normally but leaves the water inside at the end of the cycle. The problem started this morning.',
    photoCount: 1,
    internalNote: 'Customer prefers a call after 6 PM. Confirm parking access before assigning the visit.',
    createdAt: 'Today, 11:47 AM',
    lastUpdated: 'Today, 11:47 AM',
    source: 'Website request',
    nextStep: "Confirm the customer's visit before assigning a technician.",
    nextAction: 'Call and confirm',
    timeline: [
      { title: 'Request received', desc: 'Customer submitted a washing machine repair request', time: 'Today · 11:47 AM', done: false, current: true },
    ] satisfies TimelineEntry[],
  },
  {
    id: 'SL-000125',
    title: 'Refrigerator not cooling, makes loud noise',
    status: 'NEW_REQUEST',
    customerId: 'SU',
    technicianId: null,
    urgent: true,
    applianceType: 'Refrigerator', brand: 'Samsung', model: 'Not provided',
    problem: 'Not cooling, loud noise',
    preferredVisit: 'Tomorrow · Morning',
    visitTime: '10:00 AM',
    receivedAgo: '14 min ago',
    submitted: 'Today · 11:33 AM',
    extraNotes: 'Noise gets louder at night.',
    problemDesc: 'The refrigerator runs but the fridge compartment stays warm. A loud grinding noise comes from the back, started two days ago.',
    photoCount: 0,
    internalNote: '',
    createdAt: 'Today, 11:33 AM',
    lastUpdated: 'Today, 11:33 AM',
    source: 'Phone request',
    nextStep: "Confirm the customer's visit before assigning a technician.",
    nextAction: 'Call and confirm',
    timeline: [
      { title: 'Request received', desc: 'Request captured by phone and entered into the queue', time: 'Today · 11:33 AM', done: false, current: true },
    ] satisfies TimelineEntry[],
  },
  {
    id: 'SL-000124',
    title: 'Washing machine not draining',
    status: 'ORDER_CONFIRMED',
    customerId: 'HT',
    technicianId: null,
    urgent: false,
    applianceType: 'Washing machine', brand: 'LG', model: 'FHM1207',
    problem: 'Not draining',
    preferredVisit: 'Today · Afternoon',
    visitTime: '2:00 PM',
    receivedAgo: 'Yesterday',
    submitted: 'Yesterday · 4:05 PM',
    extraNotes: 'Same appliance as request SL-000126.',
    problemDesc: 'Water stays in the drum after the cycle ends. Customer confirmed the visit window by phone yesterday evening.',
    photoCount: 2,
    internalNote: 'Customer confirmed by phone. Assign any washing-machine technician for the afternoon slot.',
    createdAt: 'Yesterday, 4:05 PM',
    lastUpdated: 'Today, 9:30 AM',
    source: 'Website request',
    nextStep: 'Assign an available technician to this confirmed visit.',
    nextAction: 'Assign technician',
    suggestedTechnicianIds: ['RK', 'PS'],
    timeline: [
      { title: 'Request received', desc: 'Customer submitted a washing machine repair request', time: 'Yesterday · 4:05 PM', done: true, current: false },
      { title: 'Customer confirmed', desc: 'Admin confirmed the afternoon visit by phone', time: 'Today · 9:30 AM', done: true, current: false },
      { title: 'Technician assignment pending', desc: 'No technician has been assigned yet', time: '', done: false, current: true },
    ] satisfies TimelineEntry[],
  },
  {
    id: 'SL-000123',
    title: 'AC is not cooling',
    status: 'DIAGNOSING',
    customerId: 'SRK',
    technicianId: 'RK',
    urgent: false,
    applianceType: 'Air conditioner', brand: 'Samsung', model: '1.5 ton',
    problem: 'Not cooling',
    preferredVisit: 'Today · 11 AM–1 PM',
    visitTime: '11:30 AM',
    receivedAgo: 'This morning',
    submitted: 'Today · 8:40 AM',
    extraNotes: 'AC unit is in the master bedroom, second floor.',
    problemDesc: 'The AC runs and blows air but the room never gets cool. Cleaning the filter did not help. Customer requested a morning visit only.',
    photoCount: 0,
    internalNote: 'Ramesh KC is on-site. Expected to submit the diagnosis by 3 PM.',
    createdAt: 'Today, 8:40 AM',
    lastUpdated: 'Today, 11:05 AM',
    source: 'Website request',
    nextStep: 'Ramesh KC is on-site diagnosing the unit.',
    nextAction: 'View technician',
    timeline: [
      { title: 'Request received', desc: 'Customer submitted an AC repair request', time: 'Today · 8:40 AM', done: true, current: false },
      { title: 'Customer confirmed', desc: 'Morning slot confirmed with the customer', time: 'Today · 9:15 AM', done: true, current: false },
      { title: 'Technician assigned', desc: 'Ramesh KC assigned — senior AC technician', time: 'Today · 10:20 AM', done: true, current: false },
      { title: 'Technician arrived', desc: 'Ramesh KC arrived at Koteshwor', time: 'Today · 11:05 AM', done: true, current: false },
      { title: 'Diagnosing', desc: 'Technician is inspecting the unit now', time: '', done: false, current: true },
    ] satisfies TimelineEntry[],
  },
  {
    id: 'SL-000122',
    title: 'TV turns off after a few minutes',
    status: 'TECHNICIAN_ON_THE_WAY',
    customerId: 'AG',
    technicianId: 'BT',
    urgent: false,
    applianceType: 'Television', brand: 'Sony', model: 'Bravia 43"',
    problem: 'Auto shut-off',
    preferredVisit: 'Today · 9–11 AM',
    visitTime: '9:00 AM',
    receivedAgo: 'This morning',
    submitted: 'Today · 7:55 AM',
    extraNotes: 'Problem started after a power outage last week.',
    problemDesc: 'The TV switches itself off 5–10 minutes after turning on. Sound stays normal for those minutes.',
    photoCount: 0,
    internalNote: '',
    createdAt: 'Today, 7:55 AM',
    lastUpdated: 'Today, 9:05 AM',
    source: 'Website request',
    nextStep: 'Bikash Thapa is on the way, arriving around 9:30 AM.',
    nextAction: 'View technician',
    timeline: [
      { title: 'Request received', desc: 'Customer submitted a TV repair request', time: 'Today · 7:55 AM', done: true, current: false },
      { title: 'Customer confirmed', desc: 'Morning slot confirmed by phone', time: 'Today · 8:30 AM', done: true, current: false },
      { title: 'Technician assigned', desc: 'Bikash Thapa assigned for the visit', time: 'Today · 8:55 AM', done: true, current: false },
      { title: 'Technician on the way', desc: 'Bikash Thapa confirmed and departed', time: 'Today · 9:05 AM', done: false, current: true },
    ] satisfies TimelineEntry[],
  },
  {
    id: 'SL-000121',
    title: 'AC not cooling — compressor suspected',
    status: 'PRICE_APPROVAL',
    customerId: 'MS',
    technicianId: 'SR',
    urgent: false,
    applianceType: 'Air conditioner', brand: 'Samsung', model: 'AR18',
    problem: 'Not cooling',
    preferredVisit: 'Today · 7–9 AM',
    visitTime: '7:30 AM',
    receivedAgo: '2 hrs ago',
    submitted: 'Today · 6:50 AM',
    extraNotes: 'Same AC as customer’s July gas-refill request.',
    problemDesc: 'Cooling dropped gradually over two weeks. The outdoor unit vibrates more than before.',
    photoCount: 3,
    internalNote: 'Diagnosis submitted with price proposal. Call the customer today to walk through the quote.',
    createdAt: 'Today, 6:50 AM',
    lastUpdated: 'Today, 9:40 AM',
    source: 'Website request',
    nextStep: 'Customer decision pending on the Rs. 4,500 compressor repair.',
    nextAction: 'Follow up with customer',
    diagnosis: { fault: 'Compressor fault', proposal: 'Rs. 4,500', submittedAt: 'Today · 9:40 AM' },
    timeline: [
      { title: 'Request received', desc: 'Customer submitted an AC repair request', time: 'Today · 6:50 AM', done: true, current: false },
      { title: 'Customer confirmed', desc: 'Early-morning slot confirmed', time: 'Today · 7:05 AM', done: true, current: false },
      { title: 'Technician assigned', desc: 'Suman Rai assigned for diagnosis', time: 'Today · 7:30 AM', done: true, current: false },
      { title: 'Diagnosis completed', desc: 'Compressor fault — proposed repair: Rs. 4,500', time: 'Today · 9:40 AM', done: true, current: false },
      { title: 'Waiting for price approval', desc: 'Customer to accept or decline the quote', time: '', done: false, current: true },
    ] satisfies TimelineEntry[],
  },
  {
    id: 'SL-000118',
    title: 'Refrigerator making grinding noise',
    status: 'IN_PROGRESS',
    customerId: 'BR',
    technicianId: 'SR',
    urgent: false,
    applianceType: 'Refrigerator', brand: 'Whirlpool', model: 'WB400',
    problem: 'Grinding noise, warm compartment',
    preferredVisit: 'Today · From 8 AM',
    visitTime: '8:05 AM',
    receivedAgo: 'This morning',
    submitted: 'Today · 7:15 AM',
    extraNotes: 'Second visit — the first scheduled visit had no technician.',
    problemDesc: 'A loud grinding noise from the back panel, cooling dropped the same day. Previous request was closed without a visit.',
    photoCount: 1,
    internalNote: 'Follow-up after a no-show (SL-000110). Complete the repair today; customer trust is on the line.',
    createdAt: 'Today, 7:15 AM',
    lastUpdated: 'Today, 8:05 AM',
    source: 'Phone request',
    nextStep: 'Suman Rai is performing the repair on-site.',
    nextAction: 'View technician',
    timeline: [
      { title: 'Request received', desc: 'Request captured by phone', time: 'Today · 7:15 AM', done: true, current: false },
      { title: 'Customer confirmed', desc: 'First available slot confirmed — 8 AM', time: 'Today · 7:20 AM', done: true, current: false },
      { title: 'Technician assigned', desc: 'Suman Rai assigned (refrigeration specialist)', time: 'Today · 7:35 AM', done: true, current: false },
      { title: 'Repair in progress', desc: 'Suman Rai arrived and started the repair', time: 'Today · 8:05 AM', done: false, current: true },
    ] satisfies TimelineEntry[],
  },
  {
    id: 'SL-000117',
    title: 'Sony TV picture flickers then goes dark',
    status: 'COMPLETED',
    customerId: 'GS',
    technicianId: 'RK',
    urgent: false,
    applianceType: 'Television', brand: 'Sony', model: 'Not provided',
    problem: 'Picture flickers, screen goes dark',
    preferredVisit: 'Today · 2–4 PM',
    visitTime: '2:00 PM',
    receivedAgo: 'Yesterday',
    submitted: 'Yesterday · 2:30 PM',
    extraNotes: 'None.',
    problemDesc: 'The picture flickered for a week, then the screen stayed dark while sound kept playing. Backlight section suspected.',
    photoCount: 2,
    internalNote: 'Backlight driver board replaced. Invoice pending — collect at next follow-up call.',
    createdAt: 'Yesterday, 2:30 PM',
    lastUpdated: 'Today, 3:10 PM',
    source: 'Website request',
    nextStep: 'Repair completed and verified with the customer.',
    nextAction: 'Generate invoice',
    diagnosis: { fault: 'Backlight driver board failure', proposal: 'Rs. 3,200', submittedAt: 'Today · 12:50 PM' },
    timeline: [
      { title: 'Request received', desc: 'Customer submitted a TV repair request', time: 'Yesterday · 2:30 PM', done: true, current: false },
      { title: 'Customer confirmed', desc: 'Afternoon slot confirmed for today', time: 'Yesterday · 3:00 PM', done: true, current: false },
      { title: 'Technician assigned', desc: 'Ramesh KC assigned for the visit', time: 'Today · 9:00 AM', done: true, current: false },
      { title: 'Diagnosis completed', desc: 'Backlight driver board failure — quote Rs. 3,200, approved by phone', time: 'Today · 12:50 PM', done: true, current: false },
      { title: 'Repair completed', desc: 'Board replaced, picture verified with the customer', time: 'Today · 3:10 PM', done: true, current: false },
    ] satisfies TimelineEntry[],
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   The logged-in technician for the /tech demo portal
   ─────────────────────────────────────────────────────────────────────────── */

// Business: The technician app demos as Ramesh KC so field views match admin truth.
// Technical: Replace with the session user id when authentication lands.
export const DEMO_LOGGED_IN_TECH_ID = 'RK';

/* ─────────────────────────────────────────────────────────────────────────────
   Selectors — the only way pages read data
   ─────────────────────────────────────────────────────────────────────────── */

const customerById = new Map(DEMO_CUSTOMERS.map((c) => [c.id, c]));
const techById = new Map(DEMO_TECHNICIANS.map((t) => [t.id, t]));
const requestById = new Map(DEMO_REQUESTS.map((r) => [r.id, r]));

export function getDemoCustomer(id: string): DemoCustomerRecord | undefined {
  return customerById.get(id);
}

export function getDemoTechnician(id: string): DemoTechnicianRecord | undefined {
  return techById.get(id);
}

// Business: Does a detail page exist for this request id? History rows and cross
// Business: links may only be clickable when the answer is yes — no dead ends.
export function requestExists(id: string): boolean {
  return requestById.has(id);
}

// Business: Full case file for the admin detail page: request + joined customer
// identity + derived tracker position. One truth, assembled, never copied.
export function getRequestById(id: string): ServiceRequestDetail | undefined {
  const r = requestById.get(id);
  if (!r) return undefined;
  const customer = customerById.get(r.customerId);
  const { customerId: _customerId, technicianId: _technicianId, urgent: _urgent, visitTime: _visitTime, diagnosis: _diagnosis, suggestedTechnicianIds: _suggested, ...rest } = r;
  return {
    ...rest,
    customerName: customer?.name ?? 'Unknown customer',
    phone: customer?.phone ?? '',
    address: customer?.address ?? customer?.area ?? '',
    currentStep: STEP_FOR_STATUS[r.status],
  };
}

export function getRequestSummary(r: DemoRequestRecord): ServiceRequestSummary {
  const customer = customerById.get(r.customerId);
  const technician = r.technicianId ? techById.get(r.technicianId) : undefined;
  return {
    id: r.id,
    customerName: customer?.name ?? 'Unknown customer',
    area: customer?.area ?? '',
    appliance: `${r.brand} ${r.applianceType}`,
    status: r.status,
    technicianName: technician?.name ?? null,
    updatedAgo: r.lastUpdated.replace(/^Today, /, 'Today ').replace(/^Yesterday, /, 'Yesterday '),
    urgent: r.urgent,
  };
}

export function getDemoRequestRecord(id: string): DemoRequestRecord | undefined {
  return requestById.get(id);
}

export function requestsForCustomer(customerId: string): DemoRequestRecord[] {
  return DEMO_REQUESTS.filter((r) => r.customerId === customerId);
}

export function requestsForTechnician(technicianId: string): DemoRequestRecord[] {
  return DEMO_REQUESTS.filter((r) => r.technicianId === technicianId);
}

const ACTIVE_STATUSES: ServiceStatusKey[] = [
  'ASSIGNED', 'TECHNICIAN_CONFIRMED', 'TECHNICIAN_ON_THE_WAY', 'ARRIVED',
  'DIAGNOSING', 'PRICE_APPROVAL', 'IN_PROGRESS', 'WAITING_FOR_PARTS',
];

// Business: "Done" and "cancelled" end a case; anything else that isn't active is pending.
// Technical: One list each — pages ask these predicates, they never inline status arrays.
const DONE_STATUSES: ServiceStatusKey[] = ['COMPLETED', 'INVOICED', 'PAID', 'CLOSED'];
const CANCELLED_STATUSES: ServiceStatusKey[] = ['CANCELLED', 'UNABLE_TO_COMPLETE'];

export function isRequestActive(status: ServiceStatusKey): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export function isRequestDone(status: ServiceStatusKey): boolean {
  return DONE_STATUSES.includes(status);
}

export function isRequestCancelled(status: ServiceStatusKey): boolean {
  return CANCELLED_STATUSES.includes(status);
}

export function currentJobForTechnician(techId: string): DemoRequestRecord | undefined {
  return requestsForTechnician(techId).find((r) => isRequestActive(r.status));
}

// Business: Technician cards show the live job, never a stale copy of it.
// Technical: Availability and current job derive from the request table on read.
export function getTechnicianSummaries(): TechnicianSummary[] {
  return DEMO_TECHNICIANS.map((t) => {
    const job = currentJobForTechnician(t.id);
    return {
      id: t.id,
      name: t.name,
      phone: t.phone,
      area: t.area,
      availability: t.availability,
      currentJobId: job?.id ?? null,
      currentJobStatus: job?.status ?? null,
      skills: t.skills,
      completedThisWeek: t.completedThisWeek,
      avatarHue: t.avatarHue,
    };
  });
}

// Business: Directory rows end in the canonical language: the customer’s newest
// request status is the row badge — no private outcome vocabulary.
export function getCustomerSummaries(): CustomerSummary[] {
  return DEMO_CUSTOMERS.map((c) => {
    const open = requestsForCustomer(c.id);
    const newest = open[0];
    const lastClosed = c.history[0];
    const status: ServiceStatusKey = newest
      ? newest.status
      : lastClosed
        ? outcomeToStatus(lastClosed.outcome)
        : 'NEW_REQUEST';
    return {
      id: c.id,
      name: c.name,
      phone: maskPhone(c.phone),
      area: c.area,
      applianceCount: c.appliances.length,
      totalRequests: open.length + c.history.length,
      lastOutcomeStatus: status,
      lastDate: newest ? newest.receivedAgo : lastClosed?.date ?? '—',
      avatarHue: c.avatarColor,
    };
  });
}

// Business: A closed case needs a canonical status to render its badge too.
// Technical: Maps the demo outcome words onto the shared status enum.
function outcomeToStatus(outcome: string): ServiceStatusKey {
  switch (outcome) {
    case 'Successful Repair': return 'COMPLETED';
    case 'Customer Cancelled': return 'CANCELLED';
    case 'Repair Declined': return 'CANCELLED';
    case 'No Technician Visit': return 'UNABLE_TO_COMPLETE';
    default: return 'CLOSED';
  }
}

/* Queue selectors for the dashboard and navigation badges. All derived, all one truth. */

export function awaitingAssignmentRequests(): DemoRequestRecord[] {
  return DEMO_REQUESTS.filter((r) => (r.status === 'NEW_REQUEST' || r.status === 'ORDER_CONFIRMED') && !r.technicianId);
}

// Business: "Needs Action" = an admin must do something now: call, assign or follow up.
// Technical: One definition feeds the requests tab pill and the tab filter together.
export function needsActionRequests(): DemoRequestRecord[] {
  return DEMO_REQUESTS.filter((r) => r.status === 'NEW_REQUEST' || r.status === 'ORDER_CONFIRMED' || r.status === 'PRICE_APPROVAL');
}

export function completedRequests(): DemoRequestRecord[] {
  return DEMO_REQUESTS.filter((r) => isRequestDone(r.status));
}

export function newRequestCount(): number {
  return DEMO_REQUESTS.filter((r) => r.status === 'NEW_REQUEST').length;
}

export function liveJobRequests(): DemoRequestRecord[] {
  return DEMO_REQUESTS.filter((r) => isRequestActive(r.status));
}

export function completedTodayRequests(): DemoRequestRecord[] {
  return DEMO_REQUESTS.filter((r) => r.status === 'COMPLETED');
}

export function onlineTechnicians(): DemoTechnicianRecord[] {
  return DEMO_TECHNICIANS.filter((t) => t.availability === 'online');
}

// Business: "Today at a glance" numbers on the dashboard header.
// Technical: Derived from the queue so the four chips can never contradict the tables.
export function todaySummary(): { newRequests: number; confirmed: number; activeVisits: number; completed: number } {
  return {
    newRequests: DEMO_REQUESTS.filter((r) => r.status === 'NEW_REQUEST').length,
    confirmed: DEMO_REQUESTS.filter((r) => r.status === 'ORDER_CONFIRMED').length,
    activeVisits: liveJobRequests().length,
    completed: completedTodayRequests().length,
  };
}

export function statusLabel(status: ServiceStatusKey): string {
  return SERVICE_STATUS_LABEL[status];
}

export function statusBadgeClass(status: ServiceStatusKey): string {
  return getBadgeClass(status);
}

export { SERVICE_STATUS_BADGE };
