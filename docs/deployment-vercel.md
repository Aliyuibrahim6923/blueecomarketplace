# Deploying to Vercel

Deploying the frontend does **not** create the database schema or configure authentication. Complete
`docs/supabase-setup.md` for the target environment first.

## 1. Import the repository

Vercel → Add New → Project → import `blueecomarketplace`. Framework preset: **Next.js**. Build command `npm run build`,
install command `npm ci` once `package-lock.json` is committed (until then `npm install`). Node.js 20 or 22.

## 2. Environment variables

| Variable | Required | Environments | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | all | Project URL for that environment |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Yes** | all | Publishable/anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY` is also accepted) |
| `NEXT_PUBLIC_SITE_URL` | **Yes** | all | `https://<domain>` in production; preview URL or staging domain otherwise |
| `SUPABASE_SECRET_KEY` | For webhooks / outbox | production, preview | Server-only. Never prefix with `NEXT_PUBLIC_` |
| `CRON_SECRET` | For the notification job | production | Random ≥ 32 chars; Vercel Cron sends it as a bearer token |
| `PAYMENT_PROVIDER` | Optional | — | `paystack` only after the product owner approves it |
| `PAYSTACK_SECRET_KEY` | With provider | — | Use **test** keys in preview, **live** keys only in production |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional | — | Email copies of notifications |
| `SMS_WEBHOOK_URL`, `SMS_WEBHOOK_TOKEN` | Optional | — | HTTPS bridge to the approved SMS provider |
| `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_SUPPORT_PHONE` | Optional | — | Shown on the Help page |

The app starts without the optional values; those features simply stay off (in-app notifications always work).

## 3. Production vs preview

- Point **Preview** deployments at the staging Supabase project, never production data.
- In production set the platform setting `payment_sandbox_enabled` to **Off** (Dashboard → Platform settings). The
  settings page warns while it is on.
- Add the preview and production callback URLs to Supabase Auth redirect URLs.

## 4. Payments webhook (when a provider is enabled)

Webhook URL: `https://<domain>/api/payments/webhook/paystack`. Use the provider's test mode first and confirm:
signature rejection (wrong secret → 401), replay (same event → `duplicate: true`), amount mismatch flagged in admin.

## 5. Cron

`vercel.json` schedules `/api/cron/notifications` once a day (compatible with the Hobby plan). On a Pro plan change the
schedule to every 5–10 minutes for timely email/SMS copies. The job also expires stale quotations.

## 6. Domain & HTTPS

Vercel → Project → Domains → add the domain and follow the DNS instructions; certificates are issued automatically.
Update `NEXT_PUBLIC_SITE_URL` and the Supabase Site URL to the final domain. HSTS is sent by `next.config.ts`.

## 7. Logging & monitoring

- Vercel → Logs for function errors (the app logs error *codes*, never payloads or personal data).
- Uptime monitor on `GET /api/health` (returns 503 if the database is unreachable).
- Supabase → Logs / Reports for database and auth.
- Review the admin overview daily during the pilot for payment mismatches and unreconciled offline payments.

## 8. Rollback & recovery

- **Code**: Vercel → Deployments → promote the previous deployment ("Instant Rollback").
- **Database**: migrations are forward-only; ship a corrective migration. For data loss, restore from PITR/backup into
  a new project, verify, then switch the environment variables.
- Keep the last known-good deployment ID and migration version in the release notes.

## 9. Smoke test after each deployment

1. `GET /api/health` → `{ ok: true }`.
2. Sign up with a new email → confirmation email arrives → onboarding completes.
3. Create a business, a listing with a photo, publish it, find it in search.
4. As another account: add to cart → order request → supplier accepts → (staging) sandbox payment or offline payment → fulfil → complete → review.
5. Open a dispute on a paid test order; resolve it as admin; both parties get notifications.
6. Admin: verification decision, hide/restore a listing, export a CSV, confirm audit log entries.
7. Agency analyst: analytics page loads; admin pages are denied.

## Deployment checklist

- [ ] Supabase project created in the agreed region; migrations applied; first admin bootstrapped with MFA
- [ ] Auth URLs, email templates and SMTP configured
- [ ] Vercel env vars set per environment; secrets not exposed with `NEXT_PUBLIC_`
- [ ] `payment_sandbox_enabled` OFF in production
- [ ] Legal pages reviewed and operator named (privacy, terms, rules)
- [ ] Backups/PITR on; restore tested
- [ ] Uptime monitoring on `/api/health`
- [ ] Smoke test passed and recorded
