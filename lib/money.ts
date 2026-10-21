/**
 * Money is always handled as integer minor units (kobo for NGN).
 * Never use floating point to add or multiply amounts.
 */

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string) {
  let f = formatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("en-NG", { style: "currency", currency, minimumFractionDigits: 2 });
    formatters.set(currency, f);
  }
  return f;
}

/** 7140000 → "₦71,400.00" */
export function formatMinor(minor: number | bigint | null | undefined, currency = "NGN"): string {
  if (minor === null || minor === undefined) return "—";
  const big = BigInt(minor);
  const negative = big < BigInt(0);
  const abs = negative ? -big : big;
  const major = abs / BigInt(100);
  const cents = abs % BigInt(100);
  // Format the integer part with Intl (safe for realistic amounts), append exact kobo.
  const parts = formatter(currency).formatToParts(Number(major));
  const out = parts
    .map((p) => (p.type === "fraction" ? cents.toString().padStart(2, "0") : p.value))
    .join("");
  return negative ? `-${out}` : out;
}

/**
 * Parse a user-entered naira amount ("71,400.50", "71400") into kobo without
 * floating point. Returns null for invalid input or more than 2 decimals.
 */
export function parseMajorToMinor(input: string): number | null {
  const cleaned = input.replace(/[₦,\s]/g, "");
  if (!/^\d{1,13}(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole = "0", frac = ""] = cleaned.split(".");
  const minor = BigInt(whole) * BigInt(100) + BigInt(frac.padEnd(2, "0"));
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(minor);
}

/** Kobo → plain "71400.50" for form default values. */
export function minorToMajorString(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return "";
  const big = BigInt(minor);
  const whole = big / BigInt(100);
  const frac = (big % BigInt(100)).toString().padStart(2, "0");
  return frac === "00" ? whole.toString() : `${whole}.${frac}`;
}
