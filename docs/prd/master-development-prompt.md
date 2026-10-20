MASTER AI DEVELOPMENT PROMPT

Digital Blue Economy Marketplace for Nigeria

1. ROLE AND OBJECTIVE

Act as a senior full-stack software engineer, product designer, Supabase architect, security engineer, QA engineer and technical project lead.

Build a complete, responsive, production-minded web application called BlueMarket Nigeria — a Digital Blue Economy Marketplace that connects fishers, aquaculture farmers, seafood processors, wholesalers, retailers, restaurants, exporters, logistics providers and cold-chain operators.

Use the supplied Product Requirements Document (PRD) as the primary product specification.

Do not merely create a landing page, static prototype or collection of non-functional UI screens. Build a functional application with real authentication, database persistence, role-based access, working forms, CRUD operations, search, order management, administrative workflows and deployment configuration.

If the PRD conflicts with this prompt, identify the conflict and follow the explicitly approved product requirements. Document unresolved decisions.

2. REQUIRED TECHNOLOGY STACK

Use the following stack:

* Frontend and full-stack framework: Next.js with App Router.
* Language: TypeScript with strict type checking.
* UI: React, Tailwind CSS and accessible reusable components.
* Component library: shadcn/ui where appropriate.
* Backend and database: Supabase PostgreSQL.
* Authentication: Supabase Auth.
* Database security: PostgreSQL Row Level Security (RLS).
* File storage: Supabase Storage.
* Backend logic: Next.js Server Actions and Route Handlers where appropriate.
* Hosting and deployment: Vercel.
* Validation: Zod and server-side validation.
* Forms: React Hook Form where appropriate.
* Testing: Vitest or an equivalent unit-testing framework, plus Playwright for end-to-end tests.
* Code quality: ESLint, TypeScript and automated build checks.
* Payments: design a provider abstraction and integrate a licensed provider only after credentials and configuration are supplied.
* Maps and notifications: use configurable providers; core functionality must work when optional third-party services are not configured.

Use current stable, mutually compatible package versions. Consult the official documentation for Next.js, Supabase and Vercel when implementing integrations. Do not invent API methods or use deprecated patterns.

3. PRODUCT VISION

Create a trusted digital marketplace that helps Nigerian coastal and marine businesses discover buyers, list products, manage orders, coordinate delivery and cold storage, and access relevant market information.

The application should support a future global customer base while initially prioritizing Nigerian users, Nigerian Naira (NGN), local phone numbers, Nigerian business operations and mobile-first access.

Build the MVP to support a controlled pilot before adding advanced functionality.

4. USER ROLES

Implement these roles:

1. Guest — browse public listings and categories.
2. Buyer — search products, save listings, contact suppliers, request quotations and place orders.
3. Supplier — manage business profile, publish products, manage inventory and fulfil orders.
4. Logistics provider — publish delivery and cold-chain services and respond to booking requests.
5. Marketplace administrator — manage users, listings, categories, disputes, platform settings and reports.
6. Agency analyst — access authorized aggregate blue economy reports without unrestricted access to personal or confidential transaction data.

A user may have multiple business roles where appropriate.

Never allow a user to assign themselves an administrator or agency analyst role. Privileged roles must be granted through a secure, server-controlled process.

5. DESIGN AND USER EXPERIENCE

Create a modern, trustworthy, professional African maritime technology brand.

Visual direction:

* Deep ocean blue, teal, white and restrained coral accents.
* Clean layouts, generous spacing and strong typography.
* Realistic product photography for seafood and coastal businesses.
* Professional dashboards with useful data visualizations.
* Responsive layouts optimized for low-cost Android phones.
* Accessible forms, keyboard navigation, clear error messages and loading states.
* Consistent components, spacing, buttons, badges and navigation.

Create:

* Public marketing website.
* Marketplace discovery pages.
* Buyer dashboard.
* Supplier dashboard.
* Logistics provider dashboard.
* Administration dashboard.
* Agency analytics dashboard.

The public website should include:

* Home.
* Browse marketplace.
* Product categories.
* How it works.
* For suppliers.
* For buyers.
* Logistics and cold-chain services.
* About.
* Help and contact.
* Privacy policy and terms of use.

Do not use fake testimonials, invented partnerships, fabricated transaction statistics or misleading claims about verified suppliers.

6. CORE MARKETPLACE FEATURES

A. Authentication and onboarding

Implement:

* Email and password authentication.
* Email verification.
* Password reset.
* Sign-in and sign-out.
* Protected dashboard routes.
* Role-aware onboarding.
* Profile completion.
* Business registration information.
* Configurable business verification workflow.
* Account suspension and reactivation by authorized administrators.

