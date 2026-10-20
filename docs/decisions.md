# Decisions, Assumptions and Open Questions

Status key: **Assumed** = chosen by the build team to unblock the MVP, reversible;
**Open** = needs the product owner / legal before pilot launch.

## Conflicts between the PRD and the development prompt

| # | Topic | PRD | Prompt | Resolution |
|---|---|---|---|---|
| C1 | Product name | "Digital Blue Economy Marketplace for Nigeria" | "BlueMarket Nigeria" | UI uses **BlueMarket Nigeria**; legal pages name the operator as a placeholder until the operator is appointed (PRD §17.2). |
| C2 | Registration channel | Phone and/or email | Email + password required; phone OTP optional | Email + password implemented. Phone stored on profile; phone OTP left for when an SMS provider is approved. |
| C3 | Payments in MVP | MVP may be enquiry/order coordination; payments in Release 1.1 | Payment abstraction + sandbox now | Built the abstraction, sandbox and an offline-payment flow. Real provider stays disabled until selected. |
| C4 | Reviews, CSV reports, price trends | Release 1.1 | Required now | Implemented now; they are small and use existing data. |
| C5 | Proximity sort | Sort by proximity when location permission is granted | Maps are optional | Not implemented (no geocoding provider). Location filtering by state instead. Backlog item. |

## Assumed (reversible)

| # | Decision |
|---|---|
| A1 | **One order = one seller business.** A multi-supplier cart is split into one order per supplier at checkout. |
| A2 | **Cart is client-side** (localStorage). Prices, availability and fees are always recomputed on the server by `create_order()`; the client's numbers are never used. |
| A3 | Only **fixed-price** listings can be ordered directly. "Quote required" listings go through enquiry → quotation → accept, which creates an order already in `accepted`. |
| A4 | **No stock reservation.** Acceptance confirms availability; suppliers adjust quantity manually (PRD §6.4). |
| A5 | **Marketplace fee is shown to and paid by the buyer**, computed as `marketplace_fee_bps` of subtotal. Default `0` until the commission model is approved. |
| A6 | **Tax** is `tax_bps` of (subtotal + delivery + fee), default `0`. VAT treatment needs tax advice before it is switched on. |
| A7 | Listings **expire after 14 days** (`listing_default_ttl_days`) unless the supplier refreshes availability. Expired listings disappear from public search but remain visible to the owner. |
| A8 | Buyers confirm receipt (`delivered → completed`). Auto-completion after N days is backlog. |
| A9 | After payment, buyers cannot cancel directly. They open a dispute with category `cancellation_request`; an admin decides (refund or continue). |
| A10 | Agency dashboards suppress any regional group with fewer than `analytics_min_group_size` (default 5) businesses. |
| A11 | Verification states follow PRD §6.1 exactly: Unverified, Pending Review, Verified, Suspended, Rejected. "Verified" means "verified by the marketplace operations team" and the UI says so — never government endorsement. |
| A12 | Product images are public (bucket `product-images`). Verification documents and dispute evidence are private with signed URLs (60 s). |
| A13 | Localization: English only; strings are plain and short. NGN formatting via `Intl.NumberFormat('en-NG')`. |
| A14 | Supplier contact phone / WhatsApp on a business profile is public **only** if the business sets visibility to public. Business street address and CAC number are always private. |

## Open (must be resolved before pilot)

1. Legal operator and product owner (drives privacy notice, terms, data-controller role).
2. Payment provider and settlement model (direct-to-seller vs approved split settlement).
3. Commission / subscription structure and who bears payment fees.
4. Verification evidence required per user type, and who is authorised to verify.
5. Pilot geography and initial categories (seed categories are a starting suggestion).
6. Data residency / hosting requirements (Supabase region choice).
7. Email and SMS provider selection and consent wording.
8. Dispute service-level targets and escalation path.
9. Whether `processed` products need food-safety certificate metadata to be mandatory.
10. Retention periods for orders, audit logs and verification documents (NDPA 2023 review).
