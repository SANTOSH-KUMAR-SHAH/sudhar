// Business: Phone numbers, dates and request IDs must look the same on every page.
// Technical: Pure helpers with no DOM access so they are unit-testable.

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '••';
  return `98XX XXX ${digits.slice(-3)}`;
}

export function requestRef(): string {
  // Business: Confirmation number the customer can quote on the phone call.
  // Technical: Offline/demo placeholder only — the real code is issued by the API as SL-<year>-<six random
  // Technical: digits> and replaces this value in the success panel once the submit succeeds.
  const n = 100000 + Math.floor(Math.random() * 899999);
  return `SL-${n}`;
}

export function todayLabel(timeZone = 'Asia/Kathmandu'): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone,
    }).format(new Date());
  } catch {
    return new Date().toDateString();
  }
}

// Business: The Nepal-phone rule is single-sourced in packages/shared (the API uses it too).
// Technical: Re-export so existing imports from this file keep working unchanged.
export { isValidNepalPhone } from '../../../packages/shared/src/validation';
