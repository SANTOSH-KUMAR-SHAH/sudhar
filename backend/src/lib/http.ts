// Business: Every JSON body this API accepts is small by nature — a form, a status change, a credential.
// Business: Without a hard ceiling an anonymous caller could post megabytes per request, burn the Worker's
// Business: CPU and memory, and (on the intake route) grow a database row at our expense.
// Technical: `content-length` is only a hint an attacker can omit, so the body is read as TEXT and measured
// Technical: by its real UTF-8 byte length before it is parsed. Hono caches the parsed body, so this is safe
// Technical: to call wherever a handler previously used context.req.json().

import type { Context } from 'hono';

// Business: A realistic maximum for our largest legitimate payload (a 4,000-character problem note plus
// Business: the rest of the form) with generous headroom for multi-byte Nepali text.
export const MAX_JSON_BODY_BYTES = 16 * 1024;

export class PayloadTooLargeError extends Error {
  constructor() {
    super('payload too large');
    this.name = 'PayloadTooLargeError';
  }
}

export async function readJsonBody(
  context: Context,
  maxBytes: number = MAX_JSON_BODY_BYTES,
): Promise<unknown> {
  // Technical: Fast path — refuse a declared oversized body before reading a single byte of it.
  const declared = Number(context.req.header('content-length') ?? '');
  if (Number.isFinite(declared) && declared > maxBytes) throw new PayloadTooLargeError();

  const text = await context.req.text();
  // Technical: The authoritative check — the actual bytes, not what the caller claimed.
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new PayloadTooLargeError();
  if (text.trim().length === 0) return null;

  // A parse failure is a SyntaxError; app.onError turns it into a clean 400 instead of a 500.
  return JSON.parse(text) as unknown;
}
