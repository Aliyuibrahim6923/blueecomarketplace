import { NextResponse, type NextRequest } from "next/server";
import { getViewer, hasRole } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";

const REPORTS = {
  orders: {
    table: "orders",
    columns: [
      "order_number", "status", "currency", "subtotal_minor", "delivery_fee_minor", "marketplace_fee_minor", "tax_minor",
      "total_minor", "delivery_method", "delivery_state", "payment_provider", "placed_at", "completed_at", "cancelled_at",
    ],
    dateColumn: "created_at",
  },
  payments: {
    table: "payment_transactions",
    columns: [
      "reference", "provider", "status", "amount_minor", "currency", "provider_fee_minor", "refunded_amount_minor",
      "reconciliation_status", "provider_transaction_id", "verified_at", "created_at",
    ],
    dateColumn: "created_at",
  },
  businesses: {
    table: "businesses",
    columns: ["name", "slug", "business_category", "is_supplier", "is_logistics_provider", "state_code", "verification_status", "status", "created_at"],
    dateColumn: "created_at",
  },
  listings: {
    table: "products",
    columns: ["name", "product_state", "pricing_type", "price_minor", "currency", "unit", "available_quantity", "location_state", "status", "published_at", "expires_at"],
    dateColumn: "updated_at",
  },
  disputes: {
    table: "disputes",
    columns: ["category", "status", "outcome", "previous_order_status", "created_at", "resolved_at"],
    dateColumn: "created_at",
  },
} as const;

/** Admin CSV export (RLS still applies: the query runs as the signed-in admin). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  const def = REPORTS[report as keyof typeof REPORTS];
  if (!def) return NextResponse.json({ error: "Unknown report" }, { status: 404 });

  const viewer = await getViewer();
  if (!hasRole(viewer, "admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const days = Math.min(3650, Math.max(1, Number(request.nextUrl.searchParams.get("days")) || 30));
  const supabase = await createClient();
  const { error: auditError } = await supabase.rpc("log_admin_export", { p_report: report, p_days: days });
  if (auditError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from(def.table)
    .select(def.columns.join(","))
    .gte(def.dateColumn, since)
    .order(def.dateColumn, { ascending: false })
    .limit(50_000);
  if (error) return NextResponse.json({ error: "Export failed" }, { status: 500 });

  const csv = toCsv((data ?? []) as unknown as Record<string, unknown>[], [...def.columns]);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bluemarket-${report}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
