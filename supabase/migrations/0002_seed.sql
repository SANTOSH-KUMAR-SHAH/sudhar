-- Business: Seeds the SAME three demo jobs, three customers and four technicians the in-memory store showed,
-- Business: so the moment you switch on Supabase the admin/technician/customer screens look exactly as already
-- Business: proven — no empty portal, no re-typing. Idempotent: safe to run once on a fresh project.
-- Business: Staff secrets are stored as `sha256$salt$hex` computed by Postgres's SHA-256, matching the app's
-- Business: verifier byte-for-byte, so `admin` / `bikash` / `ramesh` with password `sudhar-dev` sign in for real.
-- Technical: ON CONFLICT DO NOTHING lets this rerun without error. JSONB timelines/appliances are written as
-- native JSON. The code sequence is parked at 3 so the next submitted job becomes SL-<year>-0004.

-- Customers (ids are the phone-derived C-… the app would compute; seeded to match the demo jobs).
insert into public.customers (id, name, phone, area) values
  ('C-1001', 'Hari Thapa',    '9841445220', 'Baneshwor'),
  ('C-1002', 'Mina Shrestha', '9802118452', 'Lalitpur'),
  ('C-1003', 'Gita Sharma',   '9841902385', 'Bagbazar')
on conflict (id) do nothing;

-- Roster (workload is never stored — only availability; both are online so either can take a job).
insert into public.technicians (id, name, phone, area, availability, skills) values
  ('T-2001', 'Bikash Thapa',    '9847220115', 'Baneshwor',   'online',  array['Television','Washing machine','Refrigerator']),
  ('T-2002', 'Ramesh KC',       '9802778451', 'Lalitpur',    'online',  array['Air conditioner','Television','Washing machine'])
on conflict (id) do nothing;

-- Job 1 — a fresh website intake, still unassigned.
insert into public.requests (code, status, source, customer_id, technician_id, appliance, problem, fault, price, visit_date, urgent, created_at, updated_at, timeline) values
  ('SL-2026-0001', 'NEW_REQUEST', 'Website', 'C-1001', null,
   '{"type":"Washing machine","brand":"LG","model":"FHM1207"}'::jsonb,
   'Not draining after spin cycle', null, null, '2026-10-09', null,
   '2026-10-08T14:30:00+05:45', '2026-10-08T14:30:00+05:45',
   '[{"status":"NEW_REQUEST","actor":"customer","at":"2026-10-08T14:30:00+05:45"}]'::jsonb)
on conflict (code) do nothing;

-- Job 2 — the live one awaiting the customer's price decision (assigned to Ramesh, T-2002).
insert into public.requests (code, status, source, customer_id, technician_id, appliance, problem, fault, price, visit_date, urgent, created_at, updated_at, timeline) values
  ('SL-2026-0002', 'PRICE_APPROVAL', 'Website', 'C-1002', 'T-2002',
   '{"type":"Air conditioner","brand":"Samsung","model":"AR18"}'::jsonb,
   'Not cooling', 'Compressor fault',
   '{"amount":4500,"currency":"NPR","paymentStatus":"Pending"}'::jsonb,
   null, null,
   '2026-10-05T10:00:00+05:45', '2026-10-08T14:00:00+05:45',
   '[
     {"status":"NEW_REQUEST","actor":"customer","at":"2026-10-05T10:00:00+05:45"},
     {"status":"UNDER_REVIEW","actor":"admin","at":"2026-10-05T10:10:00+05:45"},
     {"status":"ORDER_CONFIRMED","actor":"admin","at":"2026-10-05T10:20:00+05:45","note":"morning slot confirmed by phone"},
     {"status":"ASSIGNED","actor":"admin","at":"2026-10-05T10:30:00+05:45","note":"Ramesh KC assigned"},
     {"status":"TECHNICIAN_CONFIRMED","actor":"technician","at":"2026-10-05T10:40:00+05:45"},
     {"status":"TECHNICIAN_ON_THE_WAY","actor":"admin","at":"2026-10-06T09:00:00+05:45"},
     {"status":"ARRIVED","actor":"admin","at":"2026-10-06T09:20:00+05:45"},
     {"status":"DIAGNOSING","actor":"admin","at":"2026-10-06T09:30:00+05:45"},
     {"status":"PRICE_APPROVAL","actor":"admin","at":"2026-10-08T14:00:00+05:45","note":"Rs. 4,500 quote, awaiting customer decision"}
   ]'::jsonb)
