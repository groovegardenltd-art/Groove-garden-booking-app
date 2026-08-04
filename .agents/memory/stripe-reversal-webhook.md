---
name: Stripe reversals and refund emails
description: Why bookings stayed confirmed after Stripe reversed a payment, and what config must exist in Stripe dashboard
---

Stripe can reverse a payment on its own (risk/bank-initiated) and sends its OWN refund email to the customer — no app code is involved. The app only learns about it via the `charge.refunded` webhook event.

**Why:** Aug 2026 incident — customer's payment reversed minutes after booking; booking #855 stayed confirmed in prod while customer got a Stripe refund email, blocking the slot with no payment behind it.

**How to apply:** The webhook handler must process `charge.refunded` (full reversal → auto-cancel booking; partial refund → record only). The Stripe dashboard webhook endpoint must be subscribed to `charge.refunded` in addition to `payment_intent.succeeded`, or the event never arrives — this is dashboard config, not code.
