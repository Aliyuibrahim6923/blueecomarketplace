# Known limitations, unresolved decisions and next-release backlog

## Verification status of this build

| Check | Status |
|---|---|
| SQL migrations + seed apply cleanly on PostgreSQL 16 | ✅ verified (`npm run test:db`) |
| RLS / workflow / storage SQL tests | ✅ ~150 assertions passing |
| Pure TypeScript logic (money, pricing, state machine, redirects, CSV, webhook HMAC) | ✅ type-checked (strict) and executed |
| `npm install`, lint, full typecheck, Vitest, `next build` | ⏳ run by GitHub Actions CI — see the latest CI run |
| Playwright end-to-end journeys | ⏳ written; need a local/test Supabase with the seed |
| Deployed to Vercel | ❌ not deployed — needs Supabase + Vercel credentials |

## Known limitations

1. **Payments**: the Paystack adapter follows the public API docs but has not been run against a real Paystack
   account. A provider has not been selected (open decision). Refunds are recorded as decisions; money movement must
   be done in the provider dashboard.
2. **No malware scanning** of uploads yet (PRD §9). Required before public launch.
3. **Phone OTP / SMS sign-in** not implemented (needs an approved SMS provider and Supabase phone auth).
4. **Proximity sort / maps** not implemented (no geocoding provider); location filtering is by state.
5. **Team member names**: teammates appear as "Team member" because profiles are private; add a members-view RPC.
6. **Order amendments** after acceptance are not supported in the UI (cancel and re-order). The PRD requires
   explicit acceptance by both parties — design needed.
7. **Stock** is not reserved or decremented automatically (by design, PRD §6.4).
8. **Assisted onboarding** (staff acting for low-literacy users with consent) is not built; current workaround is
   support staff guiding users.
9. **Localization**: English only; strings are inline (extract to message catalogues before adding languages).
10. **Notification preferences** are per channel, not per event type.
11. **Content-Security-Policy** header not yet set (needs nonce plumbing).
12. **Dispute SLAs and escalation** are documented as pending; no automated reminders.
13. Hand-written TypeScript row types (`types/domain.ts`); regenerate with `supabase gen types` once a project exists.
14. Daily cron on Hobby plan means email/SMS copies can be delayed up to a day (in-app is immediate).

## Unresolved product decisions

See `docs/decisions.md` → *Open*: legal operator, payment provider and settlement model, commission model, verification
evidence per user type, pilot geography/categories, data residency, messaging providers, dispute SLAs, food-safety
document rules, retention periods.

## Prioritised backlog (next release)

| # | Item | Why |
|---|---|---|
| S1 | Malware scanning for uploads (e.g. Storage webhook → scanner → quarantine flag) | PRD security requirement |
| S2 | Enforce admin MFA (AAL2 check in admin RPCs via `auth.jwt()->>'aal'`) | PRD §10 |
| P1 | Select payment provider; run Paystack (or chosen) test-mode end-to-end; reconciliation report vs provider settlements | Release 1.1 exit criteria |
| P2 | Refund execution through provider API with idempotency keys | Close the refund loop |
| O1 | Order amendment flow with two-party acceptance and audit | PRD §6.4 |
| O2 | Auto-complete delivered orders after N days without dispute | Fewer stuck orders |
| O3 | Listing-expiry reminders to suppliers (cron + notification) | Reduce stale inventory |
| L1 | Link logistics bookings into order timelines; delivery fee from accepted booking | Coordination |
| T1 | Traceability QR batch pages with approved public fields | Release 2 |
| A1 | Assisted onboarding with consent capture and audited "acting on behalf" | Inclusion |
| A2 | Members view RPC (names/emails for teammates) | Team management |
| N1 | Per-event notification preferences; WhatsApp channel via approved provider | Engagement |
| I1 | Yoruba, Hausa, Igbo, Pidgin translations | Inclusion |
| R1 | Report filters by date/category/geography/role with role-based export permissions | PRD §6.10 |
| R2 | Repeat-buyer, time-to-source and listing-to-order conversion metrics | PRD §12 KPIs |
| X1 | CSP with nonces; Dependabot; automated `npm audit` in CI | Security hygiene |
| X2 | Supabase local stack in CI to run Playwright on every PR | Regression safety |
| D1 | Retention jobs (anonymise closed accounts after retention period) | NDPA |
