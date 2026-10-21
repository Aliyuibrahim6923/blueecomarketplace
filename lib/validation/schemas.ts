import { z } from "zod";
import {
  BUSINESS_CATEGORIES,
  DELIVERY_VALUES,
  DISPUTE_CATEGORIES,
  LOGISTICS_SERVICE_TYPES,
  PRODUCT_STATES,
  REPORT_REASONS,
  SUPPORT_TOPICS,
  UNITS,
  VERIFICATION_DOCUMENT_TYPES,
} from "@/lib/constants";
import {
  checkbox,
  isoDate,
  nairaAmount,
  optionalIsoDate,
  optionalNairaAmount,
  optionalTrimmed,
  phone,
  quantity,
  stateCode,
  trimmed,
  uuid,
} from "./common";

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));

const values = <T extends readonly { value: string }[]>(items: T) =>
  items.map((i) => i.value) as unknown as [T[number]["value"], ...T[number]["value"][]];

// ---------------------------------------------------------------- auth
export const signInSchema = z.object({
  email: email,
  password: z.string().min(1, "Enter your password"),
  next: z.string().optional(),
});

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(72, "Use at most 72 characters")
  .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), "Use letters and numbers");

export const signUpSchema = z.object({
  fullName: trimmed(2, 120, "Full name"),
  email: email,
  password: passwordSchema,
  intendedRole: z.enum(["buyer", "supplier", "logistics_provider"]).default("buyer"),
  acceptTerms: checkbox.refine((v) => v, "You must accept the terms and privacy notice"),
});

export const forgotPasswordSchema = z.object({
  email: email,
});

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });

// ---------------------------------------------------------------- onboarding & account
export const onboardingSchema = z.object({
  fullName: trimmed(2, 120, "Full name"),
  phone,
  roles: z.array(z.enum(["buyer", "supplier", "logistics_provider"])).min(1, "Choose at least one"),
  acceptTerms: checkbox.refine((v) => v, "You must accept the terms and privacy notice"),
  marketingConsent: checkbox,
});

export const profileSchema = z.object({
  fullName: trimmed(2, 120, "Full name"),
  phone,
  emailNotifications: checkbox,
  smsNotifications: checkbox,
  marketingConsent: checkbox,
});

// ---------------------------------------------------------------- business
export const businessSchema = z
  .object({
    name: trimmed(2, 120, "Business name"),
    description: optionalTrimmed(2000, "Description"),
    businessCategory: z.enum(values(BUSINESS_CATEGORIES)),
    isSupplier: checkbox,
    isLogisticsProvider: checkbox,
    isBuyerOrganisation: checkbox,
    stateCode,
    city: optionalTrimmed(80, "Town / city"),
    serviceStates: z.array(stateCode).max(37).default([]),
    contactPublic: checkbox,
    contactPhone: phone,
    contactEmail: z
      .union([z.email("Enter a valid email address"), z.literal("")])
      .optional()
      .transform((v) => (v ? v : undefined)),
    whatsapp: phone,
    streetAddress: optionalTrimmed(300, "Address"),
    registrationNumber: optionalTrimmed(40, "Registration number"),
  })
  .refine((v) => v.isSupplier || v.isLogisticsProvider || v.isBuyerOrganisation, {
    message: "Choose at least one business type",
    path: ["isSupplier"],
  });

export const verificationRequestSchema = z.object({
  businessId: uuid,
  documentType: z.enum(values(VERIFICATION_DOCUMENT_TYPES)),
  documentPath: z.string().max(300).optional(),
  documentExpiry: optionalIsoDate,
  applicantNote: optionalTrimmed(2000, "Note"),
});

export const memberSchema = z.object({
  businessId: uuid,
  email: email,
  role: z.enum(["manager", "staff"]),
});

