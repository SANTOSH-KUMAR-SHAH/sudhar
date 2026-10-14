-- Business: Supabase Auth owns WHO can sign in; our public schema keeps a handle back to each technician and a
-- Business: counter for issuing the next friendly technician id (T-2003, T-2004, …) the same way jobs get codes.
-- Technical: Adds a nullable auth_user_id link on technicians (set when the admin form creates their login), plus
-- a sequence + volatile function next_technician_code() that hands out exactly one number per call, atomically.

-- Link a roster row to its Supabase Auth user (the login we mint on the admin "add technician" path).
alter table if exists public.technicians
  add column if not exists auth_user_id uuid;

comment on column public.technicians.auth_user_id is
  'Supabase auth.users.id for this technician; null for pre-login demo rows';

-- The next human technician number. Seed-style ids are T-2001/T-2002, so the counter starts at 2002 (next = 2003).
create sequence if not exists public.technician_code_seq;
select setval('public.technician_code_seq', 2002, true);

create or replace function public.next_technician_code()
returns bigint
language sql
volatile
as $$
  select nextval('public.technician_code_seq');
$$;

comment on function public.next_technician_code() is
  'Issues the next technician id number; volatile so it is never folded away or cached';
