// Business: The technician portal's shared brain. The home board, the job list, the profile and the job
// Business: detail all read the SAME derived rows, so a count or a "what happens next" can never differ
// Business: between screens. Everything here is a projection of live jobs — we store nothing and invent nothing.
// Technical: Operates on ApiTechnicianJob (record + its customer). Status vocabulary comes from the shared
// queue predicates (isActive/isDone), so "active"/"done" mean exactly what the admin queue means by them.

import type { ApiTechnicianJob } from '../../lib/api-client';
import { isActive, isDone } from '../requests/queue';

// Business: The one status a technician acts on. A job the admin has just handed over sits at ASSIGNED
// Business: and its only legal next step they can drive is TECHNICIAN_CONFIRMED — i.e. "Accept the job".
export const AWAITING_ACCEPT_STATUS = 'ASSIGNED';

export function isAwaitingAccept(job: ApiTechnicianJob): boolean {
  return job.status === AWAITING_ACCEPT_STATUS;
}

export interface TechJobRow {
  job: ApiTechnicianJob;
  active: boolean;
  done: boolean;
  awaitingAccept: boolean;
}

// Business: Newest activity first — that is how a technician scans "what moved most recently".
// Technical: One sort shared by every surface; the detail page reuses it so ordering never drifts.
export function toRows(jobs: ApiTechnicianJob[]): TechJobRow[] {
  return [...jobs]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((job) => ({ job, active: isActive(job), done: isDone(job), awaitingAccept: isAwaitingAccept(job) }));
}

export interface TechBoard {
  rows: TechJobRow[];
  next: ApiTechnicianJob | null;
  later: TechJobRow[];
  completed: TechJobRow[];
  awaitingAccept: TechJobRow[];
}

// Business: Split the technician's day the way they think about it: the visit to make next, the others
// Business: still open, and what is already finished. The "next" pick prefers the soonest scheduled date,
// Business: then falls back to most-recently-updated — never a fabricated clock time.
// Technical: next/later/completed are derived, so the counts on the profile can be recomputed from the
// same rows and are guaranteed to agree with the board.
export function deriveBoard(jobs: ApiTechnicianJob[]): TechBoard {
  const rows = toRows(jobs);
  const activeRows = rows.filter((row) => row.active);
  const next = activeRows.slice().sort(soonestVisitFirst)[0]?.job ?? null;
  const later = activeRows.filter((row) => row.job.code !== next?.code);
  return {
    rows,
    next,
    later,
    completed: rows.filter((row) => row.done),
    awaitingAccept: rows.filter((row) => row.awaitingAccept),
  };
}

function soonestVisitFirst(a: TechJobRow, b: TechJobRow): number {
  const av = a.job.visitDate ? Date.parse(a.job.visitDate) : Number.POSITIVE_INFINITY;
  const bv = b.job.visitDate ? Date.parse(b.job.visitDate) : Number.POSITIVE_INFINITY;
  return av - bv;
}

// Business: A visit date is a day, not a promise of an hour. We show the real date we were given, or an
// Business: honest "to be scheduled" — never an invented time slot the backend does not store.
export function visitLabel(job: ApiTechnicianJob): string {
  if (!job.visitDate) return 'Visit to be scheduled';
  const parsed = new Date(job.visitDate);
  if (Number.isNaN(parsed.getTime())) return 'Visit to be scheduled';
  return `Visit ${parsed.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`;
}

// Business: Completed-in-the-last-7-days count for the profile — a real, verifiable window, because the
// Business: API stores no lifetime totals and a made-up "all time" number would be a lie.
export function completedThisWeek(jobs: ApiTechnicianJob[]): number {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return jobs.filter((job) => isDone(job) && new Date(job.updatedAt).getTime() >= weekAgo).length;
}
