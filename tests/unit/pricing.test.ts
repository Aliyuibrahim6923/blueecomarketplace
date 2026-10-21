import { describe, expect, it } from "vitest";
import { bpsOf, computeTotals, lineTotalMinor, quantityToMilli } from "@/lib/orders/pricing";

describe("quantityToMilli", () => {
  it("converts decimal quantities exactly", () => {
    expect(quantityToMilli("25.5")).toBe(BigInt(25500));
    expect(quantityToMilli("0.125")).toBe(BigInt(125));
    expect(quantityToMilli(3)).toBe(BigInt(3000));
  });
  it("rejects more than 3 decimals", () => {
    expect(() => quantityToMilli("1.2345")).toThrow();
  });
});

describe("lineTotalMinor", () => {
  it("matches the SQL result for the demo order (25.5 kg × ₦2,800)", () => {
    expect(lineTotalMinor(280000, "25.5")).toBe(7140000);
  });
  it("rounds half away from zero like PostgreSQL round()", () => {
    // 333 kobo × 1.5 = 499.5 → 500
    expect(lineTotalMinor(333, "1.5")).toBe(500);
    // 333 kobo × 1.001 = 333.333 → 333
    expect(lineTotalMinor(333, "1.001")).toBe(333);
  });
  it("handles large values without floating-point error", () => {
    // ₦9,999,999.99 × 9,999.999
    expect(lineTotalMinor(999999999, "9999.999")).toBe(9999998990000);
  });
});

describe("computeTotals", () => {
  it("matches create_order() totals in supabase/tests/03_order_workflow.sql", () => {
    const t = computeTotals({ lines: [{ unitPriceMinor: 280000, quantity: "25.5" }], marketplaceFeeBps: 250 });
    expect(t.subtotalMinor).toBe(7140000);
    expect(t.marketplaceFeeMinor).toBe(178500);
    expect(t.totalMinor).toBe(7318500);
  });

  it("adds delivery and tax and keeps total = sum of parts", () => {
    const t = computeTotals({
      lines: [
        { unitPriceMinor: 350000, quantity: 10 },
        { unitPriceMinor: 650000, quantity: "2.5" },
      ],
      deliveryFeeMinor: 500000,
      marketplaceFeeBps: 300,
      taxBps: 750,
    });
    expect(t.subtotalMinor).toBe(5125000);
    expect(t.marketplaceFeeMinor).toBe(bpsOf(5125000, 300));
    expect(t.taxMinor).toBe(bpsOf(5125000 + 500000 + t.marketplaceFeeMinor, 750));
    expect(t.totalMinor).toBe(t.subtotalMinor + t.deliveryFeeMinor + t.marketplaceFeeMinor + t.taxMinor);
  });

  it("is zero for an empty cart", () => {
    expect(computeTotals({ lines: [] }).totalMinor).toBe(0);
  });
});
