# 0001 — Hybrid architecture: Supabase + our own backend

**Status:** Accepted · 2026-10-10
**Decides:** how the whole system is built (everything else sits on this)
**See also:** `backend.md`, `admin.md`, `technician.md`, `customer.md`

## Context
Sudhar Lab needs a real backend for one central thing: the **service record** (a job that moves
step by step from "request" to "done"). We had two tempting extremes — let Supabase do *everything*,
or write *everything* ourselves. The founder will hand this to a future developer, so the reason for
the choice must survive.

## Decision
Use a **hybrid**:

- **Supabase = the building.** It provides the database, staff **logins**, photo/video **storage**,
  per-person security (**RLS**), and optional live updates. It handles anything that is just *LOOK*.
- **Our Hono backend (Cloudflare Workers) = the staff member who decides.** It owns the workflow:
  the **status state machine**, the submit/invoice orchestration, and the single code-SMS.

**All reads and writes go through our API.** We do **not** expose Supabase's auto-generated API as the
public contract — it stays the engine behind the curtain.

## Why not the extremes
- **All-Supabase:** its auto-API and security rules cannot express "you can't skip a step" or "cancel
  is locked after confirmation." Those business rules would end up smeared across database policies.
- **All-custom:** we'd rebuild login, file storage, and security that Supabase gives us cheaply.

## Consequences
- Two tools to understand (Supabase + our code) instead of one.
- `packages/shared` becomes the **one rulebook** both sides agree on — do not let the two drift.
- The later decisions (admin-only status, record-not-process money, phone+code tracking) all assume this split.
