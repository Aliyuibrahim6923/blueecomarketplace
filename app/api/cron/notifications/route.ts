import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { externalMessage, getEmailSender, getSmsSender } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH = 100;
const MAX_ATTEMPTS = 5;

function authorised(request: NextRequest): boolean {
  const secret = serverEnv().cronSecret;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * Delivers queued email/SMS copies of in-app notifications. Called by Vercel
 * Cron with `Authorization: Bearer $CRON_SECRET`. When no provider is configured
 * rows are marked "skipped" — in-app notifications are unaffected.
 */
export async function GET(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("notification_outbox")
    .select("id, channel, attempts, notification:notifications(title, link), profile:profiles(email, phone)")
    .eq("status", "pending")
    .order("created_at")
    .limit(BATCH);
  if (error) return NextResponse.json({ error: "Outbox unavailable" }, { status: 503 });

  const email = getEmailSender();
  const sms = getSmsSender();
  const siteUrl = publicEnv().siteUrl;
  const counts = { sent: 0, skipped: 0, failed: 0 };

  for (const row of rows ?? []) {
    const n = (Array.isArray(row.notification) ? row.notification[0] : row.notification) as { title: string; link: string | null } | null;
    const p = (Array.isArray(row.profile) ? row.profile[0] : row.profile) as { email: string | null; phone: string | null } | null;
    let result: { status: "sent" | "skipped" | "failed"; error?: string } = { status: "skipped", error: "Missing recipient" };
    if (n && p) {
      const msg = externalMessage(n.title, n.link, siteUrl);
      if (row.channel === "email" && p.email) result = await email.send(p.email, msg.subject, msg.text);
      if (row.channel === "sms" && p.phone) result = await sms.send(p.phone, msg.sms);
    }
    const attempts = (row.attempts as number) + 1;
    const finalStatus = result.status === "failed" && attempts < MAX_ATTEMPTS ? "pending" : result.status;
    await admin
      .from("notification_outbox")
      .update({
        status: finalStatus,
        attempts,
        last_error: result.error?.slice(0, 500) ?? null,
        processed_at: finalStatus === "pending" ? null : new Date().toISOString(),
      })
      .eq("id", row.id);
    counts[result.status] += 1;
  }

  const { data: expired } = await admin.rpc("expire_stale_quotations");
  return NextResponse.json({ processed: rows?.length ?? 0, ...counts, quotationsExpired: expired ?? 0 });
}
