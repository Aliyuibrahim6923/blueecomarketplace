**DIGITAL BLUE ECONOMY\
MARKETPLACE FOR NIGERIA**

Product Requirements Document (PRD)

**\
Version 1.0 \| Working Draft \| 21 October 2026\
**Prepared for: Proposed Nigerian maritime / blue economy agency or
implementation partner\
Status: For stakeholder review and discovery validation

# Document Control

  -----------------------------------------------------------------------
  **Field**                           **Details**
  ----------------------------------- -----------------------------------
  Product name                        Digital Blue Economy Marketplace
                                      for Nigeria

  Document type                       Product Requirements Document (PRD)

  Version / date                      1.0 / 21 October 2026

  Product stage                       Concept and discovery; requirements
                                      are proposed

  Primary geography                   Nigeria, with phased potential for
                                      regional/international trade

  Primary audience                    Agency leadership, product owner,
                                      implementation partners,
                                      developers, funders and pilot
                                      participants

  Approval status                     Not yet approved; validate with
                                      users, legal advisers and
                                      participating institutions
  -----------------------------------------------------------------------

## How to use this document

This PRD defines the proposed product scope and acceptance expectations.
It is not a claim that integrations, partnerships, regulatory approvals,
customers or revenue already exist. Budget, adoption and revenue figures
are planning assumptions to validate through discovery and procurement.

# 1. Executive Summary

The Digital Blue Economy Marketplace is a mobile-first digital platform
intended to connect fishers, aquaculture farmers, seafood processors,
wholesalers, retailers, hospitality businesses, exporters, logistics
providers, cold-storage operators and relevant institutions. It aims to
reduce market fragmentation by enabling product listings, buyer
discovery, order management, verified business profiles,
payment-provider integration, delivery coordination and product-origin
records.

The platform will also provide authorized administrators with aggregated
operational insights---such as listings, orders, market prices, supply
patterns and participation---subject to privacy, consent and governance
rules. It will launch as a focused pilot in selected coastal markets,
prove repeat transactions and operational feasibility, and expand only
after measurable adoption and service reliability.

The product should complement, not duplicate, existing public systems
and sector databases. Any data exchange or government integration must
be agreed, legally reviewed and technically validated before
implementation.

# 2. Problem Statement

Nigeria's blue economy offers opportunities for economic
diversification, employment, food security and coastal livelihoods.
However, many participants in fisheries and related value chains face
difficulty discovering buyers, comparing prices, confirming supply,
coordinating transport and cold storage, and establishing trust with
unfamiliar trading partners. Small-scale suppliers may depend on
informal networks and have limited visibility beyond their immediate
markets. Buyers may struggle to source consistent volumes from verified
suppliers, while fragmented logistics and limited traceability can
contribute to waste, disputes and low confidence.

The proposed marketplace addresses these issues by providing a common
digital channel for discovery, transactions and coordination. It will
not solve physical infrastructure gaps on its own; instead, it will make
existing services easier to find, book and coordinate, while generating
evidence to inform future investment.

# 3. Vision, Goals and Non-Goals

## 3.1 Product vision

Make it easier and more trustworthy for Nigeria's marine and coastal
value-chain participants to trade, move products and access market
information.

## 3.2 Goals

-   Increase market access for small-scale fishers, fish farmers and
    seafood businesses.

-   Enable buyers to discover suppliers, compare offers and place
    trackable orders.

-   Improve coordination of delivery, cold storage and related services.

-   Increase transaction transparency through clear pricing, order
    records and dispute workflows.

-   Support product-origin and compliance information where appropriate
    and verifiable.

-   Provide authorized stakeholders with aggregated insights for
    programme monitoring and planning.

-   Develop a commercially and operationally sustainable model without
    excluding smaller participants.

## 3.3 Non-goals for the initial release

-   Owning or operating fishing fleets, ports, cold rooms or transport
    vehicles.

-   Guaranteeing the quality, legality or sustainability of every
    product solely from a user-uploaded listing.

-   Acting as a bank, wallet issuer, insurer or unlicensed payment
    processor.