Phone OTP may be added if an appropriate Supabase configuration and SMS provider are available.

B. Product marketplace

Implement:

* Product listing creation, editing, publishing, pausing and archiving.
* Product photographs uploaded to Supabase Storage.
* Product categories including fresh fish, frozen seafood, aquaculture, processed seafood, shellfish and other approved marine products.
* Product name, description, price, currency, unit, quantity, location, availability and seller information.
* Fresh, frozen or processed product status.
* Optional harvest or landing date, handling information and supporting certification metadata.
* Search by keyword and category.
* Filters for price, location, availability and supplier verification status.
* Sorting by relevance, newest and price.
* Pagination.
* Empty, loading and error states.
* Expiration or availability refresh for stale listings.

Use server-side validation and enforce ownership rules for listing modifications.

C. Buyer experience

Implement:

* Browse and search.
* Product details.
* Supplier profiles.
* Saved products.
* Enquiry and quotation requests.
* Shopping cart where compatible with the selected order model.
* Checkout and order confirmation.
* Order history.
* Order status timeline.
* Repeat-order functionality.
* Cancellation requests under defined business rules.
* Order-linked reviews after completion.
* Complaint and dispute submission.

D. Supplier experience

Implement:

* Supplier dashboard.
* Listing management.
* Inventory availability.
* Incoming enquiries.
* Quotation management.
* Order acceptance or rejection.
* Preparation, dispatch and delivery status updates.
* Customer communication.
* Sales and order summaries.
* Business profile and verification status.
* Product performance insights.

E. Logistics and cold-chain services

Implement:

* Provider profiles.
* Service categories for delivery, refrigerated transport, cold storage, ice supply and other relevant services.
* Service coverage areas.
* Capacity and pricing information.
* Booking or quotation requests.
* Booking status management.
* Delivery terms and expected dates.
* Proof-of-delivery records where appropriate.

Use request-and-confirm workflows for the MVP. Do not pretend to have real-time fleet tracking without an actual integration.

F. Orders and payments

Implement an auditable order lifecycle:

Draft → Requested → Accepted → Awaiting Payment → Paid → Preparing → Dispatched → Delivered → Completed.

Also support valid rejection, cancellation, refund and dispute states.

Enforce permitted status transitions on the server.

For payment integration:

* Define a provider-independent payment interface.
* Use a licensed payment provider selected by the product owner.
* Verify payment events server-side.
* Validate webhook signatures.
* Use idempotency controls to prevent duplicate processing.
* Maintain transaction references and reconciliation records.
* Never trust client-side payment success messages.
* Never store raw card details.
* Never expose secret payment keys in browser code.
* Do not implement an internal wallet or escrow unless separately approved and legally reviewed.

When payment credentials are absent, implement a clearly labelled sandbox or development mode. Do not represent simulated payments as real transactions.

G. Notifications

Create an in-app notification system for:

* Account verification.
* New enquiries.
* Quote responses.
* Order status changes.
* Payment status.
* Delivery updates.
* Dispute outcomes.

Make email and SMS notifications optional provider integrations. Provide graceful fallback when they are not configured.

H. Trust, safety and disputes

Implement:

* Supplier verification statuses.
* Listing reports.
* User reports.
* Order-linked ratings and reviews.
* Dispute case management.
* Evidence attachments with access controls.
* Administrative moderation.
* Audit history for privileged actions.
* Clear labels distinguishing self-declared information from verified information.

Do not claim that an uploaded licence or certificate has been authenticated unless an authorized verification process confirms it.

I. Agency administration and analytics

Create an administration console with:

* User management.
* Business verification queue.
* Listing moderation.
* Product category management.
* Order monitoring.
* Dispute management.
* Reports and CSV exports.
* Platform configuration.
* Audit logs.
* Operational overview.

Create an agency analytics dashboard showing appropriately aggregated metrics such as:

* Registered and active businesses.
* Verified suppliers.
* Published listings.
* Orders and completed transactions.
* Gross merchandise value (GMV).
* Marketplace revenue, shown separately from GMV.
* Regional participation.
* Product availability and price trends.
* Logistics service utilization.
* Dispute and cancellation rates.

Apply least-privilege access and privacy safeguards. Agency analysts must not automatically gain access to private buyer messages, personal information or confidential business records.

7. SUPABASE DATABASE DESIGN

Create version-controlled SQL migrations for a normalized PostgreSQL schema.

