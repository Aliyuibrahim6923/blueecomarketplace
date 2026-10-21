import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  PaymentProviderError,
  type PaymentInitInput,
  type PaymentInitResult,
  type PaymentProvider,
  type VerifiedPayment,
  type WebhookEvent,
} from "./types";

/**
 * Paystack adapter (inactive until PAYMENT_PROVIDER=paystack and a secret key
 * are configured). Endpoints and signature scheme follow Paystack's public API
 * documentation: POST /transaction/initialize, GET /transaction/verify/:reference,
 * and an HMAC-SHA512 of the raw body in the `x-paystack-signature` header.
 * Re-check against the current docs before enabling in production.
 */
const API = "https://api.paystack.co";

type PaystackVerifyData = {
  id?: number;
  status?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  fees?: number | null;
  channel?: string | null;
};

export class PaystackProvider implements PaymentProvider {
  readonly id = "paystack" as const;
  readonly displayName = "Paystack";

  constructor(private readonly secretKey: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
    if (!res.ok || !body?.status || body.data === undefined) {
      throw new PaymentProviderError(`Payment provider request failed (${res.status})`);
    }
    return body.data;
  }

  async initialize(input: PaymentInitInput): Promise<PaymentInitResult> {
    const data = await this.request<{ authorization_url?: string }>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        amount: input.amountMinor, // Paystack expects the lowest denomination (kobo).
        currency: input.currency,
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
      }),
    });
    if (!data.authorization_url) throw new PaymentProviderError("Provider did not return a checkout URL");
    return { authorizationUrl: data.authorization_url };
  }

  async verify(reference: string): Promise<VerifiedPayment> {
    const data = await this.request<PaystackVerifyData>(`/transaction/verify/${encodeURIComponent(reference)}`);
    const status: VerifiedPayment["status"] =
      data.status === "success"
        ? "succeeded"
        : data.status === "failed"
          ? "failed"
          : data.status === "abandoned"
            ? "cancelled"
            : "pending";
    return {
      reference: data.reference ?? reference,
      status,
      amountMinor: Number(data.amount ?? 0),
      currency: (data.currency ?? "").toUpperCase(),
      providerTransactionId: data.id !== undefined ? String(data.id) : null,
      providerFeeMinor: typeof data.fees === "number" ? data.fees : null,
      channel: data.channel ?? null,
    };
  }

  verifyWebhookSignature(rawBody: string, headers: Headers): boolean {
    const signature = headers.get("x-paystack-signature");
    if (!signature || !/^[0-9a-f]{128}$/i.test(signature)) return false;
    const expected = createHmac("sha512", this.secretKey).update(rawBody, "utf8").digest("hex");
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parseWebhook(rawBody: string): WebhookEvent {
    const parsed = JSON.parse(rawBody) as { event?: string; data?: { id?: number | string; reference?: string } };
    const eventType = typeof parsed.event === "string" ? parsed.event : "unknown";
    const reference = typeof parsed.data?.reference === "string" ? parsed.data.reference : null;
    const id = parsed.data?.id !== undefined ? String(parsed.data.id) : "noid";
    return { eventKey: `${eventType}:${id}:${reference ?? "noref"}`, eventType, reference };
  }
}
