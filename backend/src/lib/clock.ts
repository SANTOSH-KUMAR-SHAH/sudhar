// Business: Sudhar runs on Nepal time. A job's timestamps and its year in the request code must match
// Business: what a customer in Kathmandu sees on their phone clock — never a UTC date that shifts the day.
// Technical: Intl with the Asia/Kathmandu zone and a +05:45 suffix. Isolated so every caller shares one
// clock (and tests can hand the service a fixed one). No external date library needed.

export function nowNepalIso(instant: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kathmandu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);

  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '00';

  return `${read('year')}-${read('month')}-${read('day')}T${read('hour')}:${read('minute')}:${read('second')}+05:45`;
}
