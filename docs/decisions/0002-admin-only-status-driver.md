# 0002 — The Admin is the only status-driver

**Status:** Accepted · 2026-10-10
**Decides:** who is allowed to change what the customer sees
**See also:** `admin.md`, `technician.md`, `customer.md`

## Context
Three roles touch a job (customer, technician, admin). The technician works **by phone** on site, so
there is a real risk that two people update the same job from two places and the customer's tracking
page **contradicts itself** (e.g. tech taps "done", admin is still mid-call).

## Decision
> **Only the admin's clicks change the customer-facing status.**

- The **technician** may do exactly two things: **Accept** a job, and toggle their own
  **online/offline availability**. Neither touches the customer's status.
- The **customer page never updates itself** — every stage change is a recorded admin action.
- The admin **picks technicians by hand** (they know their people); the system shows availability but
  does **not** auto-suggest who fits.

## Why
A **single decision point** makes it *impossible* for the tracker to show two truths at once, and it
matches the phone-first reality of the business.

## Consequences
- The technician app is deliberately thin — their real tool is the phone, not the screen.
- Every status change must be an **explicit admin action** that also writes a history entry.
- If we later let technicians self-report "arrived / done" to save calls, that's a change to *this*
  decision — reopen it consciously, don't just add a button.