-   Replacing government licensing, customs, export certification or
    food-safety systems.

-   Building satellite vessel surveillance or a full fisheries
    enforcement system in the MVP.

-   Launching across every Nigerian state or international market before
    pilot validation.

# 4. Target Users and Personas

  -----------------------------------------------------------------------
  **Persona**             **Needs / pain points** **Core platform value**
  ----------------------- ----------------------- -----------------------
  Small-scale fisher or   Find buyers; publish    Simple listing,
  cooperative             catch availability;     assisted onboarding,
                          receive fair and timely order notifications and
                          payment; use            buyer access
                          low-bandwidth tools     

  Aquaculture farmer      Plan harvest sales;     Scheduled availability,
                          reach restaurants and   repeat orders and buyer
                          bulk buyers;            relationships
                          communicate volumes and 
                          delivery dates          

  Processor / seafood     Source products; manage Supplier catalogue,
  supplier                inventory and bulk      order management and
                          orders; build           business profile
                          reputation              

  Restaurant / hotel /    Find reliable           Search, filters, repeat
  retailer                suppliers, compare      ordering and order
                          price and quality       status
                          details, order          
                          predictable volumes     

  Wholesaler / exporter   Find supply at scale;   Bulk enquiry, supplier
                          document origin;        verification and
                          coordinate delivery and traceability records
                          paperwork               

  Logistics / cold-chain  Acquire customers and   Service listing, quote
  provider                manage service requests requests and booking
                                                  workflow

  Marketplace operations  Verify accounts,        Admin console, audit
  team                    moderate listings,      trail, queues and
                          resolve disputes and    reports
                          monitor service quality 

  Agency / programme      Understand              Role-based aggregate
  administrator           participation and       dashboards and
                          market activity without exportable reports
                          unnecessary personal    
                          data                    
  -----------------------------------------------------------------------

# 5. Product Scope and Release Strategy

  -----------------------------------------------------------------------
  **Release**             **Scope**               **Exit criteria**
  ----------------------- ----------------------- -----------------------
  MVP / Pilot             Registration,           Pilot users complete
                          role-based profiles,    real transactions;
                          supplier listings,      support and dispute
                          search, buyer           processes work;
                          enquiries/orders, order security and privacy
                          status, admin           review passed
                          verification, basic     
                          notifications, manual   
                          or provider-supported   
                          delivery coordination,  
                          reporting               

  Release 1.1             Payment-provider        Payment reconciliation
                          integration, structured and operational metrics
                          delivery booking,       meet agreed thresholds
                          reviews after completed 
                          orders, price trend     
                          views, CSV reports      

  Release 2               Traceability QR codes,  Evidence of demand,
                          multilingual expansion, validated data
                          cooperative tools,      governance and
                          advanced analytics,     integration agreements
                          APIs to approved        
                          partners                

  Future options          Cross-border trade      Separate business case,
                          features, export        legal review and user
                          workflow integrations,  validation
                          financing referrals,    
                          IoT cold-chain data,    
                          additional blue economy 
                          categories              
  -----------------------------------------------------------------------

# 6. Functional Requirements

## 6.1 Registration, identity and profiles

-   Users can register with phone number and/or email, verify contact
    details and recover access securely.

-   Users select one or more roles: supplier, buyer,
    logistics/cold-chain provider or administrator (admin roles granted
    only by authorized staff).

-   Business profiles include trading name, contact channels, operating
    location, categories, service area and optional business
    registration/licence details where relevant.

-   Verification status must be explicit: Unverified, Pending Review,
    Verified, Suspended or Rejected. Verification must not imply
    government endorsement unless formally authorized.

-   Support staff can assist low-digital-literacy users with consent and
    an auditable record of changes.

-   Users can manage consent, communication preferences and profile
    visibility.

## 6.2 Supplier listings and inventory

-   Suppliers can create, edit, pause and archive listings.

-   Required fields: product name/category, description, available
    quantity and unit, asking price or quote-required status, location,
    availability date and seller contact/order method.

