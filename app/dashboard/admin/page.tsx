import type { Metadata } from "next";
import Link from "next/link";
import { StatCard } from "@/components/charts/bar-chart";
import { Alert, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui/primitives";
import { formatMinor } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { lastDaysRange } from "@/lib/utils";

export const metadata: Metadata = { title: "Operations overview" };

type Overview = {
  users: Record<string, number>;
  businesses: Record<string, number>;
  listings: Record<string, number>;
  orders: Record<string, number>;
  payments: Record<string, number>;
  disputes: Record<string, number>;
  support: Record<string, number>;
};

const PERIODS = { "7": 7, "30": 30, "90": 90, "365": 365 } as const;

export default async function AdminOverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const days = PERIODS[(sp.days ?? "30") as keyof typeof PERIODS] ?? 30;
  const supabase = await createClient();
  const range = lastDaysRange(days);
  const { data, error } = await supabase.rpc("admin_overview", { p_from: range.from, p_to: range.to });
  const o = data as Overview | null;

  return (
    <>
      <PageHeader
        title="Operations overview"
        description="Live figures from the database. GMV (value of goods traded) and marketplace revenue (fees) are always separate."
        actions={
          <div className="flex gap-1 text-sm">
            {Object.keys(PERIODS).map((d) => (
              <Link key={d} href={`/dashboard/admin?days=${d}`} className={`rounded-md border px-3 py-1.5 ${Number(d) === days ? "border-ocean-700 bg-ocean-50" : "border-border bg-white"}`}>
                {d}d
              </Link>
            ))}
          </div>
        }
      />
      {error || !o ? (
        <Alert tone="danger">Overview unavailable.</Alert>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Queues</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Link href="/dashboard/admin/businesses"><StatCard label="Pending verification" value={o.businesses.pending_verification ?? 0} /></Link>
              <Link href="/dashboard/admin/reports"><StatCard label="Open reports" value={o.listings.open_reports ?? 0} /></Link>
              <Link href="/dashboard/admin/disputes"><StatCard label="Open disputes" value={o.disputes.open ?? 0} /></Link>
              <Link href="/dashboard/admin/reports#support"><StatCard label="Support requests" value={o.support.open ?? 0} /></Link>
            </div>
          </section>
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Participation</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Users" value={o.users.total ?? 0} hint={`${o.users.new_in_period ?? 0} new in period`} />
              <StatCard label="Businesses" value={o.businesses.total ?? 0} hint={`${o.businesses.suppliers ?? 0} suppliers · ${o.businesses.logistics ?? 0} logistics`} />
              <StatCard label="Verified businesses" value={o.businesses.verified ?? 0} />
              <StatCard label="Live listings" value={o.listings.published ?? 0} hint={`${o.listings.hidden ?? 0} hidden by moderators`} />
            </div>
          </section>
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Orders placed in period</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Orders placed" value={o.orders.placed ?? 0} />
              <StatCard label="Completed" value={o.orders.completed ?? 0} />
              <StatCard label="Cancelled / rejected" value={o.orders.cancelled ?? 0} />
              <StatCard label="Disputed now" value={o.orders.disputed ?? 0} />
              <StatCard label="GMV (completed)" value={formatMinor(o.orders.gmv_completed_minor ?? 0)} hint="Items + delivery. Not revenue." />
              <StatCard label="Marketplace revenue" value={formatMinor(o.orders.marketplace_revenue_minor ?? 0)} hint="Fees on completed orders" />
              <StatCard label="Refunded" value={formatMinor(o.orders.refunded_minor ?? 0)} />
              <StatCard label="Provider fees" value={formatMinor(o.payments.provider_fees_minor ?? 0)} />
            </div>
          </section>
          <Card>
            <CardHeader>
              <CardTitle>Payments & reconciliation</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
              <p>Real payments succeeded: <strong>{o.payments.succeeded_real ?? 0}</strong></p>
              <p>Sandbox (simulated): <strong>{o.payments.succeeded_sandbox ?? 0}</strong></p>
              <p>Failed: <strong>{o.payments.failed ?? 0}</strong></p>
              <p>Amount mismatches: <strong className={o.payments.mismatched ? "text-red-700" : ""}>{o.payments.mismatched ?? 0}</strong></p>
              <p>Offline payments to reconcile: <strong>{o.payments.unreconciled_offline ?? 0}</strong></p>
              <p>
                <Link href="/api/admin/export/payments" className="text-ocean-700 underline">
                  Export payments CSV
                </Link>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Exports</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4 text-sm">
              {["orders", "payments", "businesses", "listings", "disputes"].map((r) => (
                <a key={r} href={`/api/admin/export/${r}?days=${days}`} className="text-ocean-700 underline">
                  {r[0]!.toUpperCase() + r.slice(1)} (CSV)
                </a>
              ))}
              <p className="w-full text-xs text-muted-foreground">Exports are logged in the audit trail. Handle downloaded files under your data-protection policy.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
