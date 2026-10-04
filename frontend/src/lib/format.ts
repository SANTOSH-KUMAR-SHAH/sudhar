// Business: Phone numbers, dates and request IDs must look the same on every page.
// Technical: Pure helpers with no DOM access so they are unit-testable.

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '••';
  return `98XX XXX ${digits.slice(-3)}`;
}

export function requestRef(): string {
  // Business: Confirmation number the customer can quote on the phone call.
  // Technical: Temporary client-side ref; backend will issue SL-000000 sequence.
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

export function isValidNepalPhone(input: string): boolean {
  const digits = input.replace(/[\s-]/g, '');
  return /^(98\d{8}|\+97798\d{8})$/.test(digits);
}
