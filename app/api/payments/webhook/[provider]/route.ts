import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { processVerifiedPayment } from "@/features/payments/process-verified-payment";
import { getPaymentProviderById } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 256 * 1024;

/**
 * Payment provider webhook.
 * 1. Verify the signature over the RAW body (reject otherwise).
 * 2. Record the event key once (replays are acknowledged and ignored).
 * 3. Re-verify the transaction with the provider's API before changing anything.
 * The payload itself is never trusted for amounts or status, and is not stored
 * (only a SHA-256 of it).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerId } = await params;
  const provider = getPaymentProviderById(providerId);
  if (!provider) return NextResponse.json({ error: "Unknown provider" }, { status: 404 });

  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "Payload too large" }, { status: 413 });

  if (!provider.verifyWebhookSignature(raw, request.headers)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event;
  try {
    event = provider.parseWebhook(raw);
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  const admin = createAdminClient();
  const payloadSha256 = createHash("sha256").update(raw).digest("hex");
  const { data: isNew, error: recordError } = await admin.rpc("record_webhook_event", {
    p_provider: provider.id,
    p_event_key: event.eventKey,
    p_event_type: event.eventType,
    p_reference: event.reference,
    p_signature_valid: true,
    p_payload_sha256: payloadSha256,
  });
  if (recordError) return NextResponse.json({ error: "Temporarily unavailable" }, { status: 503 });
  if (!isNew) return NextResponse.json({ received: true, duplicate: true });

  let result = "ignored";
  try {
    if (event.reference && /^charge\./.test(event.eventType)) {
      result = await processVerifiedPayment(admin, provider, event.reference);
    }
  } catch {
    result = "error";
  }
  await admin.rpc("mark_webhook_event_processed", { p_provider: provider.id, p_event_key: event.eventKey, p_result: result });

  // Ask the provider to retry later if we could not process it.
  if (result === "error") return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  return NextResponse.json({ received: true });
}
