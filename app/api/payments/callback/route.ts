import { NextResponse, type NextRequest } from "next/server";
import { processVerifiedPayment } from "@/features/payments/process-verified-payment";
import { getPaymentProviderById } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Browser return from the provider's checkout. The redirect itself proves
 * nothing: we look up the transaction for the signed-in buyer, then verify it
 * server-side with the provider before recording anything.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const provider = getPaymentProviderById(url.searchParams.get("provider") ?? "");
  const reference = url.searchParams.get("reference") ?? url.searchParams.get("trxref") ?? "";
  if (!provider || !/^BM-PAY-[0-9a-f]{20}$/.test(reference)) {
    return NextResponse.redirect(new URL("/dashboard/orders?payment=unknown", url.origin));
  }

  // RLS: only a participant of the order can see this transaction.
  const supabase = await createClient();
  const { data: tx } = await supabase.from("payment_transactions").select("order_id").eq("reference", reference).maybeSingle();
  if (!tx) return NextResponse.redirect(new URL("/dashboard/orders?payment=unknown", url.origin));

  try {
    await processVerifiedPayment(createAdminClient(), provider, reference);
  } catch {
    // The webhook will still deliver the result; the order page shows the current state.
  }
  return NextResponse.redirect(new URL(`/dashboard/orders/${tx.order_id as string}?payment=returned`, url.origin));
}
