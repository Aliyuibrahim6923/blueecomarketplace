/**
 * Order total calculation — a client-side PREVIEW that mirrors the SQL in
 * private.recalculate_order_totals(). The database always recomputes; these
 * numbers are never sent to the server as truth.
 *
 * Quantities have up to 3 decimals; prices are integer kobo. All arithmetic is
 * done with BigInt and rounds half away from zero, like PostgreSQL round().
 */

export type PricingLine = { unitPriceMinor: number; quantity: number | string };

export type OrderTotals = {
  subtotalMinor: number;
  deliveryFeeMinor: number;
  marketplaceFeeMinor: number;
  taxMinor: number;
  totalMinor: number;
};

const THOUSAND = BigInt(1000);
const TEN_THOUSAND = BigInt(10000);

/** "25.5" → 25500n (thousandths). Throws on more than 3 decimals or invalid input. */
export function quantityToMilli(quantity: number | string): bigint {
  const text = typeof quantity === "number" ? quantity.toString() : quantity.trim();
  if (!/^\d+(\.\d{1,3})?$/.test(text)) throw new Error(`Invalid quantity: ${text}`);
  const [whole = "0", frac = ""] = text.split(".");
  return BigInt(whole) * THOUSAND + BigInt(frac.padEnd(3, "0"));
}

function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  // Inputs here are non-negative.
  return (numerator * BigInt(2) + denominator) / (denominator * BigInt(2));
}

export function lineTotalMinor(unitPriceMinor: number, quantity: number | string): number {
  return Number(divRoundHalfUp(BigInt(unitPriceMinor) * quantityToMilli(quantity), THOUSAND));
}

export function bpsOf(amountMinor: number, bps: number): number {
  return Number(divRoundHalfUp(BigInt(amountMinor) * BigInt(bps), TEN_THOUSAND));
}

export function computeTotals(args: {
  lines: PricingLine[];
  deliveryFeeMinor?: number;
  marketplaceFeeBps?: number;
  taxBps?: number;
}): OrderTotals {
  const subtotalMinor = args.lines.reduce((sum, l) => sum + lineTotalMinor(l.unitPriceMinor, l.quantity), 0);
  const deliveryFeeMinor = args.deliveryFeeMinor ?? 0;
  const marketplaceFeeMinor = bpsOf(subtotalMinor, args.marketplaceFeeBps ?? 0);
  const taxMinor = bpsOf(subtotalMinor + deliveryFeeMinor + marketplaceFeeMinor, args.taxBps ?? 0);
  return {
    subtotalMinor,
    deliveryFeeMinor,
    marketplaceFeeMinor,
    taxMinor,
    totalMinor: subtotalMinor + deliveryFeeMinor + marketplaceFeeMinor + taxMinor,
  };
}
