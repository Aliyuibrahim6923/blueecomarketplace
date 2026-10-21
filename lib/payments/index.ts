import "server-only";
import { randomBytes } from "node:crypto";
import { serverEnv } from "@/lib/env.server";
import { PaystackProvider } from "./paystack";
import type { PaymentProvider } from "./types";

/**
 * Returns the configured licensed provider, or null when none is configured.
 * With no provider, the platform offers only the clearly-labelled sandbox
 * (if enabled in platform settings) and the pilot offline-payment flow.
 */
export function getPaymentProvider(): PaymentProvider | null {
  const env = serverEnv();
  if (env.paymentProvider === "paystack" && env.paystackSecretKey) {
    return new PaystackProvider(env.paystackSecretKey);
  }
  return null;
}

export function getPaymentProviderById(id: string): PaymentProvider | null {
  const provider = getPaymentProvider();
  return provider && provider.id === id ? provider : null;
}

/** Unique, unguessable transaction reference, e.g. BM-PAY-1a2b3c4d5e6f7a8b9c0d. */
export function newPaymentReference(): string {
  return `BM-PAY-${randomBytes(10).toString("hex")}`;
}

export type { PaymentProvider } from "./types";
