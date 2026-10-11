// Business: Small, honest sample jobs so the API is testable before any database exists.
// Business: Built through the aggregate itself, so a wrong step order would throw here —
// Business: the fixtures are a living proof the happy path really is legal.
// Technical: Temporary stand-in for seeded Supabase rows (Milestone 7). Three jobs cover a
// fresh intake, one awaiting the customer's price decision, and one fully closed.

import { ServiceRequest } from '../../domain/service-request';

const BASE = Date.parse('2026-10-08T09:00:00.000Z');
const at = (minutes: number): string => new Date(BASE + minutes * 60_000).toISOString();

export function seedRequests(): ServiceRequest[] {
  const intake = ServiceRequest.open({
    code: 'SL-2026-0001',
    source: 'Website',
    customerId: 'C-1001',
    appliance: { type: 'Washing machine', brand: 'LG', model: 'FHM1207' },
    problem: 'Not draining after spin cycle',
    visitDate: '2026-10-09',
    at: at(0),
  });

  const awaitingPrice = ServiceRequest.open({
    code: 'SL-2026-0002',
    source: 'Website',
    customerId: 'C-1002',
    appliance: { type: 'Air conditioner', brand: 'Samsung', model: 'AR18' },
    problem: 'Not cooling',
    at: at(-300),
  })
    .moveTo('UNDER_REVIEW', 'admin', at(-290))
    .moveTo('ORDER_CONFIRMED', 'admin', at(-280), { note: 'morning slot confirmed by phone' })
    .moveTo('ASSIGNED', 'admin', at(-270), { technicianId: 'T-2002', note: 'Ramesh KC assigned' })
    .moveTo('TECHNICIAN_CONFIRMED', 'technician', at(-260))
    .moveTo('TECHNICIAN_ON_THE_WAY', 'admin', at(-200))
    .moveTo('ARRIVED', 'admin', at(-120))
    .moveTo('DIAGNOSING', 'admin', at(-110))
    .moveTo('PRICE_APPROVAL', 'admin', at(-60), {
      fault: 'Compressor fault',
      price: { amount: 4500, currency: 'NPR', paymentStatus: 'Pending' },
      note: 'Rs. 4,500 quote, awaiting customer decision',
    });

  const closed = ServiceRequest.open({
    code: 'SL-2026-0003',
    source: 'Phone',
    customerId: 'C-1003',
    appliance: { type: 'Television', brand: 'Sony' },
    problem: 'Picture flickers then goes dark',
    at: at(-1500),
  })
    .moveTo('UNDER_REVIEW', 'admin', at(-1490))
    .moveTo('ORDER_CONFIRMED', 'admin', at(-1480))
    .moveTo('ASSIGNED', 'admin', at(-1470), { technicianId: 'T-2001' })
    .moveTo('TECHNICIAN_CONFIRMED', 'technician', at(-1460))
    .moveTo('TECHNICIAN_ON_THE_WAY', 'admin', at(-1400))
    .moveTo('ARRIVED', 'admin', at(-1300))
    .moveTo('DIAGNOSING', 'admin', at(-1290))
    .moveTo('PRICE_APPROVAL', 'admin', at(-1200), {
      fault: 'Backlight driver board failure',
      price: { amount: 3200, currency: 'NPR', paymentStatus: 'Pending' },
    })
    .moveTo('IN_PROGRESS', 'admin', at(-1100), { note: 'customer approved over phone' })
    .moveTo('COMPLETED', 'admin', at(-60))
    .moveTo('INVOICED', 'admin', at(-40), {
      price: { amount: 3200, currency: 'NPR', invoiceNumber: 'INV-00003', paymentStatus: 'Pending' },
    })
    .moveTo('PAID', 'admin', at(-20), {
      price: { amount: 3200, currency: 'NPR', invoiceNumber: 'INV-00003', paymentStatus: 'Paid' },
      note: 'eSewa received',
    })
    .moveTo('CLOSED', 'admin', at(0));

  return [intake, awaitingPrice, closed];
}
