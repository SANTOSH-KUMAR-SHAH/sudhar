# Admin — MVP Feature & Responsibility Spec

> **Scope note:** This file defines the **admin side** of the Sudhar Lab MVP. Like `customer.md`, it is
> **deliberately simpler than `business.pptx`** — where they disagree, **these two files win.**
> The admin is the **control room**: it is where decisions are made and where the customer's status page
> is driven. All state names below map to the single source of truth in
> `frontend/src/lib/service-status.ts` — never invent new words for a status.

---

## 1. The governing principle (the most important rule)

> **The Admin is the ONLY actor that changes what the customer sees.**
> The technician only reports by phone and accepts a job; every customer-facing status update is produced
> by an **admin click** (made *after* the relevant phone call). This keeps one decision point — the "kitchen"
> we discussed — and makes the customer page impossible to contradict.

The admin's job is therefore: **see the request → decide → click → the customer page moves by itself.**

---

## 2. What the Admin is responsible for

- Review each incoming request.
- Check the **technician page** to see who is free and who handles that appliance.
- **Call the customer** to confirm details, then accept the request.
- **Call a technician** to offer the job; assign them once the technician agrees.
- **Call the customer with the price** after the fault is found, and record yes/no.
- Mark the repair + cash payment complete.
- Be the single owner of the **service record** (the "soul") as it fills in step by step.

---

## 3. Admin features (the complete list)

**Views**
1. **Request queue** — all requests, with the filters/tabs the admin pages already have.
2. **Technician roster** — who is available and what they service (checked *before* accepting).
3. **Request detail = the live service record** — one screen where the case is worked from new to done.

**Actions (the only things that push the customer page forward)**
4. **Accept** the request (after the confirmation call).
5. **Assign** a technician (after the technician agrees on the phone).
6. **Fault found** (after the technician calls with the diagnosis).
7. **Price → Yes** (customer approved on the call) or **Price → No** (customer declined).
8. **Repair & payment done** (repair finished, cash received).

---

## 4. The workflow — each admin click and what the customer sees

| # | Admin action (when / why) | Internal status set | Customer page now shows |
|---|---|---|---|
| 0 | Customer submits (automatic) | `NEW_REQUEST` | **Waiting for approval** |
| 1 | Admin opens / reviews the request | `UNDER_REVIEW` | Waiting for approval |
| 2 | Admin calls customer, confirms, clicks **Accept** | `ORDER_CONFIRMED` | **Approved** |
| 3 | Admin calls a technician; once they agree, clicks **Assign** | `ASSIGNED` → `TECHNICIAN_ON_THE_WAY` | **Technician assigned · On the way** |
| 4 | Technician reaches the home and diagnoses (reports by phone) | `DIAGNOSING` | **Diagnosing** |
| 5 | Admin clicks **Fault found** and types the fault | `PRICE_APPROVAL` | **Fault found — waiting for price approval** |
| 6a | Admin calls with price; customer says **yes** → clicks **Yes** | `IN_PROGRESS` | **Price approved · Repairing** |
| 6b | Customer says **no** → clicks **No** | `CANCELLED` (labelled **Declined**) | Ends; record is **kept**, marked *Declined* |
| 7 | Repair finished, cash paid → clicks **Repair & payment done** | `COMPLETED` → `CLOSED` | **Repair complete · Thank you · Please rate us** + the **full service record** |

*Optional in-between:* if parts are needed, the case can sit at `WAITING_FOR_PARTS` and display as a note
under **Repairing**. Cancellation by the customer is only simple **before** Accept (step 2) — matching
`service-status.ts`.

---

## 5. Decline handling — keep, don't delete (decision recorded)

When the customer declines the price, the admin clicks **No** and the record is set to **Declined
(`CANCELLED`)** — it is **not deleted.**

**Why:** a declined request is a tiny text row; it costs almost nothing and will not fill a free tier.
Keeping it preserves your ability to see how many people baulked at prices, follow up, and honour the
core promise that **a service record never disappears.** Because nothing is destroyed, the "No" button
needs only a light, non-destructive confirm ("Mark this as declined?"), not a scary delete warning.

---

## 6. Fault & price entry

The **admin types both the fault found and the agreed price** (based on the technician's phone call and
the customer call). These are what populate the customer's final record. (The technician does not enter
text in this MVP — see `technician.md`, to be written.)

---

## 7. The service record ("the soul") — full contents shown on completion

When step 7 finishes, the customer's page displays the complete record. It contains:

- **Request code** (e.g. `SL-2026-0042`)
- **Customer**: name, phone, area
- **Appliance**: type, brand, model
- **Problem** as reported by the customer
- **Fault found** (admin-entered diagnosis)
- **Price agreed** and **payment method = Cash / on visit**
- **Assigned technician** name
- **Visit date**
- **Timeline** of the steps with their timestamps (who moved it forward, when) — the accountability trail

On the **same completed page** the customer also gets: a **Thank-you** and a **"Please rate us"** button
that opens your **real Google business profile**. This is a link to genuine reviews only — **no in-app
rating capture, no star counts, no fake social proof** (respecting the standing rule).

---

## 8. Explicitly OUT of the admin MVP (differences from `business.pptx`)

The PPT gives the admin more powers. **Not built now:**

| PPT admin power | In this MVP? |
|---|---|
| Manage spare parts inventory | ❌ No |
| Manage warranty | ❌ No |
| Generate reports / analytics | ❌ No (kept data allows this later) |
| Manage payments / gateway | ❌ No — cash, off-system |
| Manage a full customer directory with accounts | ❌ No — no customer accounts exist |

What the admin **does** have is exactly the list in section 3 — a focused control room, not a full ERP.

---

## 9. To be decided (not blocking the MVP)

- Does the admin **first** mark `UNDER_REVIEW` as a distinct step, or jump straight to Accept? (Currently shown as optional.)
- Whether "Technician assigned" and "On the way" stay **combined** on the customer page (as you described) or split later.
- Light rules for **re-assigning** a technician if the first one cancels after accepting.
- Admin **login** details — how many admin users and roles (Supabase auth, backend phase).

---

## 10. One-line summary for a new developer

> **The admin is the single control room that turns phone calls into state changes: Accept → Assign →
> Fault found → Price Yes/No → Repair & payment done. Every admin click drives the customer's status page
> and fills one permanent service record; declines are kept, never deleted.**
