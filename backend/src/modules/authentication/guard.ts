// Business: the one gate every internal handler passes through. No token you can't verify is 401; a
// verified caller with the wrong job is 403. Handlers then act AS the principal — never as whoever the
// body claimed to be.
// Technical: a plain function, not Hono middleware, so it is trivially unit-testable and needs no
// context-variable typing across modules. The verifier is injected, so tests swap it for a fake.

import type { Role } from '../../../../packages/shared/src/roles';
import { AuthorizationError } from '../../domain/errors';
import type { AuthVerifier, Principal } from './principal';

function bearer(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, value] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && value ? value : undefined;
}

export async function authenticate(
  verifier: AuthVerifier,
  header: string | undefined,
  allowedRoles: readonly Role[],
): Promise<Principal> {
  const principal = await verifier.verify(bearer(header));
  if (!principal) throw new AuthorizationError('unauthenticated', 'A valid sign-in is required');
  if (!allowedRoles.includes(principal.role)) {
    throw new AuthorizationError('forbidden', `Role '${principal.role}' may not access this`);
  }
  return principal;
}
