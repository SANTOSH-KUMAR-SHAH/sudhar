// Business: A small, honest team so the roster and workload numbers mean something before any DB exists.
// Business: T-2002 is the AC tech holding the live PRICE_APPROVAL job; T-2001 only has a closed job —
// Business: so the derived workload (1 vs 0) is checkable, not asserted from a hand-typed count.
// Technical: Plain records (no aggregate). Ids line up with the request fixtures' technicianId values.

import type { TechnicianRecord } from './technician.repository';

export function seedTechnicians(): TechnicianRecord[] {
  return [
    { id: 'T-2001', name: 'Bikash Thapa', phone: '9847220115', area: 'Baneshwor', availability: 'online', skills: ['Television', 'Washing machine', 'Refrigerator'] },
    { id: 'T-2002', name: 'Ramesh KC', phone: '9802778451', area: 'Lalitpur', availability: 'online', skills: ['Air conditioner', 'Television', 'Washing machine'] },
  ];
}
