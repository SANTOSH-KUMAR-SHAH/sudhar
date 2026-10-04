# Technician — MVP Feature & Responsibility Spec

> **Scope note:** This file defines the **technician side** of the Sudhar Lab MVP. Like `customer.md`
> and `admin.md`, it is **deliberately simpler than `business.pptx`** — where they disagree, **these
> files win.**
>
> **The one rule that shapes everything here:** the **admin is the only actor that changes the
> customer's status page** (see `admin.md` §1). So the technician side is intentionally **thin** — the
> technician mainly *sees* their work and *accepts* it; the phone, not the screen, carries the rest.

---

## 1. The idea in one line

The technician portal does exactly **two things**: **see the jobs assigned to you**, and **accept one**.
Everything after that happens in the physical world and is reported to the admin **by phone.**

---

## 2. What the Technician is responsible for

- **Accept** a job the admin has offered and assigned.
- **Travel to the customer's home** and inspect the appliance.
- **Diagnose the real fault** on site.
- **Call the admin** with the fault (the admin then types it and quotes the price).
- **Do the repair** once the customer approves the price.
- **Take payment in person / cash** (off-system).

## 3. Technician features (the complete list — nothing more)

1. **Log in** (their own staff login; no customer-style public page).
2. **My jobs** — the list of requests assigned to *this* technician (their slice of the one service record).
3. **Job detail** — everything needed to do the visit (see section 5).
4. **Accept job** — the single action that confirms they'll take it.
5. **Call customer** and **Call admin** — tap-to-dial links on the job detail.
6. **My profile** — the technician's own record (name, trade/skills, contact).

That's the whole app for the technician. There is **no** diagnosis typing, **no** price entry, **no**
status buttons — those live with the admin by design.

---

## 4. What the Technician does NOT do (this MVP)

| Tempting power (from `business.pptx`) | In this MVP? | Who does it instead |
|---|---|---|
| Update service status (On the way / Diagnosing / In progress / Completed) | ❌ No | **Admin** clicks drive the customer page |
| Enter the diagnosis / fault text | ❌ No | **Admin** types it from the tech's phone call |
| Raise / edit the price or invoice | ❌ No | **Admin** quotes the price |
| Record payment | ❌ No | Cash, off-system |
| Manage spare parts / warranty | ❌ No | Not built yet |

**Honest flag:** the PPT's "Accept Job, Diagnose, **Update Status**, **Complete Service**" is trimmed
here to **Accept Job** only. That is a deliberate choice to keep a **single decision point** (the admin)
so the customer's page can never get two contradictory updates. If you later want the technician to
self-report arrival/completion, that's a `technician.md` upgrade — noted in §7.

---

## 5. What the Technician sees on a job (read-only view)

The technician reads the **same service record** the admin and customer share — never a second copy:

- **Request code** (e.g. `SL-2026-0042`) and current **status**
- **Customer**: name, phone (tap-to-call), area / location
- **Appliance**: type, brand, model
- **Problem** as the customer reported it, plus **notes**
- **Photos / video** the customer attached (helps them bring the right tools)
- **Preferred visit date / time window**
- Their own **assignment status** (Assigned → accepted on the way)

---

## 6. The technician's place in the lifecycle

Using the single status list in `frontend/src/lib/service-status.ts`, the technician touches essentially
**one** state; everything else is admin-driven but *visible* to them:

| Stage (what's happening) | Internal status | Driven by |
|---|---|---|
| Admin assigns you | `ASSIGNED` | Admin |
| **You tap Accept** | `TECHNICIAN_CONFIRMED` | **Technician** (the one action) |
| On the way / Arrived / Diagnosing | `TECHNICIAN_ON_THE_WAY`, `ARRIVED`, `DIAGNOSING` | Admin (you phone them) |
| Fault reported → price → approved | `PRICE_APPROVAL` → `IN_PROGRESS` | Admin |
| Repair done (you finish on site) | `COMPLETED` | Admin (you tell them it's done + paid) |

---

## 7. To be decided (not blocking the MVP)

- **Decline an offered job?** Right now the admin *calls first* and only assigns who agrees, so there is
  no on-screen decline. Confirm we truly don't need a "Decline" button.
- Should **Accept** alone push the customer page to "Technician assigned · On the way", or does the admin
  still do that flip (current model: **admin** flips it, `TECHNICIAN_CONFIRMED` is just the signal back)?
- **Re-assignment**: if a technician accepts then can't come, how they flag it (a simple "can't take" →
  back to admin) — not built yet.
- **Technician self-reporting** arrival/completion (the §4 upgrade) — a possible future phase to save phone
  calls, kept out of the MVP on purpose.
- **Login** mechanics (Supabase staff auth, backend phase).

---

## 8. One-line summary for a new developer

> **The technician portal is deliberately thin: log in, see only your assigned jobs (their slice of the
> one service record), and Accept them. Every real status change — and the fault/price typing — is done by
> the admin, because the admin is the single driver of the customer's page. The technician's tools are the
> phone and the visit, not the screen.**
