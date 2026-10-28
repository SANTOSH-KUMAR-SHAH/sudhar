// Business: The single most dangerous misconfiguration is a Worker that cannot find its database, because the
// Business: old fallback quietly served seeded demo data — including a published admin password. These tests
// Business: pin the new rule: an unconfigured deploy REFUSES to start, and demo mode exists only on request.
// Technical: buildStores touches no network at construction, so every branch is provable offline.

import { describe, expect, it } from 'vitest';
import { buildStores, ConfigurationError, demoModeEnabled, supabaseConfigured } from './stores';
import { InMemoryRequestRepository } from '../modules/service-requests/request.repository';
import { SupabaseRequestRepository } from '../modules/service-requests/supabase-request.repository';
import { SupabaseJwtVerifier } from '../modules/authentication/supabase-jwt-verifier';

const SUPABASE = {
  SUPABASE_URL: 'https://test-project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
};

describe('buildStores — fail closed', () => {
  it('refuses to build at all when neither a database nor demo mode is configured', () => {
    expect(() => buildStores({})).toThrow(ConfigurationError);
  });

  it('refuses a half-configured database (url without the service key)', () => {
    expect(() => buildStores({ SUPABASE_URL: SUPABASE.SUPABASE_URL })).toThrow(ConfigurationError);
    expect(() => buildStores({ SUPABASE_SERVICE_ROLE_KEY: SUPABASE.SUPABASE_SERVICE_ROLE_KEY })).toThrow(ConfigurationError);
  });

  it('refuses anything but an exact DEMO_MODE=true — "TRUE" or "1" is not consent', () => {
    for (const value of ['TRUE', '1', 'yes', 'false', '']) {
      expect(() => buildStores({ DEMO_MODE: value })).toThrow(ConfigurationError);
    }
    expect(demoModeEnabled({ DEMO_MODE: 'true' })).toBe(true);
    expect(demoModeEnabled({ DEMO_MODE: 'TRUE' })).toBe(false);
  });

  it('serves the seeded in-memory stores when demo mode is explicitly on', () => {
    const stores = buildStores({ DEMO_MODE: 'true' });
    expect(stores.requests).toBeInstanceOf(InMemoryRequestRepository);
  });

  it('wires the Supabase stores — and the JWT verifier — when both bindings are present', () => {
    expect(supabaseConfigured(SUPABASE)).toBe(true);
    const stores = buildStores(SUPABASE);
    expect(stores.requests).toBeInstanceOf(SupabaseRequestRepository);
    expect(stores.auth).toBeInstanceOf(SupabaseJwtVerifier);
  });

  it('prefers Supabase over demo mode when both are supplied', () => {
    const stores = buildStores({ ...SUPABASE, DEMO_MODE: 'true' });
    expect(stores.requests).toBeInstanceOf(SupabaseRequestRepository);
  });
});