-   Optional fields: photos, size/grade, fresh/frozen/processed state,
    packaging, harvest/landing date, delivery options, handling details
    and supporting certificates.

-   System validates required fields, file types and reasonable limits;
    listing changes are timestamped.

-   Listings can expire or be marked unavailable to reduce stale
    inventory.

-   Admin moderators can hide listings, record reasons and provide an
    appeal/contact path.

## 6.3 Discovery and search

-   Users can search by product, supplier, category and location.

-   Filters include product state, price range where available,
    quantity, availability, supplier verification and delivery option.

-   Results show listing freshness, seller verification status, location
    at an appropriate level and price/unit where supplied.

-   Sort options include relevance, newest, price and proximity when
    location permission is granted.

-   The platform must clearly distinguish a fixed price from a price
    requiring quotation.

## 6.4 Enquiries, orders and fulfilment

-   Buyers can send an enquiry or create an order request from a
    listing.

-   Order records capture buyer, seller, line items, quantity, agreed
    price, fees, delivery terms, expected dates and status history.

-   Order states: Draft, Requested, Accepted, Rejected, Awaiting
    Payment, Paid/Payment Confirmed, Preparing, Dispatched, Delivered,
    Completed, Cancelled, Disputed and Refunded (where supported).

-   Both parties receive status updates and can view a timestamped order
    timeline.

-   Seller acceptance confirms availability and agreed terms; the
    platform must not imply stock reservation until configured rules
    support it.

-   Order amendments require explicit acceptance by affected parties and
    are recorded in the audit trail.

-   Bulk buyers can request quotations for larger or recurring orders.

## 6.5 Payments, fees and reconciliation

-   Use a licensed payment service provider; the marketplace does not
    store raw card credentials or act as an unlicensed custodian of
    funds.

-   Display item subtotal, delivery fee, marketplace fee, applicable
    taxes and final amount before payment.

-   Use provider webhooks or verified server-side status checks; never
    trust a browser redirect alone as proof of payment.

-   Support payment reference, transaction status, refund workflow and
    reconciliation reports.

-   Define whether the provider settles sellers directly or supports an
    approved marketplace split-settlement model.

-   No escrow, wallet, credit or lending functionality in MVP unless
    separately approved by legal/compliance and supported by an
    appropriately authorized provider.

## 6.6 Logistics and cold-chain coordination

-   Providers can list service types, operating areas, capacity, contact
    details and quote/booking availability.

-   Buyers or sellers can request delivery, cold storage, ice or other
    supported services.

-   The MVP may use request-and-confirm booking rather than real-time
    fleet dispatch.

-   Delivery terms, responsibility, fees and expected dates must be
    visible before order confirmation.

-   Delivery status and proof of delivery can be recorded; location
    tracking is optional and requires appropriate consent.

## 6.7 Ratings, trust and disputes

-   Only participants in completed orders may submit transaction-linked
    ratings, subject to moderation rules.

-   Users can report fraud, unsafe listings, impersonation, non-delivery
    or misrepresentation.

-   Admin staff can classify cases, request evidence, record decisions
    and communicate outcomes.

-   Dispute workflow must define service-level targets, escalation and
    when payment-provider processes take precedence.

-   Ratings must not be represented as proof of regulatory compliance or
    product safety.

## 6.8 Traceability and responsible sourcing

-   MVP records optional origin and handling fields supplied by the
    seller, with source and verification status clearly labelled.

-   Later releases may generate a QR code linking to a product batch
    page with only approved public fields.

-   Store relevant licence/certificate metadata and expiry dates where
    the business case and law require it; do not imply a document is
    authentic unless verified.

-   Do not claim that a product is sustainably sourced, export-ready or
    certified without supporting evidence and an approved verification
    process.

## 6.9 Notifications and communications

-   Send in-app and email/SMS notifications for account verification,
    enquiries, order status, payment confirmation, delivery updates and
    dispute outcomes.

-   Use an approved messaging provider and obtain consent where
    required.

-   Notifications must avoid exposing sensitive order or personal
    information on lock screens where possible.

