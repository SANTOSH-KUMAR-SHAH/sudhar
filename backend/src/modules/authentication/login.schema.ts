// Business: what you send to sign in. Deliberately nothing else — no role, no id in the body, so a
// caller cannot steer their own permissions. The account record decides role, never the request.
import { z } from 'zod';
import { ROLES } from '../../../../packages/shared/src/roles';

export const loginSchema = z.object({
  identifier: z.string().min(1),
  secret: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Business: what a successful sign-in hands back — a token and the caller's role, never the secret.
export const loginResultSchema = z.object({
  token: z.string().min(1),
  role: z.enum(ROLES),
});