on conflict (code) do nothing;

-- Job 3 — the fully closed history job (assigned to Bikash, T-2001).
insert into public.requests (code, status, source, customer_id, technician_id, appliance, problem, fault, price, visit_date, urgent, created_at, updated_at, timeline) values
  ('SL-2026-0003', 'CLOSED', 'Phone', 'C-1003', 'T-2001',
   '{"type":"Television","brand":"Sony"}'::jsonb,
   'Picture flickers then goes dark', 'Backlight driver board failure',
   '{"amount":3200,"currency":"NPR","invoiceNumber":"INV-00003","paymentStatus":"Paid"}'::jsonb,
   null, null,
   '2026-10-01T11:00:00+05:45', '2026-10-08T15:00:00+05:45',
   '[
     {"status":"NEW_REQUEST","actor":"admin","at":"2026-10-01T11:00:00+05:45"},
     {"status":"UNDER_REVIEW","actor":"admin","at":"2026-10-01T11:10:00+05:45"},
     {"status":"ORDER_CONFIRMED","actor":"admin","at":"2026-10-01T11:20:00+05:45"},
     {"status":"ASSIGNED","actor":"admin","at":"2026-10-01T11:30:00+05:45"},
     {"status":"TECHNICIAN_CONFIRMED","actor":"technician","at":"2026-10-01T11:40:00+05:45"},
     {"status":"TECHNICIAN_ON_THE_WAY","actor":"admin","at":"2026-10-02T09:00:00+05:45"},
     {"status":"ARRIVED","actor":"admin","at":"2026-10-02T09:20:00+05:45"},
     {"status":"DIAGNOSING","actor":"admin","at":"2026-10-02T09:30:00+05:45"},
     {"status":"PRICE_APPROVAL","actor":"admin","at":"2026-10-02T10:00:00+05:45"},
     {"status":"IN_PROGRESS","actor":"admin","at":"2026-10-02T10:10:00+05:45","note":"customer approved over phone"},
     {"status":"COMPLETED","actor":"admin","at":"2026-10-07T10:00:00+05:45"},
     {"status":"INVOICED","actor":"admin","at":"2026-10-07T10:20:00+05:45"},
     {"status":"PAID","actor":"admin","at":"2026-10-07T10:40:00+05:45","note":"eSewa received"},
     {"status":"CLOSED","actor":"admin","at":"2026-10-08T15:00:00+05:45"}
   ]'::jsonb)
on conflict (code) do nothing;

-- Staff logins, hashed with Postgres SHA-256 in the exact `sha256$salt$hex` shape the app verifies.
-- All three demo passwords are `sudhar-dev` (the same dev secret the in-memory seed used).
insert into public.staff_accounts (id, role, identifier, secret) values
  ('A-1',     'admin',      'admin',  'sha256$a1s0$' || encode(extensions.digest('a1s0:sudhar-dev',  'sha256'), 'hex')),
  ('T-2001',  'technician', 'bikash', 'sha256$b1k5$' || encode(extensions.digest('b1k5:sudhar-dev',  'sha256'), 'hex')),
  ('T-2002',  'technician', 'ramesh', 'sha256$r3m7$' || encode(extensions.digest('r3m7:sudhar-dev',  'sha256'), 'hex'))
on conflict (id) do nothing;

-- Park the code counter after the three seeded jobs so the next submission is SL-<year>-0004.
select setval('public.request_code_seq', 3, true);