-   Provide notification preferences and operational fallback if an
    external provider is unavailable.

## 6.10 Administration and analytics

-   Admin console supports user/listing review, status changes,
    complaint handling, category management and audit history.

-   Dashboard metrics include registered and active users, verified
    suppliers, listings, enquiries, order conversion, completed order
    value, cancellations, disputes, repeat buyers and regional
    participation.

-   Financial reports distinguish gross merchandise value (GMV),
    marketplace revenue, payment-provider fees, refunds and net
    settlement; GMV is not revenue.

-   Reports can be filtered by date, category, geography and role, with
    role-based export permissions.

-   Public-sector dashboards should default to aggregated information
    and apply minimum-group thresholds where data could identify
    individuals or small businesses.

# 7. Key User Journeys

## 7.1 Supplier onboarding and listing

1.  Supplier opens the site, selects Supplier and creates an account.

2.  Supplier verifies phone/email and completes a basic profile.

3.  Supplier submits required verification information if applicable.

4.  Admin reviews the profile and records a decision; the supplier sees
    the status and any missing information.

5.  Supplier creates a listing, previews it and publishes it.

6.  Buyer enquiries arrive; supplier accepts, negotiates or declines
    with a reason.

7.  After fulfilment, both parties can confirm completion and provide
    feedback.

## 7.2 Buyer order journey

8.  Buyer searches and filters listings.

9.  Buyer reviews seller status, availability, price/unit and delivery
    terms.

10. Buyer requests a quote or places an order.

11. Seller confirms quantity, price and fulfilment timing.

12. Buyer reviews total costs and pays through the configured provider,
    or follows an approved offline-payment flow during pilot.

13. Order status is updated through preparation, dispatch and delivery.

14. Buyer confirms receipt or opens a dispute; transaction is then
    completed and eligible for rating.

## 7.3 Admin moderation journey

15. Admin opens a queue of pending users, flagged listings or disputes.

16. Admin reviews submitted information and supporting evidence.

17. Admin approves, requests changes, rejects or suspends with a
    recorded reason.

18. The affected user receives a clear notification and next-step
    instructions.

19. Every privileged action is recorded in the audit log.

# 8. Non-Functional Requirements

  -----------------------------------------------------------------------
  **Area**                            **Requirement / target for pilot**
  ----------------------------------- -----------------------------------
  Availability                        Target 99.5% monthly availability
                                      excluding planned maintenance,
                                      subject to hosting design and
                                      budget.

  Performance                         Target 95th percentile under 3
                                      seconds for key read pages under
                                      agreed pilot load; define test
                                      conditions before acceptance.

  Mobile and low bandwidth            Responsive mobile-first UI,
                                      compressed images, pagination,
                                      clear loading/error states and
                                      graceful handling of weak
                                      connections.

  Accessibility                       Aim for WCAG 2.2 AA for core flows;
                                      keyboard navigation, labels,
                                      contrast and screen-reader
                                      semantics.

  Scalability                         Support pilot usage and horizontal
                                      growth without redesigning core
                                      domain data; set concrete load
                                      targets during discovery.

  Reliability                         Backups, tested restore procedures,
                                      idempotent payment webhooks, retry
                                      policies and monitoring.

  Localization                        English initially; architecture
                                      should allow later Nigerian
                                      languages and region-specific
                                      content.

  Maintainability                     Documented APIs, automated tests,
                                      environment separation, CI/CD,
                                      error tracking and runbooks.

  Data portability                    Authorized export of business
                                      records and reports in common
                                      formats, subject to permissions and
                                      privacy controls.
  -----------------------------------------------------------------------

# 9. Technical Architecture (Proposed)

Use a modular web architecture that can be implemented by a qualified
delivery team. Final technology choices should follow procurement
constraints, team capability, hosting requirements and integration
feasibility.

-   Frontend: responsive web application / Progressive Web App (PWA)
    optimized for mobile.

-   Backend: secure API and business logic for identity, catalogue,
    orders, payments, logistics, moderation and reporting.

-   Database: relational database for users, listings, orders, status
    history, transactions and audit records.