// ---------------------------------------------------------------- listings
export const listingSchema = z
  .object({
    businessId: uuid,
    categoryId: uuid,
    name: trimmed(3, 120, "Product name"),
    description: trimmed(10, 4000, "Description"),
    productState: z.enum(PRODUCT_STATES),
    pricingType: z.enum(["fixed", "quote_required"]),
    price: z.string().optional(),
    unit: z.enum(UNITS),
    availableQuantity: z
      .string()
      .trim()
      .regex(/^\d{1,10}(\.\d{1,3})?$/, "Available quantity must be a number with at most 3 decimals"),
    minOrderQuantity: quantity("Minimum order"),
    sizeGrade: optionalTrimmed(80, "Size / grade"),
    packaging: optionalTrimmed(120, "Packaging"),
    locationState: stateCode,
    locationCity: optionalTrimmed(80, "Town / landing site"),
    availableFrom: isoDate,
    harvestDate: optionalIsoDate,
    handlingInfo: optionalTrimmed(1000, "Handling information"),
    deliveryOptions: z.array(z.enum(DELIVERY_VALUES)).min(1, "Choose at least one delivery option"),
    certificationInfo: optionalTrimmed(1000, "Certification details"),
    intent: z.enum(["draft", "publish"]).default("draft"),
  })
  .superRefine((v, ctx) => {
    if (v.pricingType === "fixed") {
      const parsed = nairaAmount("Price").safeParse(v.price ?? "");
      if (!parsed.success) ctx.addIssue({ code: "custom", path: ["price"], message: parsed.error.issues[0]?.message ?? "Invalid price" });
    }
    if (v.harvestDate && v.harvestDate > new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)) {
      ctx.addIssue({ code: "custom", path: ["harvestDate"], message: "Harvest / landing date cannot be in the future" });
    }
  })
  .transform((v) => ({
    ...v,
    priceMinor: v.pricingType === "fixed" ? (nairaAmount("Price").parse(v.price ?? "") as number) : null,
  }));

export type ListingInput = z.input<typeof listingSchema>;

// ---------------------------------------------------------------- enquiries & quotations
export const enquirySchema = z.object({
  supplierBusinessId: uuid,
  productId: uuid.optional().or(z.literal("").transform(() => undefined)),
  kind: z.enum(["general", "quote_request"]).default("general"),
  subject: trimmed(3, 150, "Subject"),
  message: trimmed(1, 4000, "Message"),
  requestedQuantity: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || (/^\d{1,10}(\.\d{1,3})?$/.test(v) && Number(v) > 0), "Enter a valid quantity"),
  requestedDeliveryDate: optionalIsoDate,
  deliveryState: stateCode.optional().or(z.literal("").transform(() => undefined)),
});

export const messageSchema = z.object({
  enquiryId: uuid,
  body: trimmed(1, 4000, "Message"),
});

export const quotationSchema = z.object({
  enquiryId: uuid,
  itemDescription: trimmed(3, 200, "Item description"),
  unit: z.enum(UNITS),
  unitPrice: nairaAmount("Unit price"),
  quantity: quantity("Quantity"),
  deliveryFee: nairaAmount("Delivery fee", { allowZero: true }),
  validUntil: isoDate,
  deliveryTerms: optionalTrimmed(1000, "Delivery terms"),
});

// ---------------------------------------------------------------- orders
const deliveryFields = {
  deliveryMethod: z.enum(DELIVERY_VALUES),
  deliveryAddress: optionalTrimmed(500, "Delivery address"),
  deliveryState: stateCode.optional().or(z.literal("").transform(() => undefined)),
  buyerNote: optionalTrimmed(1000, "Note"),
};

type DeliveryShape = { deliveryMethod: string; deliveryAddress?: string; deliveryState?: string };

function addressIssues(v: DeliveryShape): { path: string[]; message: string }[] {
  if (v.deliveryMethod === "pickup") return [];
  const issues: { path: string[]; message: string }[] = [];
  if (!v.deliveryAddress) issues.push({ path: ["deliveryAddress"], message: "Enter the delivery address" });
  if (!v.deliveryState) issues.push({ path: ["deliveryState"], message: "Choose the delivery state" });
  return issues;
}

export const checkoutSchema = z
  .object({
    sellerBusinessId: uuid,
    items: z
      .string()
      .transform((raw, ctx) => {
        try {
          return JSON.parse(raw) as unknown;
        } catch {
          ctx.addIssue({ code: "custom", message: "Your cart could not be read" });
          return z.NEVER;
        }
      })
      .pipe(
        z
          .array(z.object({ productId: uuid, quantity: quantity("Quantity") }))
          .min(1, "Your cart is empty")
          .max(20, "At most 20 items per order"),
      ),
    ...deliveryFields,
  })
  .superRefine((v, ctx) => {
    for (const issue of addressIssues(v)) ctx.addIssue({ code: "custom", ...issue });
  });

export const acceptQuotationSchema = z
  .object({ quotationId: uuid, ...deliveryFields })
  .superRefine((v, ctx) => {
    for (const issue of addressIssues(v)) ctx.addIssue({ code: "custom", ...issue });
  });

