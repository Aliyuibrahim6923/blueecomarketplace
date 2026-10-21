# Supabase setup and migration guide

## 1. Create projects

Create **separate** Supabase projects for development/staging and production. Pick the region according to the
data-residency decision (see `docs/decisions.md`, open question 6).

## 2. Apply migrations

Migrations live in `supabase/migrations/` and are applied in filename order:

| File | Contents |
|---|---|
| `…0100_foundation` | `private` schema, enum types, Nigerian states, generic helpers |
| `…0200_identity` | profiles, roles, businesses, private details, memberships, verification requests, auth triggers |
| `…0300_platform` | platform settings, audit log, notifications + outbox, rate limiting |
| `…0400_catalogue` | categories (starter set), products, images, saved products |
| `…0500_commerce` | enquiries, messages, quotations, orders, items, status history, payments, webhook ledger |
| `…0600_logistics_and_trust` | logistics services & bookings, reviews, disputes, attachments, reports, support |
| `…0700_order_workflows` | order state machine, create/accept/transition, quotations, payments RPCs |
| `…0800_operations` | onboarding, data export, team members, bookings, disputes, verification, moderation, admin RPCs |
| `…0900_rls_policies` | privilege reset + every RLS policy + RPC grants |
| `…1000_search_and_analytics` | search, supplier insights, admin overview, agency analytics |
| `…1100_storage` | buckets (`product-images` public; `verification-documents`, `dispute-evidence` private) + policies |
| `…1200_exports_and_maintenance` | audited CSV export hook, quotation expiry |

**Development / staging**

```bash
supabase link --project-ref <staging-ref>
supabase db push          # applies pending migrations
psql "$STAGING_DB_URL" -f supabase/seed.sql   # optional: fictional demo data, staging only
```

**Production** — use a controlled process:

1. Take a backup (Dashboard → Database → Backups, or `pg_dump`) and note the time.
2. Review the migration diff in a pull request; run `npm run test:db` locally and in CI.
3. Apply to staging first and smoke-test.
4. Apply to production with `supabase db push` from a release branch. **Never load `seed.sql` into production.**
5. Record the migration version in the release notes.

Migrations are written forward-only. Each file header notes what a rollback involves; prefer a new corrective
migration over editing an applied one. Destructive changes (dropping columns/tables) must be split: deploy code that
no longer uses the column first, then drop it in a later migration after a backup.

## 3. Bootstrap the first administrator

Admin and agency-analyst roles can only be granted by an existing admin (`grant_privileged_role()`), or once, by a
database owner. After the first person signs up, run in the SQL editor:

```sql
insert into public.role_assignments (user_id, role)
select id, 'admin' from public.profiles where email = 'first.admin@your-organisation.ng';
```

From then on, grant roles from **Dashboard → Users & roles** (audited). Require MFA for admin accounts (Supabase
Auth → MFA) as the PRD asks.

## 4. Authentication settings

Dashboard → Authentication:

- **Providers → Email**: enabled, *Confirm email* ON, minimum password length 10.
- **URL configuration**
  - Site URL: `https://<your-domain>`
  - Redirect URLs: `https://<your-domain>/auth/callback`, `https://<your-domain>/auth/confirm`,
    and for previews `https://*-<team>.vercel.app/auth/callback` (and `/auth/confirm`). Locally:
    `http://localhost:3000/auth/callback`.
- **Email templates** (recommended — works when the link is opened on a different device):
  - *Confirm signup*: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding`
  - *Reset password*: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset-password`
  - The default templates also work through `/auth/callback` (PKCE) when opened in the same browser.
- **SMTP**: configure a real SMTP sender before the pilot; the built-in sender is rate-limited.
- **Rate limits**: keep Supabase's auth rate limits on; the app adds its own limits for enquiries, orders, reports,
  bookings, support requests and payments (`private.enforce_rate_limit`).

## 5. API keys

Use the **publishable** key (`sb_publishable_…`, or the legacy `anon` key) in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
Use the **secret** key (`sb_secret_…`, or legacy `service_role`) only in `SUPABASE_SECRET_KEY` on the server — it is
needed only for the payment webhook/callback and the notification outbox job.

## 6. Storage

Buckets and policies are created by migration `…1100_storage`. Confirm in Dashboard → Storage that:

- `product-images` is **public** (5 MB, JPEG/PNG/WebP),
- `verification-documents` and `dispute-evidence` are **private** (10 MB, PDF/JPEG/PNG[/WebP]).

Object names must be `<folder-uuid>/<random-uuid>.<ext>`; the folder decides who can read/write. Private files are
only ever served through 60-second signed URLs. Add malware scanning (PRD §9) before the public launch — see backlog.

## 7. Backups and restore

- Enable Point-in-Time Recovery on the production project (paid plan).
- Test a restore into a scratch project before the pilot go/no-go, and every quarter after.
- Storage objects are not included in database backups — schedule a bucket export for the private buckets.

## 8. Running the SQL tests without Docker

`npm run test:db` creates a temporary PostgreSQL cluster, loads `supabase/tests/00_supabase_shim.sql` (stub
`auth`/`storage` schemas and API roles — **never run the shim against a real project**), applies every migration and
the seed, then runs `supabase/tests/0*.sql`. Use `DATABASE_URL=postgres://…` to point it at an empty scratch database.
