/**
 * Provider-independent payment interface. A licensed provider adapter must:
 *  - create a hosted checkout for an amount the SERVER computed,
 *  - verify a transaction by reference with the provider's API (server-side),
 *  - verify webhook signatures against the raw request body.
 * The app never handles card data; the browser redirect is never proof of payment.
 */

export type PaymentInitInput = {
  reference: string;
  amountMinor: number;
  currency: string;
  email: string;
  callbackUrl: string;
  metadata?: Record<string, string>;
};

export type PaymentInitResult = { authorizationUrl: string };

export type VerifiedPayment = {
  reference: string;
  status: "succeeded" | "failed" | "pending" | "cancelled";
  amountMinor: number;
  currency: string;
  providerTransactionId: string | null;
  providerFeeMinor: number | null;
  channel: string | null;
};

export type WebhookEvent = {
  /** Stable key used for idempotency (provider + event key is unique). */
  eventKey: string;
  eventType: string;
  reference: string | null;
};

export interface PaymentProvider {
  readonly id: "paystack";
  readonly displayName: string;
  initialize(input: PaymentInitInput): Promise<PaymentInitResult>;
  verify(reference: string): Promise<VerifiedPayment>;
  verifyWebhookSignature(rawBody: string, headers: Headers): boolean;
  parseWebhook(rawBody: string): WebhookEvent;
}

export class PaymentProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentProviderError";
  }
}