-   Object storage: product images and permitted documents, with malware
    scanning and access controls.

-   Search: database search initially; dedicated search service only if
    usage and relevance needs justify it.

-   Integrations: licensed payment provider, SMS/email provider,
    maps/geocoding if needed, and approved partner APIs.

-   Analytics: role-restricted reporting layer with aggregation and data
    minimization.

-   Operations: separate development, staging and production
    environments; centralized logs, monitoring, backups and incident
    alerts.

## 9.1 Core data entities

  -----------------------------------------------------------------------
  **Entity**                          **Representative fields**
  ----------------------------------- -----------------------------------
  User                                ID, contact, role(s), status,
                                      consent, created/updated timestamps

  BusinessProfile                     business name, category, location,
                                      service area, verification status,
                                      documents metadata

  Listing                             seller ID, product/category,
                                      description, quantity/unit, price,
                                      availability, origin/handling
                                      fields, status

  Order                               buyer/seller IDs, line items,
                                      agreed price, fees, delivery terms,
                                      status, timestamps

  PaymentTransaction                  provider reference, amount,
                                      currency, status, fees, refund
                                      reference, reconciliation state

  ServiceListing / Booking            provider, service type, coverage,
                                      capacity, quote, booking status

  Dispute                             order ID, reason, evidence
                                      references, owner, status,
                                      resolution and timestamps

  Review                              order ID, author, rating, text,
                                      moderation status

  AuditEvent                          actor, action, entity, timestamp,
                                      outcome and relevant metadata
  -----------------------------------------------------------------------

## 9.2 Integration principles

-   Use documented APIs and signed webhooks; validate signatures and
    reject replayed or malformed events.

-   Store provider references and minimal required response metadata; do
    not retain unnecessary payment data.

-   Integrate with public-sector systems only after written
    authorization, technical discovery and data-sharing agreements.

-   Use stable internal IDs and mapping tables rather than assuming
    partner identifiers will remain unchanged.

-   Provide manual fallback procedures for pilot operations if a
    third-party integration fails.

# 10. Security, Privacy and Regulatory Considerations

Obtain Nigerian legal and compliance review before launch. Requirements
depend on the operating model, data collected, payment arrangement, user
location and whether the platform facilitates domestic or cross-border
trade.

-   Assess obligations under the Nigeria Data Protection Act 2023 and
    applicable Nigeria Data Protection Commission guidance; define
    controller/processor roles and lawful bases.

-   Publish clear privacy notice, terms of use, marketplace rules,
    refund/dispute policy and cookie/analytics disclosures as
    applicable.

-   Collect only necessary personal and business data; define retention,
    correction, deletion and access-request procedures.

-   Enforce role-based access control, least privilege, multi-factor
    authentication for administrators, secure password/session
    management and rate limiting.

-   Encrypt data in transit and at rest; manage secrets securely and
    rotate credentials.

-   Maintain audit logs for administrative access, verification
    decisions, payment events and dispute outcomes.

-   Use secure file upload controls, malware scanning, input validation,
    dependency scanning and periodic vulnerability testing.

-   Prepare incident response, breach assessment and notification
    procedures aligned with applicable law.

-   Review consumer protection, tax, payment services, food safety,
    fisheries, export, advertising and electronic transaction
    obligations with qualified advisers.

-   Provide a mechanism to report scams, counterfeit listings, unsafe
    products and impersonation.

# 11. Business Model and Revenue

The platform may combine transaction commissions, optional business
subscriptions, logistics booking fees and paid business promotion or
market insights. Keep basic access affordable for small-scale suppliers
and avoid charging users before the marketplace provides meaningful
value.

  -----------------------------------------------------------------------
  **Revenue stream**      **Proposed approach**   **Validation needed**
  ----------------------- ----------------------- -----------------------
  Transaction commission  Illustrative 3--8% of   Willingness to pay,
                          completed marketplace   competitive pricing,
                          orders, with exceptions tax and payment costs
                          or caps for selected    
                          categories              

  Business subscription   Optional paid tier for  Value proposition and
                          advanced tools,         affordability
                          multiple staff accounts 
                          or enhanced analytics   

  Logistics booking fee   Transparent fee or      Partner economics,
                          provider referral       service quality and
                          commission where lawful disclosure
                          and disclosed           

  Promoted listings /     Clearly labelled        Demand, privacy
  insights                promotions and          safeguards and
                          aggregated reports for  conflict-of-interest
                          business customers      rules
  -----------------------------------------------------------------------

