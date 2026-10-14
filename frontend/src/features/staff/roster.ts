// Business: The technician roster answers "who can I send right now" from LIVE data only. A card's
// Business: current job, weekly completions and workload are JOINED from the admin request queue — never
// Business: retyped. If the backend does not know something (a job, a skill), the card simply omits it.
// Technical: Pure + deterministic so it is unit-testable and re-renders identically. Operates on the real
// ApiTechnician (no currentJob field server-side) + the joined ApiRequest rows we already fetch.
import type { ApiRequest, ApiTechnician } from '../../lib/api-client';
import { isActive, isDone } from '../requests/queue';

export interface TechnicianCard {
  id: string;
  name: string;
  initials: string;
  avatarHue: string;
  phone: string;
  area: string;
  availability: 'online' | 'offline';
  skills: string[];
  activeJobs: number;
  // Business: The single job this technician is on right now, if any — newest live request assigned to them.
  currentJobId: string | null;
  currentJobStatus: string | null;
  completedThisWeek: number;
}

// Business: A calm, on-brand rotation for avatars — the demo hand-picked hues, we derive a stable one
// Technical: Same id always maps to the same colour, so a technician or customer never changes shade between views.
const HUES = ['#10263D', '#0C7C82', '#8B5CF6', '#3B82F6', '#D97706', '#4A4E52'];

export function avatarHueFor(id: string): string {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return HUES[sum % HUES.length]!;
}

function hueFor(id: string): string {
  return avatarHueFor(id);
}

// Business: Staff scan a roster by face-initials, not by database id — derive the two letters from the name.
// Technical: First letters of the first two name parts, upper-cased; a single-word name yields one letter.
export function initialsFor(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Business: One honest card per technician — their live assignment and this week's completions, joined
// Business: from the same request rows the dashboard and queue read, so the numbers can never disagree.
// Technical: "Newest" is by updatedAt; a technician with no open request shows available/offline, not a job.
export function deriveRoster(technicians: ApiTechnician[], requests: ApiRequest[]): TechnicianCard[] {
  const now = Date.now();
  return technicians.map((tech) => {
    const theirs = requests.filter((r) => r.technicianId === tech.id);

    const live = theirs
      .filter(isActive)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const current = live[0] ?? null;

    const completedThisWeek = theirs.filter(
      (r) => isDone(r) && now - new Date(r.updatedAt).getTime() <= WEEK_MS,
    ).length;

    return {
      id: tech.id,
      name: tech.name,
      initials: initialsFor(tech.name),
      avatarHue: hueFor(tech.id),
      phone: tech.phone,
      area: tech.area,
      availability: tech.availability,
      skills: tech.skills,
      activeJobs: tech.activeJobs,
      currentJobId: current?.code ?? null,
      currentJobStatus: current?.status ?? null,
      completedThisWeek,
    };
  });
}