Include tables or equivalent relational entities for:

* profiles
* businesses
* business_memberships
* role_assignments
* business_verification_requests
* categories
* products
* product_images
* saved_products
* enquiries
* quotations
* orders
* order_items
* order_status_history
* payment_transactions
* payment_webhook_events
* logistics_services
* logistics_bookings
* reviews
* disputes
* dispute_attachments
* notifications
* audit_logs
* platform_settings

Adjust the schema where the PRD or a documented architectural decision requires it.

Requirements:

* UUID primary keys where appropriate.
* Foreign-key constraints.
* Appropriate unique constraints.
* Check constraints for valid amounts and statuses.
* Indexes for frequently queried fields.
* Created and updated timestamps.
* Soft deletion where operationally necessary.
* Consistent currency and quantity handling.
* Explicit ownership and tenant boundaries.
* Server-controlled audit events.
* Migration and rollback considerations.

Store money as integer minor units or use a carefully defined PostgreSQL numeric representation. Never use floating-point arithmetic for financial calculations.

Do not place every piece of data into one large table or use unvalidated JSON blobs as a substitute for relational design.

8. ROW LEVEL SECURITY AND ACCESS CONTROL

Enable RLS on every exposed table containing user, business, order, payment or other non-public data.

Create and test policies ensuring:

* Guests can only read approved public listings and public business information.
* Suppliers can manage only listings they own or are authorized to manage.
* Business members can access only records permitted by their membership and permissions.
* Buyers can access only their own private orders, enquiries and related records.
* Suppliers can access orders involving their business, limited to the information needed to fulfil them.
* Logistics providers can access only bookings assigned or offered to them.
* Users cannot alter their own privileged role or verification status.
* Agency analysts can access only explicitly authorized aggregate data.
* Administrators receive privileged access through a secure, audited server-side mechanism.
* Storage objects follow equivalent access policies.

Do not rely only on hidden buttons or frontend route protection.

Do not expose Supabase service-role credentials in client bundles or browser requests. Prefer the authenticated user’s Supabase context and RLS for ordinary operations.

If elevated server credentials are necessary for a narrowly scoped operation, isolate them in server-only code, validate authorization explicitly, and record sensitive administrative actions.

9. SUPABASE STORAGE

Create documented storage buckets and policies for:

* Product images.
* Business verification documents.
* Dispute evidence.

Public access, if enabled for product imagery, must not expose private documents.

Use file-size limits, allowed MIME types, randomized object names and secure upload validation. Use private buckets and signed URLs for confidential files. Never rely on a hidden URL as the sole security mechanism.

10. SECURITY AND PRIVACY

Implement:

* Secure server-side authorization.
* Zod validation on all important input boundaries.
* Protection against unauthorized record access.
* Rate limiting for sensitive operations.
* Safe handling of secrets and environment variables.
* Secure file uploads.
* Output encoding and safe rendering.
* CSRF protection where relevant to the chosen authentication and request design.
* Safe redirect validation.
* Webhook signature verification.
* Audit logging.
* Error messages that do not expose stack traces or secrets.
* Appropriate logging redaction.
* Backup and recovery documentation.
* Account deletion and data-access workflows subject to applicable retention obligations.

Design for compliance with applicable Nigerian data protection requirements, including the Nigeria Data Protection Act 2023, subject to professional legal review.

Do not log passwords, authentication tokens, private documents or full payment credentials.

11. APPLICATION STRUCTURE

Use a maintainable feature-oriented structure, for example:

* app/ for Next.js routes and layouts.
* components/ for reusable UI.
* features/ for marketplace, products, orders, logistics and admin modules.
* lib/supabase/ for browser, server and middleware clients as required by the current Supabase SSR guidance.
* lib/validation/ for schemas.
* lib/permissions/ for authorization helpers.
* lib/payments/ for payment interfaces and provider adapters.
* lib/notifications/ for notification interfaces.
* supabase/migrations/ for SQL migrations.
* supabase/seed.sql or documented seed scripts for development data.
* tests/ for unit, integration and end-to-end tests.
* docs/ for architecture, deployment, security and operating instructions.

Keep secrets and privileged database operations in server-only modules. Use current Supabase SSR conventions rather than deprecated authentication helpers.

12. ENVIRONMENT CONFIGURATION

Create .env.example with placeholders for variables actually used by the implementation, including where applicable:

