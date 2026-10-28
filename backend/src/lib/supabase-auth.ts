// Business: Everything the Worker needs from Supabase's Auth service (GoTrue) that ISN'T the data API:
// Business: fetching the public signing keys used to check access tokens, and (service-role only) creating a
// Business: login for a colleague the admin just added. These are the two Auth calls our app makes; nothing else.
// Technical: Plain fetch, no SDK — same philosophy as lib/supabase.ts. The Admin endpoint needs the service_role
// key and is therefore only ever called from the Worker, never the browser. JWKS fetches are cached per URL so a
// busy portal doesn't hit Supabase on every request.

export interface SupabaseAdminConfig {
  url: string;
  serviceKey: string;
}

export interface JsonWebKeyRecord {
  kid?: string;
  kty: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
}

export interface NewAuthUserInput {
  email: string;
  password: string;
  // Carried inside the signed token, so the Worker trusts it without a second read.
  appMetadata: Record<string, unknown>;
}

const JSON_HEADERS = { 'content-type': 'application/json', accept: 'application/json' };

// Technical: 65,534 is the sentinel Supabase returns when the Admin API is disabled on the project.
const ADMIN_DISABLED_STATUS = 65534;

export class SupabaseAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'SupabaseAuthError';
  }
}

// Business: Pull the project's public RSA signing keys. Safe to expose — a JWKS carries no secrets.
export async function fetchJwks(
  url: string,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<JsonWebKeyRecord[]> {
  const endpoint = new URL('/auth/v1/.well-known/jwks.json', url);
  const response = await fetchImpl(endpoint.toString(), { headers: { accept: 'application/json' } });
  if (!response.ok) throw new SupabaseAuthError(`jwks fetch failed: ${response.status}`, response.status);
  const body = (await response.json()) as { keys?: JsonWebKeyRecord[] };
  return body.keys ?? [];
}

// Business: Create one authenticated user, confirming their email up front so they can sign in immediately.
// Business: If the email is already registered we surface a conflict, never a silent overwrite.
export async function createAuthUser(
  config: SupabaseAdminConfig,
  input: NewAuthUserInput,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<string> {
  const endpoint = new URL('/auth/v1/admin/users', config.url);
  const response = await fetchImpl(endpoint.toString(), {
    method: 'POST',
    headers: { ...JSON_HEADERS, apikey: config.serviceKey, authorization: `Bearer ${config.serviceKey}` },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      email_confirm: true,
      app_metadata: input.appMetadata,
    }),
  });
  if (response.status === ADMIN_DISABLED_STATUS) {
    throw new SupabaseAuthError(
      'Supabase Admin API is disabled for this project — enable it in Auth settings to create staff logins',
      ADMIN_DISABLED_STATUS,
    );
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    if (response.status === 422 && /already/i.test(detail)) {
      throw new SupabaseAuthError('that email is already registered', 409);
    }
    throw new SupabaseAuthError(`auth create failed: ${response.status} ${detail}`, response.status);
  }
  const body = (await response.json()) as { id?: string; user?: { id?: string } };
  const userId = body.id ?? body.user?.id;
  if (!userId) throw new SupabaseAuthError('auth create returned no user id', 502);
  return userId;
}

// Business: Undo a user we just made when the matching profile row couldn't be saved — no orphaned logins.
// Business: This call MUST be able to fail LOUDLY: a silent failure leaves a working Supabase login whose owner
// Business: has no roster row, i.e. an account nobody can see in the admin screen and nobody will remember.
export async function deleteUser(
  config: SupabaseAdminConfig,
  userId: string,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<void> {
  // Technical: GoTrue's Admin API addresses a single user by PATH (`/admin/users/{id}`). The previous form
  // Technical: (`?user_id=`) is silently accepted as a listing call, so the delete never happened — and the
  // Technical: response was never inspected, so no one found out. Both mistakes are fixed here.
  const endpoint = new URL(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, config.url);
  const response = await fetchImpl(endpoint.toString(), {
    method: 'DELETE',
    headers: { ...JSON_HEADERS, apikey: config.serviceKey, authorization: `Bearer ${config.serviceKey}` },
  });
  // Business: 404 means the user is already gone — that is exactly the outcome we wanted.
  if (response.ok || response.status === 404) return;
  const detail = await response.text().catch(() => '');
  throw new SupabaseAuthError(`auth delete failed: ${response.status} ${detail}`, response.status);
}

// Business/Technical: The port the technician-admin service depends on — "make a login, or undo one". Wrapping
// the raw calls in an injectable object lets tests hand in a fake provisioner instead of a live Supabase.
export interface AuthUserProvisioner {
  createUser(input: NewAuthUserInput): Promise<string>;
  deleteUser(userId: string): Promise<void>;
}

export function createSupabaseUserProvisioner(
  config: SupabaseAdminConfig,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): AuthUserProvisioner {
  return {
    createUser: (input) => createAuthUser(config, input, fetchImpl),
    deleteUser: (userId) => deleteUser(config, userId, fetchImpl),
  };
}
