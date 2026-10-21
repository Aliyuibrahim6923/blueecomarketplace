# Security and privacy notes

Designed with the Nigeria Data Protection Act 2023 in mind; **subject to professional legal review**.

## Authorization layers

1. **RLS on every table** in `public` (and Supabase Storage). Privileges are reset to zero in migration `0900` and
   granted per table/command; some updates are restricted to specific columns (profiles, businesses, notifications).
2. **Protected-column triggers** stop clients changing their own account status, a business's verification status,
   moderation state, platform-managed listing fields, etc.
3. **State machines in SQL** (`SECURITY DEFINER`, fixed `search_path`) for orders, quotations, payments, bookings,
   disputes, verification and moderation. Each checks the caller's relationship to the record, enforces allowed
   transitions, and writes history/notifications/audit in one transaction. Clients have no `UPDATE` on those tables.
4. **Zod validation** on every server action and route handler; friendly errors only (`lib/errors.ts`).
5. Route redirects (`proxy.ts`, dashboard layouts) are convenience only.

Tested in `supabase/tests/02–05` (≈150 assertions): guest/buyer/supplier/analyst/admin isolation, self-granting
privileged roles, client-side price tampering, skipping order states, webhook replays and amount mismatches,
storage folder isolation, internal dispute notes, suspended businesses.

## Privileged access

- `admin` / `agency_analyst` roles: granted only by an admin RPC or a one-time owner bootstrap; every grant/revoke,
  verification decision, moderation action, suspension, setting change, dispute decision, offline payment record and
  CSV export is written to `audit_logs` (append-only; update/delete blocked by trigger).
- Admins cannot suspend themselves, remove their own admin role, or review verification for a business they belong to.
- Agency analysts never get table access — only `agency_overview()`, which aggregates and suppresses groups below
  `analytics_min_group_size`, and excludes sandbox payments. Each view is audited.
- The service-role key is used only by `lib/supabase/admin.ts` in the webhook/callback and outbox worker.

## Payments

No card data touches the app. Hosted checkout via the provider; webhook signatures verified with HMAC over the raw
body (timing-safe compare); events stored once by `(provider, event_key)`; transactions re-verified with the
provider's API; amount and currency must match the order total stored in the database; one successful transaction per
order (unique index). No wallet/escrow/credit.

## Files

Public bucket only for product photos. Private buckets for verification documents and dispute evidence with
60-second signed URLs. Object names must be `<uuid-folder>/<uuid>.<ext>` (enforced in Storage RLS), MIME allow-lists
and size limits at bucket level, client-side compression for images. **Malware scanning is not yet implemented** —
required by the PRD before public launch (backlog item S1).

## Web security

- Security headers in `next.config.ts` (HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy).
  A strict Content-Security-Policy is a backlog item (needs nonce support for Next.js inline scripts).
- Server Actions include Next.js's built-in origin check (CSRF protection); sign-out is POST-only.
- `safeRedirectPath()` blocks open redirects (`//host`, `/\host`, absolute URLs, control characters).
- React escapes output; no `dangerouslySetInnerHTML`.
- CSV exports neutralise formula injection.
- Rate limits in SQL for enquiries, messages, orders, payments, reports, bookings, disputes, support and product views.
- Errors shown to users never include stack traces; logs record error codes only.

## Personal data

- Collected: name, email, optional phone, business details, uploaded documents, marketplace records.
- Minimisation: business street address and registration number live in a separate members-only table; contact
  details are public only if the business opts in; counterparties see contact details only on shared orders/enquiries.
- Data rights: `export_my_data()` (download in Account), deletion request (admin-handled to respect retention duties).
- Notifications avoid amounts and personal details (lock-screen safe).
- Do not log passwords, tokens, documents or payment credentials (none are logged).

## Before launch (security sign-off items)

- External penetration test and dependency scan (`npm audit`, Dependabot).
- Admin MFA enforced; least-privilege review of admin accounts.
- Incident-response and breach-notification procedure aligned with NDPA timelines.
- Data-processing agreements with Supabase, Vercel, email/SMS and payment providers.
- Retention schedule implemented (see backlog).
