// Business: The one place that decides WHERE the data lives for a given run. With Supabase credentials present
// Business: it wires the Supabase stores. With NONE present it refuses to start unless the run explicitly opted
// Business: into demo mode — because silently falling back to seeded data means a misconfigured deploy serves a
// Business: working admin login and plausible customer records, which is worse than being down.
// Technical: Returns just the store slots of AppDependencies; the caller (index.ts) adds the cross-cutting
// pieces (notifier, clock, rate limiter, CORS). Nothing here reads process.env — values arrive from Worker bindings.

import { PostgrestClient } from './supabase';
import { createSupabaseUserProvisioner, type AuthUserProvisioner, type SupabaseAdminConfig } from './supabase-auth';
import type { AppDependencies } from '../app';
import { SessionAuthVerifier } from '../modules/authentication/session';
import { InMemorySessionTokens } from '../modules/authentication/session';
import { SupabaseJwtVerifier } from '../modules/authentication/supabase-jwt-verifier';
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

// Business: The bindings the Worker needs to reach Supabase. SUPABASE_ANON_KEY is the browser-safe publishable
// Business: key (handed to the frontend for sign-in); only the service-role key is secret.
export interface SupabaseEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  CORS_ORIGIN?: string;
  // Business: The ONLY way to get the seeded in-memory build. It must be set deliberately (the `dev` script
  // Business: passes it), never inherited from a deploy config, so a missing database binding can never
  // Business: quietly turn production into a demo with known credentials.
  DEMO_MODE?: string;
}

// Business: Raised when the Worker cannot tell where data lives. Deliberately loud: the process must stop
// Business: serving rather than answer requests from a store the operator did not choose.
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export function demoModeEnabled(env: SupabaseEnv): boolean {
  return env.DEMO_MODE === 'true';
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
  // Business: Fail CLOSED. The old behaviour — "no database configured, so use the demo seeds" — is how a
  // Business: preview deploy or a misspelled binding becomes an open door with a published admin password.
  if (!supabaseConfigured(env)) {
    if (!demoModeEnabled(env)) {
      throw new ConfigurationError(
        'No data store configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (production), or DEMO_MODE=true (local demo).',
      );
    }
    console.warn('[config] DEMO_MODE=true — serving seeded in-memory data. Never enable this on a deployed Worker.');
    return memoryStores();
  }

  // Both bindings are guaranteed here by supabaseConfigured(); read them as definite for the client.
  const client = new PostgrestClient({
    url: env.SUPABASE_URL as string,
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY as string,
  });
  const tokens = new SupabaseSessionStore(client);
  // Sign-in is now Supabase Auth: the browser holds a GoTrue JWT and we verify it locally. The opaque-token
  // session store below is unused on this path (kept only to satisfy the slot); routes read the JWT verifier.
  const auth = new SupabaseJwtVerifier(env.SUPABASE_URL as string);
  return {
    requests: new SupabaseRequestRepository(client),
    customers: new SupabaseCustomerRepository(client),
    technicians: new SupabaseTechnicianRepository(client),
    staff: new SupabaseStaffRepository(client),
    tokens,
    auth,
  };
}

// Business: The service-role config the admin "create technician" path needs to mint a Supabase login. Returns
// null when Supabase isn't configured, so the in-memory build simply can't offer that endpoint.
export function supabaseAdminConfig(env: SupabaseEnv): SupabaseAdminConfig | null {
  // A demo build has no Admin API to call, so "add technician with a login" is simply not offered there.
  if (!supabaseConfigured(env)) return null;
  return { url: env.SUPABASE_URL as string, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY as string };
}

// Business: The login provisioner the admin needs to open a technician's Supabase Auth account. Null offline.
export function buildProvisioner(env: SupabaseEnv): AuthUserProvisioner | null {
  const config = supabaseAdminConfig(env);
  return config ? createSupabaseUserProvisioner(config) : null;
}
