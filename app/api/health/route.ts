import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Liveness + database reachability for uptime monitors. Reveals no configuration. */
export async function GET() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("regions").select("code", { head: true, count: "exact" }).limit(1);
    return NextResponse.json({ ok: !error, database: error ? "unreachable" : "ok" }, { status: error ? 503 : 200 });
  } catch {
    return NextResponse.json({ ok: false, database: "unconfigured" }, { status: 503 });
  }
}
