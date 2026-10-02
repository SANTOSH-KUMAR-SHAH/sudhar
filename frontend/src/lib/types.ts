// Business: Every service case, technician and customer record has one typed shape
// Business: so admin/tech pages stop using `any` and mismatched field names.
// Technical: Frontend-only mirrors of the future API contracts in
// packages/shared/src/api-contracts.ts. Keep field names stable when backend lands.

import type { ServiceStatusKey } from './service-status';

export interface ServiceRequestSummary {
  id: string;
  customerName: string;
  area: string;
  appliance: string;
  status: ServiceStatusKey;
  technicianName: string | null;
  updatedAgo: string;
  urgent?: boolean;
}

export interface TimelineEntry {
  title: string;
  desc: string;
  time: string;
  done: boolean;
  current: boolean;
}

export interface ServiceRequestDetail {
  id: string;
  title: string;
  status: ServiceStatusKey;
  customerName: string;
  phone: string;
  address: string;
  preferredVisit: string;
  receivedAgo: string;
  applianceType: string;
  brand: string;
  model: string;
  problem: string;
  submitted: string;
  extraNotes: string;
  problemDesc: string;
  photoCount: number;
  currentStep: number;
  internalNote: string;
  createdAt: string;
  lastUpdated: string;
  source: string;
  nextStep: string;
  nextAction: string;
  timeline: TimelineEntry[];
}

export type Availability = 'online' | 'offline';

export interface TechnicianSummary {
  id: string;
  name: string;
  phone: string;
  area: string;
  availability: Availability;
  currentJobId: string | null;
  currentJobStatus: ServiceStatusKey | null;
  skills: string[];
  completedThisWeek: number;
  avatarHue: string;
}

export interface TechScheduleItem {
  time: string;
  task: string;
  loc: string;
  reqId: string;
  status: string;
  state: 'done' | 'current' | 'upcoming' | 'empty';
}

export interface CustomerSummary {
  id: string;
  name: string;
  phone: string;
  area: string;
  applianceCount: number;
  totalRequests: number;
  lastOutcomeLabel: string;
  lastOutcomeTone: 'active' | 'progress' | 'done' | 'cancel' | 'neutral' | 'warning' | 'success' | 'danger';
  lastDate: string;
  avatarHue: string;
}

export interface DiagnosisDraft {
  observations: string;
  diagnosedFault: string;
  requiredParts: string;
  notes: string;
}