## 11.1 Illustrative revenue scenario

A previously discussed Year 3 target of ₦150 million in annual revenue
is an ambition only, not a validated forecast. It should be tested
against realistic transaction volume, average order value, take rate,
repeat purchase, customer acquisition cost, operating costs, taxes and
payment fees.

  -----------------------------------------------------------------------
  **Year**                **Illustrative revenue  **Interpretation**
                          assumption**            
  ----------------------- ----------------------- -----------------------
  Year 1                  ₦25 million             Pilot and early
                                                  adoption assumption;
                                                  validate before
                                                  budgeting

  Year 2                  ₦50 million             Expansion assumption
                                                  contingent on repeat
                                                  transactions

  Year 3                  ₦150 million            Ambitious scale target;
                                                  requires evidence of
                                                  meaningful GMV and
                                                  monetization
  -----------------------------------------------------------------------

Financial modelling must separate gross merchandise value (total value
of goods traded) from marketplace revenue and from profit. Revenue
should not be reported as secured until transactions and accounting
treatment are verified.

# 12. Success Metrics and KPIs

  -----------------------------------------------------------------------
  **Metric**              **Definition**          **Pilot target /
                                                  approach**
  ----------------------- ----------------------- -----------------------
  Activated suppliers     Suppliers who publish   Set target after
                          at least one valid      recruitment baseline;
                          listing within 30 days  monitor by community
                          of onboarding           and category

  Active buyers           Buyers who place at     Track weekly/monthly
                          least one order/enquiry active buyers
                          in a defined period     

  Listing-to-order        Listings that lead to   Establish baseline;
  conversion              an order divided by     improve through
                          eligible listing views  discovery and listing
                          or enquiries, clearly   quality
                          defined                 

  Completed order rate    Orders completed        Agree target after
                          divided by accepted     baseline; investigate
                          orders                  cancellation reasons

  Repeat buyer rate       Buyers with more than   Track cohort retention
                          one completed order in  
                          a period                

  Time to source          Time from buyer         Measure baseline vs
                          search/enquiry to       pilot
                          accepted order          

  Dispute rate            Orders with a formal    Monitor trend and
                          dispute divided by      reason categories
                          orders placed           

  Supplier value          Supplier-reported or    Report carefully;
                          transaction-recorded    distinguish platform
                          sales through the       sales from total
                          platform                business income

  Cold-chain/logistics    Orders using a listed   Measure uptake and
  usage                   or booked logistics     delivery reliability
                          service                 

  Platform revenue        Recognized              Monthly reconciliation
                          fees/subscriptions,     against provider and
                          excluding GMV           accounting records

  Inclusion               Participation by        Use privacy-protective,
                          small-scale operators,  consent-based
                          women/youth-owned       measurement
                          businesses where        
                          voluntarily and         
                          lawfully collected      
  -----------------------------------------------------------------------

# 13. MVP Acceptance Criteria

-   A user can register, verify contact details, create a profile and
    recover account access.

-   An eligible supplier can create, edit, pause and publish a listing
    with required fields.

-   A buyer can search/filter listings, view seller status and submit an
    enquiry or order request.

-   A seller can accept/reject a request and both parties can see the
    current status and history.

-   Administrators can review users and listings, record reasons and
    audit privileged actions.

-   Notifications are sent for defined high-priority events, with
    failure handling.

-   Reports can show user counts, listings, order status, completed
    order value and platform revenue as separate measures.

-   Privacy notice, terms, moderation policy, support channel and
    dispute process are available before public launch.

-   Security testing, backup/restore test, payment test (if integrated)
    and user acceptance testing are signed off.