export const acceptOrderSchema = z.object({
  orderId: uuid,
  deliveryFee: nairaAmount("Delivery fee", { allowZero: true }),
  expectedDeliveryDate: optionalIsoDate,
  deliveryTerms: optionalTrimmed(1000, "Delivery terms"),
  note: optionalTrimmed(1000, "Note"),
});

export const transitionSchema = z.object({
  orderId: uuid,
  to: z.enum([
    "requested",
    "rejected",
    "awaiting_payment",
    "preparing",
    "dispatched",
    "delivered",
    "completed",
    "cancelled",
    "refunded",
  ]),
  note: optionalTrimmed(1000, "Reason"),
});

export const offlinePaymentSchema = z.object({
  orderId: uuid,
  reference: trimmed(3, 100, "Payment reference"),
  note: optionalTrimmed(300, "Note"),
});

export const reviewSchema = z.object({
  orderId: uuid,
  businessId: uuid,
  rating: z.coerce.number().int().min(1, "Choose a rating").max(5),
  comment: optionalTrimmed(2000, "Comment"),
});

// ---------------------------------------------------------------- disputes & reports
export const disputeSchema = z.object({
  orderId: uuid,
  category: z.enum(values(DISPUTE_CATEGORIES)),
  description: trimmed(10, 4000, "Description"),
});

export const disputeMessageSchema = z.object({
  disputeId: uuid,
  body: trimmed(1, 4000, "Message"),
  isInternal: checkbox,
});

export const resolveDisputeSchema = z.object({
  disputeId: uuid,
  outcome: z.enum(["refund", "partial_refund", "complete_order", "no_action"]),
  note: trimmed(10, 4000, "Decision"),
  reject: checkbox,
});

export const reportSchema = z.object({
  targetType: z.enum(["product", "business", "user", "logistics_service"]),
  targetId: uuid,
  reason: z.enum(values(REPORT_REASONS)),
  details: optionalTrimmed(2000, "Details"),
});

export const supportSchema = z.object({
  name: trimmed(2, 120, "Name"),
  email: email,
  topic: z.enum(values(SUPPORT_TOPICS)),
  message: trimmed(10, 4000, "Message"),
});

// ---------------------------------------------------------------- logistics
export const logisticsServiceSchema = z.object({
  businessId: uuid,
  serviceType: z.enum(values(LOGISTICS_SERVICE_TYPES)),
  title: trimmed(3, 120, "Title"),
  description: trimmed(10, 4000, "Description"),
  coverageStates: z.array(stateCode).min(1, "Choose at least one state you cover"),
  capacityDescription: optionalTrimmed(300, "Capacity"),
  temperatureRange: optionalTrimmed(60, "Temperature range"),
  basePrice: optionalNairaAmount("Base price"),
  pricingUnit: optionalTrimmed(60, "Pricing unit"),
  pricingNotes: optionalTrimmed(1000, "Pricing notes"),
  intent: z.enum(["draft", "publish"]).default("draft"),
});

export const bookingSchema = z.object({
  serviceId: uuid,
  orderId: uuid.optional().or(z.literal("").transform(() => undefined)),
  pickupLocation: trimmed(2, 300, "Pickup location"),
  dropoffLocation: trimmed(2, 300, "Drop-off location"),
  requestedDate: isoDate.refine((v) => v >= new Date().toISOString().slice(0, 10), "Date cannot be in the past"),
  cargoDescription: trimmed(3, 1000, "Cargo description"),
  quantityDescription: optionalTrimmed(200, "Quantity"),
  specialRequirements: optionalTrimmed(1000, "Special requirements"),
});

export const bookingTransitionSchema = z.object({
  bookingId: uuid,
  to: z.enum(["quoted", "confirmed", "declined", "in_progress", "completed", "cancelled"]),
  quotedPrice: optionalNairaAmount("Price"),
  expectedDate: optionalIsoDate,
  deliveryTerms: optionalTrimmed(1000, "Terms"),
  note: optionalTrimmed(1000, "Note"),
});

// ---------------------------------------------------------------- admin
export const adminReasonSchema = z.object({
  targetId: uuid,
  reason: optionalTrimmed(1000, "Reason"),
});

export const categorySchema = z.object({
  id: uuid.optional().or(z.literal("").transform(() => undefined)),
  name: trimmed(2, 80, "Name"),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens"),
  description: optionalTrimmed(500, "Description"),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  isActive: checkbox,
});
