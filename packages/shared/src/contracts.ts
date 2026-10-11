// Business: The shapes that cross the frontend/backend boundary — what a customer submits,
// Business: what the Track box asks for, and what a service record reads back.
// Technical: Plain interfaces only (no Zod, no framework) so this file has zero dependencies.
// The backend wraps these in Zod for runtime validation; the frontend imports them as types.

import type { ServiceStatusKey } from './service-status';

// A file the customer attaches. The bytes go to storage; only metadata travels in the body.
export interface AttachmentInput {
  name: string;
  size: number;
  type: string;
}

// Everything the customer's request form collects (see customer.md §4).
export interface CreateServiceRequestInput {
  appliance: string;
  brand: string;
  model?: string;
  problem: string;
  name: string;
  phone: string;
  area: string;
  visitDate?: string;
  visitWindow?: string;
  notes?: string;
  attachments?: AttachmentInput[];
}

// The Track box requires BOTH together (see decision 0004).
export interface TrackQueryInput {
  phone: string;
  code: string;
}

// A single point on the accountability timeline (who moved it forward, when).
export interface TimelineEvent {
  status: ServiceStatusKey;
  actor: 'customer' | 'admin' | 'technician' | 'system';
  at: string;
  note?: string;
}

// The record the customer's status page reads back (see admin.md §7 / backend.md §2).
export interface ServiceRecordDto {
  code: string;
  status: ServiceStatusKey;
  source: 'Website' | 'Phone';
  customer: { name: string; phone: string; area: string };
  appliance: { type: string; brand: string; model?: string };
  problem: string;
  fault?: string;
  price?: { amount: number; currency: 'NPR'; invoiceNumber?: string; paymentStatus: 'Paid' | 'Pending' };
  technician?: { name: string; phone: string } | null;
  visitDate?: string;
  timeline: TimelineEvent[];
}