* NEXT_PUBLIC_SUPABASE_URL
* NEXT_PUBLIC_SUPABASE_ANON_KEY or the current publishable-key equivalent
* SUPABASE_SERVICE_ROLE_KEY only if required for server-only administrative operations
* Payment provider public and secret keys.
* Payment webhook secret.
* Email provider credentials.
* SMS provider credentials.
* Application base URL.
* Any map provider key.

Never commit real secrets.

Clearly document which variables are required for startup and which enable optional integrations. Use current Supabase key conventions and avoid confusing public keys with privileged server credentials.

13. DEPLOYMENT ON VERCEL

Prepare the project for deployment to Vercel.

Provide:

* Reproducible dependency installation.
* Production build scripts.
* Required environment variable documentation.
* Vercel configuration only where necessary.
* Database migration instructions.
* Supabase redirect URL and authentication configuration instructions.
* Production and preview environment guidance.
* Domain and HTTPS setup guidance.
* Logging and monitoring guidance.
* Rollback and recovery instructions.

Never assume that deploying the frontend automatically creates the Supabase schema or configures authentication.

Use a controlled migration process. Do not automatically run destructive migrations against production.

The application must run locally and build successfully before claiming deployment readiness. If Vercel access or Supabase credentials are not provided, prepare the project and explain the remaining setup steps instead of claiming it has been deployed.

14. TESTING REQUIREMENTS

Write automated tests for:

* Registration and login flows.
* Role and permission enforcement.
* RLS isolation between users and businesses.
* Product listing creation and modification.
* Search and filtering.
* Order creation and permitted status transitions.
* Price and total calculations.
* Payment webhook verification and idempotency.
* Dispute creation.
* Unauthorized file access.
* Administrative permissions.
* Empty, loading, validation and failure states.

Use Supabase local development or a dedicated test project where practical. Never run destructive tests against production data.

Run linting, type checking, automated tests and a production build. Fix failures before declaring completion.

15. DEVELOPMENT WORKFLOW

Work in these stages:

Stage 1 — Inspect and plan

* Read the supplied PRD.
* Inspect the repository and existing files before changing them.
* Identify missing decisions and document assumptions.
* Create a concise implementation plan and architecture overview.
* Do not overwrite existing project work unnecessarily.

Stage 2 — Foundation

* Initialize or repair the Next.js application.
* Configure TypeScript, UI components, Supabase clients and environment validation.
* Create database migrations, RLS policies and seed data.
* Establish authentication and role-aware navigation.

Stage 3 — MVP implementation

* Build the public marketplace and product discovery.
* Implement supplier listings and business profiles.
* Implement enquiries, quotations and order management.
* Implement logistics service listings and booking requests.
* Build administration and analytics dashboards.
* Add notifications and integration abstractions.

Stage 4 — Quality and security

* Add automated tests.
* Test RLS policies and unauthorized access.
* Test form validation, order calculations and failure states.
* Resolve lint, type-check and build errors.
* Review the application for security issues and accessibility.

Stage 5 — Deployment preparation

* Document Supabase project setup.
* Apply migrations in the correct environment.
* Configure Vercel environment variables and authentication redirects.
* Deploy only when authorized credentials are available.
* Provide smoke-test instructions and a deployment checklist.

At the end of each stage, summarize files created or modified, tests run, issues remaining and the next stage. Continue working rather than stopping after generating the plan, unless a real blocker requires user input.

16. ACCEPTANCE CRITERIA

The MVP is acceptable only when:

* A user can register and authenticate.
* A supplier can create and manage real database-backed product listings.
* A buyer can search listings and submit an enquiry or order.
* The supplier can respond and manage order status.
* User data is isolated through tested RLS policies.
* Administrators can moderate listings and manage verification requests.
* Core dashboards use real database data rather than hardcoded statistics.
* Unauthorized users cannot access private documents or other users’ records.
* Payment functionality is either properly integrated and tested or clearly disabled until configured.
* Database migrations, environment setup and deployment steps are documented.
* Linting, type checks, relevant tests and the production build pass.

17. REQUIRED DELIVERABLES

Produce:

1. Complete source code.
2. Responsive public website and authenticated dashboards.
3. Supabase SQL migrations and RLS policies.
4. Development seed data clearly labelled as fictional.
5. .env.example.
6. Automated tests.
7. README with local setup instructions.
8. Supabase setup and migration guide.
9. Vercel deployment guide.
10. Architecture and security notes.
11. Known limitations and unresolved decisions.
12. A prioritized backlog for the next release.

Start by inspecting the repository and the supplied PRD. Then implement the application in working, testable stages. Prioritize a secure and functional MVP over superficial feature breadth. Do not fabricate integrations, data, test results or deployment status.