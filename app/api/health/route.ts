import { NextResponse } from "next/server";
import { publicEnvIssues } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Liveness + database reachability for uptime monitors. Reveals no configuration. */
export async function GET() {
  const issues = publicEnvIssues();
  if (issues.length) return NextResponse.json({ ok: false, config: issues }, { status: 503 });
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("regions").select("code", { head: true, count: "exact" }).limit(1);
    // "schema_missing" usually means the migrations were not applied to this Supabase project.
    const database = !error ? "ok" : error.code === "42P01" || error.code === "PGRST205" ? "schema_missing" : "unreachable";
    return NextResponse.json({ ok: !error, database }, { status: error ? 503 : 200 });
  } catch {
    return NextResponse.json({ ok: false, database: "unconfigured" }, { status: 503 });
  }
}
