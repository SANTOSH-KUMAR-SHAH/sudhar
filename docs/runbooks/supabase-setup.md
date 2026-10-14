# Runbook — connecting the backend to Supabase

The backend already runs fully in-memory. Turning on Supabase is additive: you create a project, apply two
SQL migrations, hand the Worker two values, and restart. Nothing about the routes, roles, or the state
machine changes — the same ports just talk to a real database now (and data survives restarts).

## 1. Create a project
1. Go to https://supabase.com → New project. Pick a strong DB password and the region nearest Kathmandu.
2. Wait for provisioning, then open **Project Settings → API** and copy:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - The **`service_role` secret** (starts `eyJ…`). This one is server-only.

> The `service_role` key bypasses Row Level Security and can read/write every table. It must live only in the
> Worker's secret storage — never in the frontend, never committed, never in a shared chat.

## 2. Apply the schema + seed data
Either with the Supabase CLI (from the repo root, `supabase/` is already configured):
```
supabase link --project-ref abcd1234
supabase db push
```
Or paste the two files into the SQL editor and run them **in order**:
1. `supabase/migrations/0001_init.sql` — creates the tables, the request-code sequence/function, and turns
   on Row Level Security (with no public policies, so only the service role can reach the rows).
2. `supabase/migrations/0002_seed.sql` — inserts the same demo customers, technicians, three jobs and the
   `admin` / `bikash` / `ramesh` logins (password `sudhar-dev`) you have been seeing in the UI.

## 3. Give the Worker its two values
**Local development** — copy the template and fill it in:
```
cd backend
copy .dev.vars.example .dev.vars      # (Windows)   cp .dev.vars.example .dev.vars  (mac/linux)
```
Then edit `.dev.vars`: set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

**Production (Cloudflare)** — a plain var for the URL, a secret for the key:
```
npx wrangler vars add SUPABASE_URL "https://abcd1234.supabase.co"
echo "your-service-role-key" | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

## 4. Restart and check
```
cd backend
npm run dev
```
Watch the wrangler startup log, then in a browser console:
```
curl http://127.0.0.1:8787/health
```
Then sign in at `/admin/login` with `admin` / `sudhar-dev` — a successful login that SURVIVES a worker
restart proves the data is now living in Supabase, not memory.

## How the switch works (no code change needed)
`backend/src/lib/stores.ts` reads the environment: if **both** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
are present it wires the Supabase repositories; otherwise it falls back to the in-memory demo data. Leaving a
value blank is the safe default, which is why the whole test suite and a fresh `npm run dev` still work before
you have a project.

## Reverting / starting over
- Stop using Supabase: clear `SUPABASE_URL` (or delete `.dev.vars`) and restart — back to in-memory.
- Reset the demo data: in the SQL editor run `truncate public.requests, public.auth_sessions,
  public.staff_accounts, public.customers, public.technicians;` then re-run `0002_seed.sql`.
