# Customer — MVP Feature & Responsibility Spec

> **Scope note:** This file defines what the **customer side actually is** for the Sudhar Lab MVP.
> It is **deliberately simpler than `business.pptx`**. Where the two disagree, **this file wins for the
> customer portal.** The PPT describes a future, bigger, fully self-service system; this describes the
> lean product we are building now.

---

## 1. The idea in one line

The customer portal does exactly **two things**: **submit a service request**, then **watch it move to
"Done"** on a tracking page. There is **no account and nothing else** on the customer side.

---

## 2. What the Customer is responsible for

- Report the broken appliance clearly (one submission).
- Be reachable by phone (admin calls to confirm, and calls again with the price).
- Approve or decline the repair price **over the phone**.
- Pay for the repair **in person / cash, on the visit**.
- Track progress themselves using their **Request Code + phone number** (no login).

## 3. Customer features (the complete list — nothing more)

1. **Submit a service request** (guest — no sign-up).
2. **Receive a Request Code** (e.g. `SL-2026-0042`) after submitting.
3. **Track the request** on a live status page via the **Track box**.
4. That's it. No other customer-facing features exist in the MVP.

---

## 4. Submitting the request (fields we actually collect)

These match what the form already sends (see `frontend/src/features/service-request/form-state.ts`):

| Field | Required? | Notes |
|---|---|---|
| Appliance type | Yes | TV / Washing Machine / AC / Refrigerator |
| Brand | Yes | |
| Model | No | Optional |
| Problem ("what is happening") | Yes | Plain words — customer need not know the fault |
| Name | Yes | |
| Phone | Yes | The single identity anchor for everything |
| Area / location | Yes | |
| Preferred visit date | No | |
| Preferred time window | No | |
| Notes | No | |
| Photo / video | No | Helps admin assign the right technician before the visit |

After a successful submit the customer is shown a **Request Code** and told it has also been sent to
their phone.

---

## 5. The status page (the heart of the customer experience)

The page keeps updating **all the way to "Completed"** (it does *not* stop at "Technician assigned").
The customer sees these stages, in order:

`Waiting for approval → Approved by admin → Technician assigned · On the way → Diagnosing → Fault found (waiting for price approval) → Price approved · Repairing → Completed`

These customer labels map onto the existing internal lifecycle in `frontend/src/lib/service-status.ts`
(so the front-end, back office, and database never use different words):

| # | Customer sees | Internal status key(s) |
|---|---|---|
| 1 | Waiting for approval | `NEW_REQUEST`, `UNDER_REVIEW` |
| 2 | Approved by admin | `ORDER_CONFIRMED` |
| 3 | Technician assigned · On the way | `ASSIGNED`, `TECHNICIAN_ON_THE_WAY`, `ARRIVED` |
| 4 | Diagnosing | `DIAGNOSING` |
| 5 | Fault found (waiting for price approval) | `PRICE_APPROVAL` |
| 6 | Price approved · Repairing | `IN_PROGRESS` (`WAITING_FOR_PARTS` may show here as a note) |
| 7 | Completed | `COMPLETED` → `CLOSED` |

**Key rule — price approval is NOT a button.** There is **no "Approve" action on the customer page.**
Admin calls the customer with the price; the customer says yes or no **on the phone**; the page simply
changes to **"Price approved · Repairing"** when yes. **Every one of these updates is driven by an admin
click — the customer page never changes itself (see `admin.md`).** On the **final Completed page** the
customer also sees the full **service record** ("the soul") and a **"Please rate us"** link to your real
Google business profile.

---

## 6. How a (no-login) customer comes back to the status page

- **Mechanism:** a **"Track your request" box** on the website.
- **Access rule:** the customer must enter **both their phone number AND their Request Code**. Together
  they unlock the status page and that person's request history.
- **Delivery of the code:** sent to the customer via **SMS / WhatsApp** after submitting.

**Why not the phone's IP address (a tempting but wrong shortcut):** an IP is like a shared apartment
building's return address — thousands of mobile users share one at a time, and it changes whenever the
person switches between mobile data and Wi-Fi. It cannot reliably identify a specific returning
customer, and leaning on it risks mis-labelling and leaking one person's data to another. **We use the
phone + code the customer already has instead.**

**Privacy note:** requiring *both* phone **and** code means someone who merely knows another person's
number still cannot view their jobs.

---

## 7. Explicitly OUT of the customer MVP (differences from `business.pptx`)

The PPT lists these customer capabilities. **We are NOT building them now:**

| PPT feature | In this MVP? | Why |
|---|---|---|
| Customer register / login / account | ❌ No | Guest submission only |
| Manage profile | ❌ No | No accounts |
| Register owned appliances | ❌ No | Appliance is captured per-request, not stored as a profile list |
| Book appointment (self-serve) | ❌ No | Appointment is confirmed by admin over the phone |
| Approve estimate on-page | ❌ No | Approval happens by phone |
| Online payment / payment gateway | ❌ No | Paid in cash / on visit, outside our system |
| Invoice as a system feature | ❌ No | Handled offline |
| Give feedback / ratings | 🟡 Redirect only | The Completed page shows a **"Please rate us"** button to your **real Google business profile** — no in-app rating capture, no star counts, no fake numbers |

---

## 8. Edge cases (defined, so behaviour is never guessed later)

- **Customer withdraws before assignment** → request becomes **`CANCELLED`**. (Cancellation is only easy
  *before* admin confirms the order — matching the PPT's own rule and `service-status.ts`.)
- **Customer declines the price on the phone** → the admin marks it **Declined** (status `CANCELLED`). The
  record is **kept, not deleted** (see `admin.md` §5); the page shows a closed/declined message.
  *Open detail:* exact wording shown to the customer for "price not approved".
- **Technician cannot finish (needs parts / fault beyond scope)** → `WAITING_FOR_PARTS` (shows under
  "Repairing") or `UNABLE_TO_COMPLETE`. *Open detail:* how these are worded to the customer.
- **No technician available at that time** → admin reschedules (handled on the admin side; the customer
  simply stays on the relevant stage).

---

## 9. To be decided (do not block the MVP on these)

- Which **SMS / WhatsApp provider** delivers the Request Code.
- Exact **final "Completed" message** shown to the customer.
- Exact **customer-facing wording** for "price not approved" and "unable to complete".
- **How long** tracking records are kept (data retention).

---

## 10. One-line summary for a new developer

> **The customer portal is: submit one request → get a code → track that request (phone + code) through
> 8 fixed stages until "Completed." No login, no on-page approvals, no online payment. Everything else
> in `business.pptx` for the customer is a future phase.**
