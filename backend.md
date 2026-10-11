# Backend — The Complete Build List (A to Z)

> **What this file is:** every piece of "kitchen" work needed to turn the mock admin/tech pages and the
> customer form into a real system. It is written in **plain language with Sudhar Lab examples**, then each
> item is marked **who should build it — Supabase or our own code** (see §7).
>
> **The rule everything obeys (from the restaurant analogy):** the **frontend is the table — it may only
> LOOK.** The **backend is the kitchen — it does the DECIDING.** The **database (Supabase) is the order
> book + the locks + the photo shelf.** A customer page never changes itself; an admin click changes it.
>
> **Source-of-truth files this is built from:** `customer.md`, `admin.md`, `technician.md`, the status
> machine in `frontend/src/lib/service-status.ts`, the real record shape in `frontend/src/lib/demo-data.ts`
> + `frontend/src/lib/types.ts`, and the current contract stub `frontend/src/lib/api-client.ts`.

---

## 1. The one object that matters most

There is really **one important thing: the Service Request** (the "soul" / one service record). Customers,
technicians, the timeline, the fault, the price, the invoice — **all hang off that single record.** The three
portals are just different **windows onto the same record**:

- **Customer** sees a read-only slice (the status stages + the final record).
- **Technician** sees their slice (jobs assigned to them + a contact + accept).
- **Admin** is the only one who **reshapes** it, click by click.

So "building the backend" mostly means: **store one honest record per job, let each window read the right
parts, and let exactly one window (admin) change it — through validated steps.**

---

## 2. The DATA — the shelves we must build (database tables)

Each table below already exists *in spirit* inside `demo-data.ts`; the backend just makes it real and
permanent. "New" = not represented in the demo yet.

1. **`requests`** — the service record. One row per job. Fields (from demo/types):
   `code` (e.g. `SL-2026-0123`), `status` (one of the 17 keys), `source` (`Website` / `Phone`),
   `customer_id`, `technician_id` (nullable), `urgent` (bool), `appliance_type`, `brand`, `model`,
   `problem` (short), `problem_desc` (long), `preferred_visit`, `visit_time`, `extra_notes`,
   `internal_note`, `created_at`, `updated_at`. *(Example: SL-000126 "Washing machine not draining", LG, Hari Thapa.)*
2. **`request_attachments`** — the photo/video files + which request they belong to. Supabase Storage holds
   the bytes; this table holds the link + name/size/type. *(Example: 2 photos of the leaking machine.)*
