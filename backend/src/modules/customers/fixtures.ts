// Business: demo customers behind the two seeded jobs, so the admin directory and joined views
// show real people. Ids align with the request fixtures (C-1001, C-1002, C-1003).
import type { CustomerRecord } from './customer.repository';

export function seedCustomers(): CustomerRecord[] {
  return [
    { id: 'C-1001', name: 'Hari Thapa', phone: '9841445220', area: 'Baneshwor' },
    { id: 'C-1002', name: 'Mina Shrestha', phone: '9802118452', area: 'Lalitpur' },
    { id: 'C-1003', name: 'Gita Sharma', phone: '9841902385', area: 'Bagbazar' },
  ];
}
