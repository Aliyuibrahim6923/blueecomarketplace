/** Reference values shared by forms, filters and validation. Must match the SQL enums/checks. */

export const NIGERIAN_STATES = [
  { code: "AB", name: "Abia" }, { code: "AD", name: "Adamawa" }, { code: "AK", name: "Akwa Ibom" },
  { code: "AN", name: "Anambra" }, { code: "BA", name: "Bauchi" }, { code: "BY", name: "Bayelsa" },
  { code: "BE", name: "Benue" }, { code: "BO", name: "Borno" }, { code: "CR", name: "Cross River" },
  { code: "DE", name: "Delta" }, { code: "EB", name: "Ebonyi" }, { code: "ED", name: "Edo" },
  { code: "EK", name: "Ekiti" }, { code: "EN", name: "Enugu" }, { code: "FC", name: "Federal Capital Territory" },
  { code: "GO", name: "Gombe" }, { code: "IM", name: "Imo" }, { code: "JI", name: "Jigawa" },
  { code: "KD", name: "Kaduna" }, { code: "KN", name: "Kano" }, { code: "KT", name: "Katsina" },
  { code: "KE", name: "Kebbi" }, { code: "KO", name: "Kogi" }, { code: "KW", name: "Kwara" },
  { code: "LA", name: "Lagos" }, { code: "NA", name: "Nasarawa" }, { code: "NI", name: "Niger" },
  { code: "OG", name: "Ogun" }, { code: "ON", name: "Ondo" }, { code: "OS", name: "Osun" },
  { code: "OY", name: "Oyo" }, { code: "PL", name: "Plateau" }, { code: "RI", name: "Rivers" },
  { code: "SO", name: "Sokoto" }, { code: "TA", name: "Taraba" }, { code: "YO", name: "Yobe" },
  { code: "ZA", name: "Zamfara" },
] as const;

export type StateCode = (typeof NIGERIAN_STATES)[number]["code"];
export const STATE_CODES = NIGERIAN_STATES.map((s) => s.code) as [StateCode, ...StateCode[]];
export const stateName = (code: string | null | undefined) =>
  NIGERIAN_STATES.find((s) => s.code === code)?.name ?? code ?? "";

export const UNITS = ["kg", "tonne", "crate", "carton", "basket", "piece", "dozen", "litre", "bag", "pack"] as const;
export type Unit = (typeof UNITS)[number];

export const PRODUCT_STATES = ["fresh", "frozen", "processed", "live", "dried", "smoked", "other"] as const;
export type ProductState = (typeof PRODUCT_STATES)[number];

export const DELIVERY_OPTIONS = [
  { value: "pickup", label: "Buyer pickup" },
  { value: "seller_delivery", label: "Seller delivers" },
  { value: "third_party_logistics", label: "Third-party logistics" },
] as const;
export type DeliveryOption = (typeof DELIVERY_OPTIONS)[number]["value"];
export const DELIVERY_VALUES = DELIVERY_OPTIONS.map((d) => d.value) as [DeliveryOption, ...DeliveryOption[]];
export const deliveryLabel = (v: string) => DELIVERY_OPTIONS.find((d) => d.value === v)?.label ?? v;

export const BUSINESS_CATEGORIES = [
  { value: "fisher_cooperative", label: "Fisher cooperative" },
  { value: "artisanal_fisher", label: "Artisanal fisher" },
  { value: "aquaculture_farm", label: "Aquaculture farm" },
  { value: "processor", label: "Processor" },
  { value: "wholesaler", label: "Wholesaler" },
  { value: "retailer", label: "Retailer" },
  { value: "hospitality", label: "Restaurant / hotel" },
  { value: "exporter", label: "Exporter" },
  { value: "logistics", label: "Logistics provider" },
  { value: "cold_storage", label: "Cold-storage operator" },
  { value: "other", label: "Other" },
] as const;

export const LOGISTICS_SERVICE_TYPES = [
  { value: "delivery", label: "Delivery" },
  { value: "refrigerated_transport", label: "Refrigerated transport" },
  { value: "cold_storage", label: "Cold storage" },
  { value: "ice_supply", label: "Ice supply" },
  { value: "other", label: "Other" },
] as const;
export type LogisticsServiceType = (typeof LOGISTICS_SERVICE_TYPES)[number]["value"];

export const VERIFICATION_DOCUMENT_TYPES = [
  { value: "cac_certificate", label: "CAC registration certificate" },
  { value: "fisheries_licence", label: "Fisheries licence" },
  { value: "cooperative_registration", label: "Cooperative registration" },
  { value: "food_safety_certificate", label: "Food-safety certificate" },
  { value: "export_licence", label: "Export licence" },
  { value: "government_id", label: "Government-issued ID of owner" },
  { value: "other", label: "Other supporting document" },
] as const;

export const DISPUTE_CATEGORIES = [
  { value: "non_delivery", label: "Not delivered" },
  { value: "quality", label: "Quality problem" },
  { value: "quantity", label: "Wrong quantity" },
  { value: "misrepresentation", label: "Not as described" },
  { value: "payment", label: "Payment problem" },
  { value: "cancellation_request", label: "Request to cancel (paid, not dispatched)" },
  { value: "other", label: "Other" },
] as const;

export const REPORT_REASONS = [
  { value: "fraud", label: "Fraud or scam" },
  { value: "unsafe_product", label: "Unsafe product" },
  { value: "impersonation", label: "Impersonation" },
  { value: "misrepresentation", label: "Misleading listing" },
  { value: "counterfeit", label: "Counterfeit / fake documents" },
  { value: "non_delivery", label: "Non-delivery" },
  { value: "other", label: "Other" },
] as const;

export const SUPPORT_TOPICS = [
  { value: "account", label: "My account" },
  { value: "listing", label: "A listing" },
  { value: "order", label: "An order" },
  { value: "payment", label: "Payments" },
  { value: "logistics", label: "Logistics / cold chain" },
  { value: "safety", label: "Safety or fraud" },
  { value: "data_protection", label: "My personal data" },
  { value: "other", label: "Something else" },
] as const;

export const SELF_SERVICE_ROLES = [
  { value: "buyer", label: "Buy seafood and marine products", description: "Search listings, request quotes and place orders." },
  { value: "supplier", label: "Sell products", description: "Fishers, farmers, processors and wholesalers." },
  { value: "logistics_provider", label: "Offer logistics or cold chain", description: "Delivery, refrigerated transport, cold storage, ice." },
] as const;
export type SelfServiceRole = (typeof SELF_SERVICE_ROLES)[number]["value"];

export const PAGE_SIZE = 24;
