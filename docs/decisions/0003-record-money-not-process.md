# 0003 — Record money; never process it

**Status:** Accepted · 2026-10-10
**Decides:** how payments and invoices exist in the system
**See also:** `admin.md`, `customer.md`, `backend.md`

## Context
Customers pay at the visit by **QR / eSewa / cash — outside our platform.** The admin screens already
show invoice numbers and amounts. The question: does the system get involved with money at all?

## Decision
> **The system RECORDS money facts but never MOVES money.**

- **No payment gateway. No PDF invoices.** (Processing money = security/compliance/cost we don't need.)
- The service record stores an **invoice number, amount, and a Paid/Pending mark** — written down by
  the admin once the QR/eSewa has actually arrived.
- A **declined** job is **kept and marked Declined** (`CANCELLED`), never deleted.

## Why
Recording a fact is not the same as processing a payment. Keeping the numbers gives us the books and
future reporting, honours the promise that **a service record never disappears**, and avoids the whole
burden of handling money.

## Consequences
- The admin **manually** flips a job to Paid after confirming the QR/eSewa — a person, not a webhook.
- **Open:** whether invoice numbers **auto-increment** (`INV-00001, 00002…`) or are a free-text
  reference. This is the only money field that affects the build.
