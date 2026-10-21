/**
 * Row shapes for the tables the app reads. Hand-maintained to match
 * supabase/migrations. (Regenerate with `supabase gen types typescript` once a
 * project is linked, and replace these if preferred.)
 */
import type { OrderStatus } from "@/lib/orders/state-machine";

export type AppRole = "buyer" | "supplier" | "logistics_provider" | "admin" | "agency_analyst";
export type AccountStatus = "active" | "suspended" | "deactivated";
export type VerificationStatus = "unverified" | "pending_review" | "verified" | "suspended" | "rejected";
export type ListingStatus = "draft" | "published" | "paused" | "archived" | "hidden";
export type MembershipRole = "owner" | "manager" | "staff";
export type PricingType = "fixed" | "quote_required";
export type BookingStatus = "requested" | "quoted" | "confirmed" | "declined" | "in_progress" | "completed" | "cancelled";
export type DisputeStatus = "open" | "under_review" | "awaiting_evidence" | "resolved" | "rejected";
export type PaymentProviderId = "sandbox" | "offline" | "paystack";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string;
  phone: string | null;
  account_status: AccountStatus;
  suspended_reason: string | null;
  onboarding_completed: boolean;
  email_notifications: boolean;
  sms_notifications: boolean;
  marketing_consent: boolean;
  terms_accepted_at: string | null;
  deletion_requested_at: string | null;
  created_at: string;
};

export type BusinessSummary = {
  id: string;
  name: string;
  slug: string;
  is_supplier: boolean;
  is_logistics_provider: boolean;
  is_buyer_organisation: boolean;
  verification_status: VerificationStatus;
  status: AccountStatus;
  state_code: string;
  deleted_at: string | null;
  membership_role: MembershipRole;
};

export type Business = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  business_category: string;
  is_supplier: boolean;
  is_logistics_provider: boolean;
  is_buyer_organisation: boolean;
  state_code: string;
  city: string | null;
  service_states: string[];
  contact_public: boolean;
  verification_status: VerificationStatus;
  verification_note: string | null;
  verified_at: string | null;
  status: AccountStatus;
  suspended_reason: string | null;
  created_at: string;
};

export type Category = { id: string; slug: string; name: string; description: string | null; sort_order: number; is_active: boolean };

export type Product = {
  id: string;
  business_id: string;
  category_id: string;
  name: string;
  description: string;
  product_state: string;
  pricing_type: PricingType;
  price_minor: number | null;
  currency: string;
  unit: string;
  available_quantity: number;
  min_order_quantity: number;
  size_grade: string | null;
  packaging: string | null;
  location_state: string;
  location_city: string | null;
  available_from: string;
  harvest_date: string | null;
  handling_info: string | null;
  delivery_options: string[];
  certification_info: string | null;
  status: ListingStatus;
  moderation_note: string | null;
  published_at: string | null;
  expires_at: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
};

export type SearchResult = {
  id: string;
  name: string;
  description: string;
  product_state: string;
  pricing_type: PricingType;
  price_minor: number | null;
  currency: string;
  unit: string;
  available_quantity: number;
  min_order_quantity: number;
  location_state: string;
  location_city: string | null;
  available_from: string;
  delivery_options: string[];
  published_at: string;
  expires_at: string | null;
  category_slug: string;
  category_name: string;
  business_id: string;
  business_name: string;
  business_slug: string;
  business_verification: VerificationStatus;
  cover_image_path: string | null;
  total_count: number;
};

export type Order = {
  id: string;
  order_number: string;
  buyer_id: string;
  buyer_business_id: string | null;
  seller_business_id: string;
  quotation_id: string | null;
  status: OrderStatus;
  currency: string;
  subtotal_minor: number;
  delivery_fee_minor: number;
  marketplace_fee_minor: number;
  tax_minor: number;
  total_minor: number;
  marketplace_fee_bps: number;
  tax_bps: number;
  delivery_method: string;
  delivery_address: string | null;
  delivery_state: string | null;
  delivery_terms: string | null;
  expected_delivery_date: string | null;
  buyer_note: string | null;
  seller_note: string | null;
  rejection_reason: string | null;
  cancellation_reason: string | null;
  payment_provider: PaymentProviderId | null;
  created_at: string;
  placed_at: string | null;
  completed_at: string | null;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  unit: string;
  unit_price_minor: number;
  quantity: number;
  line_total_minor: number;
};

export type OrderHistory = {
  id: number;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  actor_kind: string;
  note: string | null;
  created_at: string;
};

export type PaymentTransaction = {
  id: string;
  provider: PaymentProviderId;
  reference: string;
  amount_minor: number;
  currency: string;
  status: string;
  reconciliation_status: string;
  note: string | null;
  created_at: string;
};

export type Enquiry = {
  id: string;
  buyer_id: string;
  supplier_business_id: string;
  product_id: string | null;
  kind: "general" | "quote_request";
  subject: string;
  message: string;
  requested_quantity: number | null;
  requested_delivery_date: string | null;
  delivery_state: string | null;
  status: "open" | "responded" | "closed";
  created_at: string;
  updated_at: string;
};

export type Quotation = {
  id: string;
  enquiry_id: string;
  supplier_business_id: string;
  buyer_id: string;
  item_description: string;
  unit: string;
  unit_price_minor: number;
  quantity: number;
  delivery_fee_minor: number;
  currency: string;
  delivery_terms: string | null;
  valid_until: string;
  status: "sent" | "accepted" | "declined" | "expired" | "withdrawn";
  order_id: string | null;
  created_at: string;
};

export type LogisticsService = {
  id: string;
  business_id: string;
  service_type: string;
  title: string;
  description: string;
  coverage_states: string[];
  capacity_description: string | null;
  temperature_range: string | null;
  base_price_minor: number | null;
  currency: string;
  pricing_unit: string | null;
  pricing_notes: string | null;
  status: ListingStatus;
  moderation_note: string | null;
  created_at: string;
};

export type LogisticsBooking = {
  id: string;
  service_id: string;
  provider_business_id: string;
  requester_id: string;
  order_id: string | null;
  pickup_location: string;
  dropoff_location: string;
  requested_date: string;
  cargo_description: string;
  quantity_description: string | null;
  special_requirements: string | null;
  status: BookingStatus;
  quoted_price_minor: number | null;
  currency: string;
  provider_note: string | null;
  delivery_terms: string | null;
  expected_date: string | null;
  proof_of_delivery_note: string | null;
  proof_recorded_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type Dispute = {
  id: string;
  order_id: string;
  opened_by: string;
  category: string;
  description: string;
  status: DisputeStatus;
  previous_order_status: OrderStatus;
  assigned_admin_id: string | null;
  outcome: string | null;
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};
