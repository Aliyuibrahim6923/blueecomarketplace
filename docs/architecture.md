# BlueMarket Nigeria — Architecture Overview

This document describes how the MVP is built and why. Product scope comes from
`docs/prd/Digital_Blue_Economy_Marketplace_PRD_Nigeria.md` (PRD v1.0, working draft)
and the master development prompt. Decisions that the PRD leaves open are listed in
[`decisions.md`](./decisions.md).

## 1. System context

```
 Browser (mobile-first, low-bandwidth)
   │  HTTPS
   ▼
 Next.js App Router on Vercel
   ├─ Server Components  → read data with the *user's* Supabase session (RLS applies)
   ├─ Server Actions     → validate with Zod, call RLS-protected tables or
   │                       SECURITY DEFINER RPCs that re-check authorization
   ├─ Route Handlers     → auth callbacks, payment webhooks, CSV export, cron
   └─ proxy.ts           → refreshes the Supabase auth cookie on every request
   │
   ▼
 Supabase
   ├─ Auth (email + password, email verification, password reset)
   ├─ PostgreSQL (RLS on every table; business rules in SQL functions)
   └─ Storage (public product images; private verification docs & dispute evidence)

 Optional, configured by environment variables only:
   payment provider (sandbox / offline / Paystack adapter) · email · SMS
```

## 2. Security model in one page

| Layer | Responsibility |
|---|---|
| Route protection (`proxy.ts`, dashboard layout) | UX only — redirects signed-out users. **Never** the security boundary. |
| Zod schemas (`lib/validation`) | Shape, length and range checks at every server action and route handler. |
| Row Level Security | The real boundary. Every table in `public` has RLS enabled. Ordinary reads/writes run as the signed-in user. |
| Protected-column triggers | Stop users from changing their own `account_status`, a business's `verification_status`, a listing's moderation state, etc. They fire when `current_user` is `anon`/`authenticated`. |
| SECURITY DEFINER RPCs | All state machines (orders, bookings, disputes, verification, moderation) run inside SQL functions that check the caller's relationship to the record, enforce allowed transitions, write status history, notifications and audit events in one transaction. Direct `UPDATE` on those tables is not granted. |
| Service-role key | Used **only** in `lib/supabase/admin.ts` (marked `server-only`) for the payment webhook and the notification outbox worker. Never imported by client code. |

Privileged roles (`admin`, `agency_analyst`) live in `role_assignments` and can only be
granted by an existing admin through `grant_privileged_role()` (audited) or by the
one-time bootstrap SQL in `docs/supabase-setup.md`. Users can self-assign only
`buyer`, `supplier` and `logistics_provider`.

Agency analysts never get table access. They call `agency_overview()`, which returns
aggregates only and suppresses any regional group smaller than the configured
minimum (default 5 businesses).

## 3. Domain model

```
auth.users ─1:1─ profiles ─1:n─ role_assignments
                    │
                    └─n:m─ businesses (via business_memberships: owner/manager/staff)
                              ├─ business_private_details (address, CAC no.) — members/admin only
                              ├─ business_verification_requests ─ storage: verification-documents
                              ├─ products ─ product_images ─ storage: product-images
                              ├─ logistics_services ─ logistics_bookings
                              └─ reviews (as subject)

buyer ─ enquiries ─ enquiry_messages
               └─ quotations ──accept──▶ orders ─ order_items
                                           ├─ order_status_history
                                           ├─ payment_transactions ◀─ payment_webhook_events
                                           ├─ disputes ─ dispute_messages / dispute_attachments
                                           └─ reviews
notifications ─ notification_outbox      audit_logs      platform_settings
content_reports      support_requests    rate_limits
```

Money is stored as `bigint` **minor units** (kobo for NGN) with a `currency` column.
Quantities are `numeric(14,3)`. Line totals are computed in SQL with
`round(unit_price_minor * quantity)` — no floating point anywhere.

## 4. Order lifecycle

```
draft → requested → accepted → awaiting_payment → paid → preparing → dispatched → delivered → completed
            │           │              │             │        │            │           │
            ├→ rejected ├→ cancelled   ├→ cancelled  └────────┴──→ disputed ←┴───────────┘
            └→ cancelled                                              │
                                                                       └→ refunded | completed (admin)
paid → refunded (admin)
```

Allowed transitions and who may perform them are defined once in SQL
(`order_transition_allowed`) and mirrored in `lib/orders/state-machine.ts` for the UI.
Both are covered by tests against the same matrix.

Seller acceptance confirms terms but **does not reserve stock** (PRD §6.4); suppliers
update available quantity themselves.

## 5. Payments

`lib/payments` defines a `PaymentProvider` interface (initialize, verify, parse/verify
webhook). Implementations:

* **sandbox** — development only, enabled by `platform_settings.payment_sandbox_enabled`.
  Every sandbox transaction is stored with `provider = 'sandbox'` and labelled
  "Sandbox — not a real payment" in the UI and in reports.
* **offline** — pilot flow from PRD §7.2: the seller records that payment was received
  outside the platform. Enabled by `offline_payments_enabled`.
* **paystack** — an adapter written against Paystack's documented API
  (initialize, verify, HMAC-SHA512 webhook signature). It is inactive until the product
  owner selects a provider and supplies keys. Selecting a provider is an open decision.

The webhook handler verifies the signature on the raw body, stores the event in
`payment_webhook_events` (unique per provider + event key → idempotent), re-verifies
the transaction with the provider's API, and only then calls
`record_payment_result()`, which checks amount and currency against the order before
moving it to `paid`. The browser redirect is never trusted.

## 6. Notifications

Database functions insert in-app notifications in the same transaction as the event
that caused them, and queue an `notification_outbox` row per channel the user opted
into. `/api/cron/notifications` (Vercel Cron, protected by `CRON_SECRET`) delivers
the outbox through the configured email/SMS provider, or marks rows `skipped` when no
provider is configured. In-app notifications always work. Notification text avoids
amounts and personal details so it is safe on lock screens.

## 7. Code layout

```
app/                 routes (public site, auth, dashboard, admin, API)
components/          ui primitives (shadcn-style) and layout
features/<module>/   server actions, queries and module components
lib/supabase/        browser, server, proxy and server-only admin clients
lib/validation/      Zod schemas
lib/permissions/     role helpers for UI decisions
lib/payments/        provider interface + adapters
lib/notifications/   email / SMS interfaces + adapters
lib/orders/          state machine + money calculations
supabase/migrations/ versioned SQL
supabase/seed.sql    fictional development data
supabase/tests/      SQL tests for RLS and business rules
tests/unit, tests/e2e
```
