// Business: The one place that decides WHERE the data lives for a given run. With Supabase credentials present
// Business: it wires the Supabase stores; without them it wires today's in-memory seeds. Same ports either way,
// Business: so `wrangler dev` and the whole test suite keep working with no project, yet production is permanent.
// Technical: Returns just the store slots of AppDependencies; the caller (index.ts) adds the cross-cutting
// pieces (notifier, clock, rate limiter, CORS). Nothing here reads process.env — values arrive from Worker bindings.

import { PostgrestClient } from './supabase';
import type { AppDependencies } from '../app';
import { SessionAuthVerifier } from '../modules/authentication/session';
import { InMemorySessionTokens } from '../modules/authentication/session';
import { InMemoryStaffRepository, seedStaff } from '../modules/authentication/staff';
import { SupabaseStaffRepository } from '../modules/authentication/supabase-staff.repository';
import { SupabaseSessionStore } from '../modules/authentication/supabase-session-store';
import { InMemoryRequestRepository } from '../modules/service-requests/request.repository';
import { SupabaseRequestRepository } from '../modules/service-requests/supabase-request.repository';
import { seedRequests } from '../modules/service-requests/fixtures';
import { InMemoryCustomerRepository } from '../modules/customers/customer.repository';
import { SupabaseCustomerRepository } from '../modules/customers/supabase-customer.repository';
import { seedCustomers } from '../modules/customers/fixtures';
import { InMemoryTechnicianRepository } from '../modules/technicians/technician.repository';
import { SupabaseTechnicianRepository } from '../modules/technicians/supabase-technician.repository';
import { seedTechnicians } from '../modules/technicians/fixtures';

// Business: The three bindings the Worker needs to reach Supabase, plus the optional browser allow-list.
export interface SupabaseEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  CORS_ORIGIN?: string;
}

// The store slots of the app — exactly the pieces that differ between memory and Supabase.
export type StoreSlots = Pick<
  AppDependencies,
  'requests' | 'customers' | 'technicians' | 'staff' | 'tokens' | 'auth'
>;

export function supabaseConfigured(env: SupabaseEnv): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function memoryStores(): StoreSlots {
  const tokens = new InMemorySessionTokens();
  return {
    requests: new InMemoryRequestRepository(seedRequests()),
    customers: new InMemoryCustomerRepository(seedCustomers()),
    technicians: new InMemoryTechnicianRepository(seedTechnicians()),
    staff: new InMemoryStaffRepository(seedStaff()),
    tokens,
    auth: new SessionAuthVerifier(tokens),
  };
}

export function buildStores(env: SupabaseEnv): StoreSlots {
  if (!supabaseConfigured(env)) return memoryStores();

  // Both bindings are guaranteed here by supabaseConfigured(); read them as definite for the client.
  const client = new PostgrestClient({
    url: env.SUPABASE_URL as string,
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY as string,
  });
  const tokens = new SupabaseSessionStore(client);
  return {
    requests: new SupabaseRequestRepository(client),
    customers: new SupabaseCustomerRepository(client),
    technicians: new SupabaseTechnicianRepository(client),
    staff: new SupabaseStaffRepository(client),
    tokens,
    auth: new SessionAuthVerifier(tokens),
  };
}
