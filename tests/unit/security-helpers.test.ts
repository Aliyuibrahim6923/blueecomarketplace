import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";
import { friendlyError } from "@/lib/errors";
import { PaystackProvider } from "@/lib/payments/paystack";
import { safeRedirectPath } from "@/lib/safe-redirect";

describe("safeRedirectPath", () => {
  it.each(["/dashboard", "/dashboard/orders?view=selling", "/products/abc#enquire"])("keeps %s", (p) => {
    expect(safeRedirectPath(p)).toBe(p);
  });
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "dashboard", "/ok\nSet-Cookie:x", ""])(
    "rejects %s",
    (p) => {
      expect(safeRedirectPath(p, "/fallback")).toBe("/fallback");
    },
  );
});

describe("CSV export", () => {
  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+234801")).toBe("'+234801");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });
  it("quotes commas and newlines", () => {
    expect(toCsv([{ a: "x,y", b: "line\nbreak" }], ["a", "b"])).toBe('a,b\r\n"x,y","line\nbreak"\r\n');
  });
});

describe("friendlyError", () => {
  it("passes through business-rule messages", () => {
    expect(friendlyError({ code: "22023", message: "Minimum order is 20 kg" })).toBe("Minimum order is 20 kg");
  });
  it("hides raw RLS / permission errors", () => {
    expect(friendlyError({ code: "42501", message: "new row violates row-level security policy for table orders" })).toBe(
      "You don't have permission to do that.",
    );
  });
  it("never leaks unexpected database errors", () => {
    expect(friendlyError({ code: "XX000", message: "internal: relation secret_table" })).toBe("Something went wrong. Please try again.");
  });
});

describe("Paystack webhook signature", () => {
  const secret = "sk_test_example_secret_key";
  const provider = new PaystackProvider(secret);
  const body = JSON.stringify({ event: "charge.success", data: { id: 42, reference: "BM-PAY-0123456789abcdef0123" } });
  const sign = (payload: string, key = secret) => createHmac("sha512", key).update(payload).digest("hex");

  it("accepts a valid signature", () => {
    expect(provider.verifyWebhookSignature(body, new Headers({ "x-paystack-signature": sign(body) }))).toBe(true);
  });
  it("rejects a tampered body", () => {
    expect(provider.verifyWebhookSignature(body.replace("42", "43"), new Headers({ "x-paystack-signature": sign(body) }))).toBe(false);
  });
  it("rejects a signature made with another key", () => {
    expect(provider.verifyWebhookSignature(body, new Headers({ "x-paystack-signature": sign(body, "sk_other") }))).toBe(false);
  });
  it("rejects missing or malformed signatures", () => {
    expect(provider.verifyWebhookSignature(body, new Headers())).toBe(false);
    expect(provider.verifyWebhookSignature(body, new Headers({ "x-paystack-signature": "abc" }))).toBe(false);
  });
  it("derives a stable idempotency key", () => {
    const a = provider.parseWebhook(body);
    expect(a.eventKey).toBe("charge.success:42:BM-PAY-0123456789abcdef0123");
    expect(provider.parseWebhook(body).eventKey).toBe(a.eventKey);
  });
});
