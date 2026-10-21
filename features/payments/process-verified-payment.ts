import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentProvider } from "@/lib/payments";

/**
 * Re-query the provider for the authoritative transaction state, then let the
 * database apply it (amount/currency checks, idempotency, order transition).
 * Shared by the webhook and the browser-return callback.
 */
export async function processVerifiedPayment(admin: SupabaseClient, provider: PaymentProvider, reference: string): Promise<string> {
  const verified = await provider.verify(reference);
  if (verified.status === "pending") return "pending";
  const { data, error } = await admin.rpc("record_payment_result", {
    p_reference: reference,
    p_status: verified.status,
    p_amount_minor: verified.amountMinor,
    p_currency: verified.currency,
    p_provider_transaction_id: verified.providerTransactionId,
    p_provider_fee_minor: verified.providerFeeMinor,
    p_channel: verified.channel,
  });
  if (error) throw new Error(`record_payment_result failed (${error.code ?? "unknown"})`);
  return data as string;
}