-   No critical or high-severity security issues remain unresolved at
    launch; exceptions require documented risk acceptance.

# 14. Delivery Roadmap

  ------------------------------------------------------------------------
  **Phase**         **Indicative      **Activities /     **Gate**
                    timing**          deliverables**     
  ----------------- ----------------- ------------------ -----------------
  Discovery         Weeks 1--4        Interviews,        Product owner and
                                      process mapping,   pilot
                                      pilot-market       stakeholders
                                      selection,         approve scope
                                      data/legal review, 
                                      service blueprint, 
                                      baseline and       
                                      prioritization     

  Design            Weeks 5--7        User flows,        Core flows
                                      wireframes,        validated by
                                      prototype,         representative
                                      usability tests,   users
                                      data model,        
                                      architecture and   
                                      threat model       

  Build MVP         Weeks 8--16       Account/profile,   Feature and code
                                      listings, search,  quality checks
                                      order workflow,    pass
                                      admin,             
                                      notifications and  
                                      basic reporting    

  Pilot readiness   Weeks 17--20      Security/privacy   Go/no-go decision
                                      review, content    
                                      setup, staff       
                                      training,          
                                      onboarding,        
                                      support runbook    
                                      and UAT            

  Pilot operation   Months 6--8       Real transactions, Pilot success
                    (indicative)      weekly feedback,   criteria reviewed
                                      metrics review,    
                                      bug fixes and      
                                      process refinement 

  Scale decision    After pilot       Business case      Sponsor approves
                                      update,            next release
                                      integration        
                                      priorities,        
                                      expansion budget   
                                      and governance     
  ------------------------------------------------------------------------

Timelines are indicative and depend on procurement, stakeholder
availability, integrations, hosting decisions and legal review.

# 15. Team and Governance

  -----------------------------------------------------------------------
  **Role**                            **Responsibilities**
  ----------------------------------- -----------------------------------
  Executive sponsor                   Funding, strategic alignment,
                                      escalation and go/no-go decisions

  Product owner                       Prioritization, scope, acceptance
                                      criteria, stakeholder alignment and
                                      KPI ownership

  Project manager / delivery lead     Plan, dependencies, risks, budget
                                      and delivery reporting

  UX/UI designer / researcher         Research, accessible design,
                                      usability testing and onboarding

  Engineering lead and developers     Architecture, implementation, code
                                      quality, integrations and
                                      documentation

  QA / security specialist            Test strategy, regression, security
                                      verification and release readiness

  Marketplace operations lead         Supplier onboarding, moderation,
                                      customer support and disputes

  Legal/privacy adviser               Terms, data protection, payment
                                      model, sector rules and agreements

  Pilot partners                      Recruitment, feedback, logistics
                                      and operational validation
  -----------------------------------------------------------------------

# 16. Key Risks and Mitigations

  -----------------------------------------------------------------------
  **Risk**                **Impact**              **Mitigation**
  ----------------------- ----------------------- -----------------------
  Low supplier/buyer      Marketplace feels       Launch in a tightly
  density                 empty; low conversion   scoped
                                                  geography/category;
                                                  recruit both sides
                                                  before public launch

  Low digital literacy /  Exclusion and abandoned Mobile-first design,
  weak connectivity       journeys                low-bandwidth
                                                  performance, assisted
                                                  onboarding and simple
                                                  workflows

  Fraud, impersonation or Loss of trust and       Verification tiers,
  low-quality listings    financial harm          reporting, moderation,
                                                  transaction-linked
                                                  reviews and clear
                                                  dispute process

  Inconsistent supply and Failed orders           Listing expiry,
  stale listings                                  availability
                                                  confirmation and seller
                                                  response metrics

  Logistics/cold-chain    Spoilage and delivery   Partner directory,
  gaps                    failure                 transparent service
                                                  terms and manual
                                                  fallback coordination

  Payment disputes or     Financial loss and      Licensed provider,
  integration failures    support burden          verified webhooks,
                                                  reconciliation,
                                                  documented refunds and
                                                  no unapproved custody
                                                  of funds

  Regulatory or           Launch delays or        Early legal review,
  data-sharing            compliance exposure     data minimization and
  uncertainty                                     written agreements

  Overambitious revenue   Funding and operating   Scenario-based
  assumptions             shortfall               financial model, staged
                                                  investment and monthly
                                                  unit-economics review

  Duplicate government    Wasted spend and poor   Inventory existing
  systems                 interoperability        systems and obtain
                                                  integration approval
                                                  before build

  Cyberattack or data     Service disruption and  Secure SDLC, access
  breach                  privacy harm            controls, monitoring,
                                                  backups and incident
                                                  response
  -----------------------------------------------------------------------

