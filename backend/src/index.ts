import { createApp } from './app';
import { InMemoryRequestRepository } from './modules/service-requests/request.repository';
import { InMemoryCustomerRepository } from './modules/customers/customer.repository';
import { LoggingRequestCodeNotifier } from './modules/notifications/request-code-notifier';
import { seedRequests } from './modules/service-requests/fixtures';

// Hardcoded-first: the live Worker is wired to in-memory stores seeded with demo jobs. When Supabase
// arrives, only these three constructor calls change — every business rule above them stays put.
export default createApp({
  requests: new InMemoryRequestRepository(seedRequests()),
  customers: new InMemoryCustomerRepository(),
  notifier: new LoggingRequestCodeNotifier(),
});