3. **`customers`** — name, phone, area, address, preferred-contact, `since`. Created **automatically** when a
   request arrives, **matched by phone** so a repeat customer merges instead of duplicating. *(No login —
   this is admin's view of "who we've served", not a customer account.)*
4. **`technicians`** — name, phone, `skills[]`, `service_areas[]`, `availability` (**online/offline**),
   joined date, notes. **Workload** is *not stored* — it's derived live from how many active jobs point at
   them (exactly how the demo does it).
5. **`status_history`** (the timeline / audit trail) — one row per change: `request_id`, `from_status`,
   `to_status`, `actor` (`admin` / `technician` / `system`), `actor_id`, `note`, `at`. This is what powers
   the customer's tracker, the admin timeline, and the accountability line "Ramesh confirmed on the way ·
   9:05 AM". **New** (demo fakes it inline).
6. **`invoices`** (record only) — `request_id`, `invoice_number` (e.g. `INV-00123`), `amount`, `currency`
   (NPR), `method` (label: **Esewa / QR / Cash**), `payment_status` (**Paid / Pending**), `recorded_by`, `at`.
   **The money itself arrives outside the system** (QR/Esewa); we only **write down** that it happened. *(Decision from this session.)*
7. **`users` + roles** — the **staff logins** (admin & technician). Owned by **Supabase Auth**; each user has
   a `role` and, for technicians, a link to their `technicians` row. *(Decision: admin creates these.)*
8. **`notification_log`** *(optional, small)* — the **one** auto message (the Request-Code SMS/WhatsApp): who,
   when, delivered/failed. Only exists because we send that single automated text.

---

## 3. The ACTIONS — the decisions the kitchen must make (write endpoints)

Every line here is a **real button someone presses**, and each one is a place where the backend must
**validate + refuse illegal moves.** These are the true "business rules" and the main reason we need our own
code, not just a database.

| # | Trigger (who / where) | What the backend decides | Status effect |
|---|---|---|---|
| A | **Customer submits** the form (`POST /api/requests`) | Validate fields; create-or-merge customer by phone; create request `NEW_REQUEST`; generate unique human-friendly code; store attachments; **send the ONE auto SMS/WhatsApp with the code**. Wrapped so a failure doesn't leave half a record. | → `NEW_REQUEST` |
| B | **Track lookup** (`GET /api/track?phone&code`) | Match on **both** phone and code; return only that request's status + history. Never leak anything else. | *(read, not a decision)* |
| C | **Admin reviews** | Open/lock the request for work. | `NEW_REQUEST → UNDER_REVIEW` (optional) |
| D | **Admin Accept** (after the call) | Confirm the order. | `→ ORDER_CONFIRMED` |
| E | **Admin Assign** a technician | Attach a technician; write history. | `→ ASSIGNED` (→ `TECHNICIAN_ON_THE_WAY` when admin marks it) |
| F | **Technician marks online/offline** | Update **availability only** — this does NOT touch any customer's status. | *(availability, not `requests.status`)* |
| G | **Technician Accepts job** | Record that the assigned tech confirmed. | `→ TECHNICIAN_CONFIRMED` |
| H | **Admin records the fault** (after tech's phone call) | Store fault text; move to quote-waiting. | `DIAGNOSING → PRICE_APPROVAL` |
| I | **Admin Price = Yes** | Customer approved on call. | `→ IN_PROGRESS` ("Repairing") |
| J | **Admin Price = No** (declined) | Keep the record, mark **Declined**. Needs only a light confirm (nothing destroyed). | `→ CANCELLED` (labelled Declined) |
| K | **Admin marks Repair & payment done** | Move to done; **record invoice number + amount + mark Paid/Pending**. | `→ COMPLETED → (INVOICED/PAID) → CLOSED` |
| L | **Admin adds a Phone-in request** | Same as A, but **no SMS** (admin reads the code aloud). `source = Phone`. | → `NEW_REQUEST` |
| M | **Admin creates a staff login** | Provision a technician/admin account + role. | *(auth, not a job status)* |

**The heart of the whole backend** is enforcing that these moves follow the **state machine** in
`service-status.ts` — e.g. you cannot jump `NEW_REQUEST → COMPLETED`, cancellation is **locked after
`ORDER_CONFIRMED`**, and a technician's availability change can **never** rewrite a customer's status.
No off-the-shelf tool expresses *these* rules; **this is exactly why our own code exists.**

---

## 4. The READS — the windows each portal looks through (GET endpoints)

These map **1-to-1 onto the selector functions already written in `demo-data.ts`.** When the API is done,
`demo-data.ts` is **deleted** and pages call these instead — no page rewrites, that's the whole design.

- `GET /api/requests` (+ filters: `needsAction`, `awaitingAssignment`, `completed`, counts) → admin queue & dashboard chips (`todaySummary`, `newRequestCount`, `needsActionRequests`).
- `GET /api/requests/{code}` → admin request detail (`getRequestById`).
- `GET /api/track?phone&code` → customer status page (status + history) — the only public read.
- `GET /api/customers` + `/api/customers/{id}` → admin directory (`getCustomerSummaries`).
- `GET /api/technicians` → admin roster with live availability/workload (`getTechnicianSummaries`, `onlineTechnicians`).
- `GET /api/technicians/{id}/jobs` → technician "My jobs" (`requestsForTechnician`, `currentJobForTechnician`).

---

## 5. The BORING-BUT-MANDATORY plumbing (do not skip)

1. **Validation on every write** (Zod): required fields, phone format, status is a real enum member. Bad data never enters the record.
2. **Authentication** (who is calling) and **Authorization** (role): an admin action is rejected from a technician token; a technician can only read **their own** jobs; the public can only read the one track lookup.
3. **Rate limiting / anti-spam** on the two **public** doors (submit + track) — otherwise bots flood requests and guess codes. *(Example: stop someone hitting "submit" 500×.)*
4. **Secrets & environment** — DB URL, SMS provider key, JWT secret live in **wrangler vars/secrets**, **never** in the frontend bundle.
5. **CORS** — allow only the Astro site's origin to call the API.
6. **Timezone = Nepal (`Asia/Kathmandu`, UTC+5:45)** — visit windows like "Today · 3–5 PM" must be stored/shown in NPT or every slot looks wrong.
7. **Request-code generation** — unique, sequential-ish (`SL-2026-0123`), not guessable in bulk.
8. **Consistent error shape** so the frontend stops throwing `BackendNotConfigured` gracefully once `PUBLIC_API_BASE_URL` is set (see `api-client.ts`).
9. **File handling** — size/type caps on photo/video; store bytes in Supabase Storage, keep only links in the DB.
10. **Migrations + seed** — the empty `supabase/migrations/` gets the schema; the empty `packages/shared/src/` gets the shared status enum + Zod contracts so front and back can't drift. *(types.ts already says it mirrors `packages/shared/src/api-contracts.ts`.)*
11. **Tests** in the empty `tests/api` and `tests/security` folders — most importantly a test that **illegal status jumps are refused.**
12. **Logging / basic observability** so a failed SMS or a weird submit is debuggable later.

---

## 6. NOT built in this backend MVP (deliberately out)

Customer **logins/accounts**, an **online payment gateway** (money is QR/Esewa, recorded only), **spare-parts
inventory**, **warranty**, **auto "who fits" technician suggestion** (we track availability but a human picks —
your call this session), **status-change auto notifications** (only the code SMS is automated), and **reports
/analytics** (the kept data allows them later). All of these live in `business.pptx` as the *future* system.

---

## 7. WHO BUILDS WHAT — Supabase vs our own code (the recommended split)

**Principle:** Supabase does the **generic hard plumbing** and anything that is just **LOOK**. Our Hono
backend does the **DECIDE** and anything that is **specific to how Sudhar Lab runs its day.**

| Concern | **Supabase** (buy) | **Our code / Hono** (build) | Why it sits there |
|---|---|---|---|
| Database + tables + migrations | ✅ | seeds it | Postgres is Supabase's job |
| Staff login / auth / roles | ✅ Auth | reads the role | Supabase Auth issues JWTs; we just check "is this an admin?" |
| Each tech sees only their jobs; public can't read all | ✅ **RLS** (row-level security) | — | This is a *look* boundary, RLS nails it |
| Photo/video storage | ✅ Storage | passes links | Buying a file server is silly |
| Live status updates on the tracker | ✅ Realtime (optional) | — | Free feature we'd otherwise hand-roll |
| **The status state machine** (allowed transitions, cancel-lock) | — | ✅ **core** | Pure business rule; no generic tool knows it |
| **Submit orchestration** (make request + merge customer + gen code + send SMS + files, atomically) | — | ✅ | Several steps that must all succeed together |
| **Every admin decision** (Accept/Assign/Fault/Price/Decline/Complete + write history) | — | ✅ | These are the "kitchen decisions" |
| Recording invoice number + amount + paid | stores the row | ✅ the rules around it | Supabase holds data; our code decides when/how it's set |
| The **one** SMS/WhatsApp code message | — | ✅ (provider integration) | A decision + external call; not a database thing |
| Track lookup combining phone **and** code safely | RLS helps | ✅ the endpoint | Must not leak across people |
| Validation contract (Zod) shared front/back | — | ✅ in `packages/shared` | One rulebook, both sides |
| Rate limiting / anti-spam on public doors | — | ✅ middleware | App-level concern |

**Plain-words summary of the split:** *Supabase = the building (power, locks, filing cabinets, the photo
shelf). Our code = the one staff member who actually decides things* — the workflow, the "you can't skip
this step" rules, and the single SMS. We use Supabase for everything that would be painful to build and
re-buy, and we write code **only** for the decisions that make this Sudhar Lab and not a generic CRUD app.

> One nuance: Supabase auto-generates read APIs (the "Auto-API"). We **won't expose those as the public
> contract.** All reads still go through our thin Hono API so the shape stays stable and auth/limits apply.
> Supabase stays behind the curtain as the engine.

---

## 8. Sensible build order (first-principles sequence)

1. **`packages/shared`** — move the status enum + build the Zod request/track contracts (the rulebook both sides agree on). *Contract first.*
2. **Supabase schema + migrations** (§2) + **Auth** + **RLS** + **Storage**.
3. **Read endpoints** (§4) → wire admin/tech pages to real data, **delete `demo-data.ts`.**
4. **Submit + code + the one SMS** (§3 A) → makes the customer form real.
5. **Track lookup** (§3 B) → completes the customer loop.
6. **The state machine + admin actions** (§3 C–K, the heart).
7. **Technician availability + accept** (§3 F, G).
8. **Invoice/payment recording** (§3 K) + phone-in create (§3 L) + staff-login create (§3 M).
9. **Plumbing hardening**: rate limits, CORS, secrets, timezone, logging.
10. **Tests** (`tests/api`, `tests/security`) — especially "illegal status jump is refused."

---

## 9. One-line summary for a new developer

> **One permanent record per job (the service request) with customers, technicians, timeline, fault, price and
> invoice attached. Each portal is just a window onto it — and only the admin can reshape it, one validated
> step at a time. Supabase gives us the database, logins, file storage and security boundaries; our Hono code
> owns the workflow rules (the state machine), the submit/invoice orchestration, and the single code-SMS. The
> money arrives outside (QR/Esewa) and we only record that it happened.**