# 17. Assumptions, Dependencies and Open Questions

## 17.1 Current assumptions

-   The initial product is a mobile-first web platform, not a native
    mobile app.

-   The pilot will begin in one or a small number of coastal market
    clusters, selected through discovery.

-   The marketplace facilitates discovery and transactions but does not
    own inventory.

-   Third-party payment and messaging providers will be used where
    appropriate.

-   Supplier and buyer recruitment will be coordinated with local
    associations, cooperatives and commercial partners.

-   A target of 10,000 customers within three years and a Year 3 revenue
    target of ₦150 million are hypotheses requiring validation.

## 17.2 Open questions to resolve before build

-   Which agency or organization is the product owner and legal
    operator?

-   Which pilot geography and initial product categories provide enough
    supply and demand?

-   Will users transact and pay inside the platform, or will the first
    pilot focus on enquiries and order coordination?

-   What verification evidence is required for each user category, and
    who is authorized to verify it?

-   Who handles customer support, product complaints, refunds and
    disputes?

-   What is the approved commission/subscription structure and who bears
    payment fees?

-   Which existing sector registries or government systems can be
    legally and technically integrated?

-   What is the confirmed budget, procurement approach, hosting
    requirement and data-residency position?

-   What measurable pilot thresholds must be met before expansion?

# 18. Recommended Immediate Next Steps

20. Appoint a product owner and executive sponsor.

21. Run 15--25 structured interviews across fishers, aquaculture
    businesses, processors, buyers and logistics providers.

22. Choose one pilot cluster using supply density, buyer demand,
    connectivity, partner readiness and logistics availability.

23. Map current trading and payment practices, including
    cash/off-platform transactions and common dispute causes.

24. Validate legal, privacy, payment and sector-regulatory obligations.

25. Create clickable wireframes and test them with representative users
    before committing to the full build.

26. Prepare a budget and financial model with conservative, base and
    ambitious adoption scenarios.

27. Define pilot baseline, metrics, support procedures and go/no-go
    criteria.

# Appendix A --- Glossary

  -----------------------------------------------------------------------
  **Term**                            **Meaning**
  ----------------------------------- -----------------------------------
  Blue economy                        Sustainable use of ocean, marine
                                      and coastal resources for economic
                                      activity, livelihoods and ecosystem
                                      health.

  GMV                                 Gross merchandise value: total
                                      value of orders transacted through
                                      the marketplace; not the same as
                                      revenue.

  MVP                                 Minimum viable product: the
                                      smallest usable release that can
                                      test key product assumptions.

  PWA                                 Progressive Web App: a web
                                      application designed to work well
                                      on mobile and may support
                                      install-like behaviour.

  Traceability                        Records that help identify product
                                      origin, handling and movement;
                                      accuracy depends on evidence and
                                      verification.

  Take rate                           Marketplace revenue as a percentage
                                      of the transaction value to which
                                      the fee applies.
  -----------------------------------------------------------------------

# Appendix B --- Suggested MVP Navigation

-   Home / Discover

-   Search and category pages

-   Listing detail

-   Sign up / Sign in / Account recovery

-   Supplier dashboard

-   Create/edit listing

-   Buyer enquiries and orders

-   Order detail and status timeline

-   Service directory (logistics / cold storage)

-   Notifications and messages

-   Business profile and verification status

-   Help, reporting and dispute intake

-   Admin dashboard, moderation queues and reports
