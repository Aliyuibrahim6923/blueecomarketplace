import { describe, expect, it } from "vitest";
import { checkoutSchema, listingSchema, signUpSchema } from "@/lib/validation/schemas";

const listing = {
  businessId: "a2222222-2222-4222-8222-222222222222",
  categoryId: "b3333333-3333-4333-8333-333333333333",
  name: "Table-size catfish",
  description: "Farm-raised catfish harvested to order.",
  productState: "live",
  pricingType: "fixed",
  price: "2,800",
  unit: "kg",
  availableQuantity: "800",
  minOrderQuantity: "20",
  locationState: "LA",
  availableFrom: "2026-10-21",
  deliveryOptions: ["pickup"],
};

describe("listing validation", () => {
  it("accepts a valid fixed-price listing and converts price to kobo", () => {
    const r = listingSchema.safeParse(listing);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.priceMinor).toBe(280000);
  });
  it("requires a price for fixed-price listings", () => {
    const r = listingSchema.safeParse({ ...listing, price: "" });
    expect(r.success).toBe(false);
  });
  it("allows quote-required listings without a price", () => {
    const r = listingSchema.safeParse({ ...listing, pricingType: "quote_required", price: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.priceMinor).toBeNull();
  });
  it("rejects unknown states, units and delivery options", () => {
    expect(listingSchema.safeParse({ ...listing, locationState: "XX" }).success).toBe(false);
    expect(listingSchema.safeParse({ ...listing, unit: "ton" }).success).toBe(false);
    expect(listingSchema.safeParse({ ...listing, deliveryOptions: ["drone"] }).success).toBe(false);
    expect(listingSchema.safeParse({ ...listing, deliveryOptions: [] }).success).toBe(false);
  });
});

describe("checkout validation", () => {
  const base = {
    sellerBusinessId: "a2222222-2222-4222-8222-222222222222",
    items: JSON.stringify([{ productId: "b3333333-3333-4333-8333-333333333333", quantity: "25.5" }]),
    deliveryMethod: "pickup",
  };
  it("accepts pickup without an address", () => {
    expect(checkoutSchema.safeParse(base).success).toBe(true);
  });
  it("requires address and state for delivery", () => {
    const r = checkoutSchema.safeParse({ ...base, deliveryMethod: "seller_delivery" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("deliveryAddress");
      expect(paths).toContain("deliveryState");
    }
  });
  it("rejects malformed carts", () => {
    expect(checkoutSchema.safeParse({ ...base, items: "not json" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, items: "[]" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, items: JSON.stringify([{ productId: "x", quantity: "1" }]) }).success).toBe(false);
  });
});

describe("sign-up validation", () => {
  const ok = { fullName: "Ngozi Okafor", email: "Ngozi@Example.com ", password: "fish-market-2026", intendedRole: "supplier", acceptTerms: "on" };
  it("normalises email and accepts self-service roles", () => {
    const r = signUpSchema.safeParse(ok);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("ngozi@example.com");
  });
  it("never accepts privileged roles at sign-up", () => {
    expect(signUpSchema.safeParse({ ...ok, intendedRole: "admin" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...ok, intendedRole: "agency_analyst" }).success).toBe(false);
  });
  it("requires terms and a reasonable password", () => {
    expect(signUpSchema.safeParse({ ...ok, acceptTerms: undefined }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...ok, password: "short1" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...ok, password: "onlyletterspassword" }).success).toBe(false);
  });
});
