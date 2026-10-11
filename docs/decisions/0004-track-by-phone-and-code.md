# 0004 — Track by phone + code (no login, no IP)

**Status:** Accepted · 2026-10-10
**Decides:** how a customer follows their job without an account
**See also:** `customer.md`, `backend.md`

## Context
We want customers to check their status **without creating accounts**. A tempting shortcut was to
identify a returning visitor by their device's **IP address.**

## Decision
> **No customer accounts. Track = phone number + a Request Code, entered together.**

- On submit, the system generates a human-friendly code (e.g. `SL-2026-0123`) and sends it **once** by
  **SMS/WhatsApp** — the **only** automated message in the whole system.
- The site's **Track box** requires **both the phone AND the code** to reveal that job's status + history.

## Why
- **No accounts** = far less to build, secure, and maintain, and fits one-off repairs.
- **IP fails:** thousands of mobile users share one IP at a time and it changes when they switch
  Wi-Fi/cellular. It can't reliably identify a person, and leaning on it risks **leaking one customer's
  data to another.** Phone + code uses something the customer already has, and requiring *both* means
  knowing someone's number alone isn't enough to peek at their jobs.

## Consequences
- Losing the code means a quick admin lookup by phone (small friction, acceptable for rare one-off jobs).
- The phone+code lookup endpoint is **public**, so it must be **rate-limited** against code-guessing
  (see `backend.md` §5).
