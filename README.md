# BlueMarket Nigeria

**Digital Blue Economy Marketplace** — a mobile-first web marketplace connecting Nigeria's fishers, aquaculture
farmers, seafood processors, wholesalers, retailers, restaurants, exporters, logistics providers and cold-chain
operators. Built for a controlled pilot.

> Status: MVP codebase for pilot preparation. It is **not deployed**. Payment-provider integration is written but
> disabled until a provider is selected. Legal pages are drafts that need Nigerian legal review.

| | |
|---|---|
| Product spec | [`docs/prd/`](docs/prd/) (PRD v1.0 + master development prompt) |
| Architecture | [`docs/architecture.md`](docs/architecture.md) |
| Decisions & open questions | [`docs/decisions.md`](docs/decisions.md) |
| Supabase setup & migrations | [`docs/supabase-setup.md`](docs/supabase-setup.md) |
| Vercel deployment | [`docs/deployment-vercel.md`](docs/deployment-vercel.md) |
| Security & privacy notes | [`docs/security.md`](docs/security.md) |
| Limitations & backlog | [`docs/limitations-and-backlog.md`](docs/limitations-and-backlog.md) |

## What's in the MVP

- **Accounts** — email + password, email verification, password reset, role-aware onboarding (buyer, supplier,
  logistics provider), profile, notification preferences, consent, data export, deletion request.
- **Businesses** — public profile, private details (address, CAC no., contacts), team members, verification
  requests with private document upload, explicit status labels (Unverified / Pending / Verified / Suspended / Rejected).
- **Listings** — create, edit, publish, pause, archive; photos compressed on the phone then stored in Supabase
  Storage; fixed price or price-on-request; origin/handling/certificates shown as *self-declared*; automatic expiry
  with one-tap "still available".
- **Public market (`/market`)** — login-free storefront: browse, search and filter listings, open a listing and contact the seller by WhatsApp, phone or email (only details the seller made public). No accounts, cart or tracking.
- **Discovery** — keyword search (products + suppliers), filters (category, state, product state, price, delivery
  option, verified, fixed price), sorting, pagination, empty/loading/error states.
- **Buying** — cart split per supplier, order requests, enquiries, quotations (accept → order), saved products,
  repeat orders, timeline, cancellation rules, reviews after completion, disputes with evidence.
- **Fulfilment** — server-enforced lifecycle *Requested → Accepted → Awaiting payment → Paid → Preparing →
  Dispatched → Delivered → Completed* (+ Rejected, Cancelled, Disputed, Refunded), with status history.
- **Payments** — provider interface, Paystack adapter (inactive until configured), signed + idempotent webhooks,
  server-side re-verification, reconciliation fields, clearly-labelled **sandbox**, and a pilot **offline payment** flow.
- **Logistics & cold chain** — service directory, coverage/capacity/pricing, request-and-confirm bookings, quotes,
  proof-of-delivery notes. No fake live tracking.
- **Trust & safety** — reports (listings, businesses, users, services), moderation with reasons, dispute case
  management with internal notes, append-only audit log.
- **Admin console** — operations overview (GMV and revenue reported separately), verification queue, moderation,
  categories, orders, disputes, users & privileged roles, platform settings, audit log, CSV exports.
- **Agency analytics** — aggregate-only metrics with small-group suppression; no access to personal records.
- **Notifications** — in-app always; email (Resend) and SMS (HTTPS bridge) optional with graceful fallback.

## Tech stack

Next.js (App Router) · TypeScript (strict) · React · Tailwind CSS v4 · shadcn-style components · Supabase
(PostgreSQL, Auth, Storage, RLS) · Zod · React Hook Form · Vitest · Playwright · Vercel.

## Quick start (local)

Requirements: Node.js ≥ 20.9, and either the [Supabase CLI](https://supabase.com/docs/guides/local-development)
(with Docker) or a Supabase project you can use for development.

```bash
npm install
cp .env.example .env.local          # fill in the Supabase URL and publishable/anon key

# Option A — local Supabase (Docker)
supabase init                       # once, creates supabase/config.toml (keep our migrations folder)
supabase start                      # prints the local URL and keys
supabase db reset                   # applies supabase/migrations/* and supabase/seed.sql

# Option B — a hosted development project
supabase link --project-ref <ref>
supabase db push                    # applies migrations (do NOT load seed.sql into production)

npm run dev                         # http://localhost:3000
```

Demo accounts (seed data — **fictional**, local/test only), password `BlueMarket-Dev-2026!`:

| Email | Role |
|---|---|
| admin@example.test | Administrator |
| analyst@example.test | Agency analyst |
| supplier@example.test | Supplier (verified demo cooperative) |
| farmer@example.test | Supplier (unverified demo fish farm) |
| logistics@example.test | Logistics / cold-chain provider |
| buyer@example.test, buyer2@example.test | Buyers |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint (Next.js + TypeScript rules) |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm test` | Unit tests (Vitest) — money, pricing, state machine, validation, webhook signatures, CSV, redirects |
| `npm run test:db` | Applies every migration + seed to a throwaway PostgreSQL and runs the SQL suite (RLS isolation, workflows, storage policies) — no Docker needed |
| `npm run test:e2e` | Playwright journeys (mobile + desktop) against a **local/test** Supabase loaded with the seed |
| `npm run check` | lint + typecheck + unit tests + build |

CI (`.github/workflows/ci.yml`) runs the database suite and lint/typecheck/unit/build on every push.

## Project structure

```
app/                  routes — (site) public pages, auth/, onboarding/, dashboard/ (incl. admin/, analytics/), api/
components/           ui primitives, form helpers, layout, marketplace widgets, charts
features/<module>/    server actions, queries and module UI (auth, products, orders, logistics, disputes, admin…)
lib/                  env, supabase clients, validation, permissions, payments, notifications, orders, money
supabase/migrations/  versioned SQL (schema, RLS, workflows, storage, analytics)
supabase/seed.sql     fictional development data
supabase/tests/       SQL tests + a Supabase shim for plain PostgreSQL
tests/unit, tests/e2e
docs/                 architecture, decisions, setup, deployment, security, backlog
```

## Important rules for contributors

- Never trust the client: prices, totals, roles and status changes are decided in SQL.
- Never use floating point for money — integer kobo everywhere (`lib/money.ts`, `lib/orders/pricing.ts`).
- Keep `lib/orders/order-transitions.json` and `public.order_transition_allowed()` in sync (a test enforces it).
- The service-role key lives only in `lib/supabase/admin.ts` (webhooks, outbox). Do not import it elsewhere.
- Seed data must stay obviously fictional (`example.test` emails, "(demo)" names).
