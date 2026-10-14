# Runbook — connecting the backend to Supabase

The backend already runs fully in-memory. Turning on Supabase is additive: you create a project, apply three
SQL migrations, hand the Worker two values (plus two to the frontend for auth), bootstrap one admin login,
and restart. Nothing about the routes, roles, or the state machine changes — the same ports just talk to a
real database now (and data survives restarts).

## 1. Create a project
1. Go to https://supabase.com → New project. Pick a strong DB password and the region nearest Kathmandu.
2. Wait for provisioning, then open **Project Settings → API** and copy:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - The **`anon` public key** — browser-safe, used by the frontend to sign staff in.
   - The **`service_role` secret** (starts `eyJ…`). This one is server-only.

> The `service_role` key bypasses Row Level Security and can read/write every table. It must live only in the
> Worker's secret storage — never in the frontend, never committed, never in a shared chat.

## 2. Apply the schema + seed data
Either with the Supabase CLI (from the repo root, `supabase/` is already configured):
```
supabase link --project-ref abcd1234
supabase db push
```
Or paste the files into the SQL editor and run them **in order**:
1. `supabase/migrations/0001_init.sql` — creates the tables, the request-code sequence/function, and turns
   on Row Level Security (with no public policies, so only the service role can reach the rows).
2. `supabase/migrations/0002_seed.sql` — inserts the same demo customers, technicians, three jobs and the
   `admin` / `bikash` / `ramesh` logins (password `sudhar-dev`) you have been seeing in the UI. These rows are
   the **offline demo**; once live auth is on, staff sign in through Supabase instead (see step 5).
3. `supabase/migrations/0003_auth.sql` — adds the `technicians.auth_user_id` link to a Supabase login, the
   `technician_code_seq` counter and the `next_technician_code()` function the "Add Technician" form uses to
   mint the next id (so the first technician you create live is `T-2003`).

## 3. Give the Worker its two values
**Local development** — copy the template and fill it in:
```
cd backend
copy .dev.vars.example .dev.vars      # (Windows)   cp .dev.vars.example .dev.vars  (mac/linux)
```
Then edit `.dev.vars`: set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (the `SUPABASE_ANON_KEY` line is
optional for the Worker — it verifies JWTs against the project's public JWKS — but fill it so one file holds
all three values).

**Production (Cloudflare)** — a plain var for the URL, a secret for the key:
```
npx wrangler vars add SUPABASE_URL "https://abcd1234.supabase.co"
echo "your-service-role-key" | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

## 4. Give the frontend its two public values
Staff sign in **directly against Supabase Auth** (email + password → JWT), so the browser needs the project
URL and the **anon** key. Copy the template and fill it in:
```
cd frontend
copy .env.example .env      # (Windows)   cp .env.example .env  (mac/linux)
```
Set `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`. The password never touches our Worker; it goes
from the login page straight to Supabase. The `service_role` key must NOT go here. If you leave
`PUBLIC_SUPABASE_URL` blank, the login pages fall back to the Worker's in-memory dev login.

## 5. Bootstrap the first admin login
Supabase Auth owns *who can sign in*, so the two demo staff in `0002_seed.sql` cannot sign in over Supabase
until real auth users exist. Create **one admin** (you can add technicians later from the admin UI). In the
Supabase dashboard go to **Authentication → Users → Add user** (email confirmed), or with the Admin API:
```
curl -X POST "https://abcd1234.supabase.co/auth/v1/admin/users" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sudhar.example","password":"a-strong-password","email_confirm":true,"app_metadata":{"role":"admin","staffId":"A-1"}}'
```
The `app_metadata.role` and `staffId` are what the Worker reads out of the verified JWT to decide who you
are — an admin gets `role: "admin"`, and a technician (created via the Add-Technician form) gets
`role: "technician"` plus their `technicianId`. You do **not** create technicians by hand: the admin UI's
**Add Technician** button makes their login and roster row in one step.

## 6. Restart and check
```
cd backend
npm run dev
```
Watch the wrangler startup log, then in a browser console:
```
curl http://127.0.0.1:8787/health
```
Then sign in at `/admin/login` with the **email + password you bootstrapped in step 5**. A successful login
that SURVIVES a worker restart proves both the data and the session now live in Supabase, not memory. From
the Technicians screen, use **Add Technician** to create a real technician, then sign in as them in an
incognito window — they should see only their own jobs.

## How the switch works (no code change needed)
`backend/src/lib/stores.ts` reads the environment: if **both** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
are present it wires the Supabase repositories; otherwise it falls back to the in-memory demo data. Leaving a
value blank is the safe default, which is why the whole test suite and a fresh `npm run dev` still work before
you have a project.

## Reverting / starting over
- Stop using Supabase: clear `SUPABASE_URL` (or delete `.dev.vars`) and restart — back to in-memory.
- Reset the demo data: in the SQL editor run `truncate public.requests, public.auth_sessions,
  public.staff_accounts, public.customers, public.technicians;` then re-run `0002_seed.sql`.
