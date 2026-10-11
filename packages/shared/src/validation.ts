// Business: A Nepali mobile number is the single identity anchor for a request, so the
// Business: same acceptance rule must guard both the form (usability) and the API (security).
// Technical: Dependency-free helpers. The API wraps these in Zod; the frontend calls them
// directly. Keep this file free of any app/DB/framework import.

// Business: Accept 98XXXXXXXX, with optional +977 and spaces/dashes.
// Technical: Normalise to digits, then match the local mobile shape.
export function isValidNepalPhone(input: string): boolean {
  const digits = input.replace(/[\s-]/g, '');
  return /^(98\d{8}|\+97798\d{8})$/.test(digits);
}

// Business: The code a customer is texted and must re-enter to track a job (e.g. SL-2026-0123).
// Technical: Loose format guard only — the API is the thing that issues real, unique codes.
export function isValidRequestCode(input: string): boolean {
  return /^SL-\d{4}-\d{4,6}$/.test(input.trim().toUpperCase());
}
