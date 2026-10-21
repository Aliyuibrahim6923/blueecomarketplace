import type { Metadata } from "next";
import Link from "next/link";
import { BarChart, StatCard } from "@/components/charts/bar-chart";
import { Alert, Card, CardContent, CardHeader, CardTitle, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { requireAnalystOrAdmin } from "@/lib/auth";
import { LOGISTICS_SERVICE_TYPES } from "@/lib/constants";
import { formatMinor } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { formatDate, lastDaysRange } from "@/lib/utils";

export const metadata: Metadata = { title: "Blue economy analytics" };

type Agency = {
  period: { from: string; to: string };
  min_group_size: number;
  participation: Record<string, number>;
  transactions: {
    orders_placed: number;
    orders_completed: number;
    gmv_minor: number;
    marketplace_revenue_minor: number;
    cancellation_rate: number | null;
    dispute_rate: number | null;
  };
  regional_participation: { state: string; businesses: number; suppliers: number }[];
  regions_suppressed: number;
  category_availability: { category: string; listings: number; suppliers: number; median_price_per_kg_minor: number | null }[];
  price_trend_weekly: { week: string; category: string; median_price_per_kg_minor: number }[];
  logistics_utilisation: { bookings_requested: number; bookings_completed: number; by_service_type: Record<string, number> };
};

const PERIODS = { "30": 30, "90": 90, "180": 180, "365": 365 } as const;
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAnalystOrAdmin();
  const sp = await searchParams;
  const days = PERIODS[(sp.days ?? "90") as keyof typeof PERIODS] ?? 90;
  const supabase = await createClient();
  const range = lastDaysRange(days);
  const { data, error } = await supabase.rpc("agency_overview", { p_from: range.from, p_to: range.to });
  const a = data as Agency | null;

  return (
    <>
      <PageHeader
        title="Blue economy analytics"
        description="Aggregated, privacy-protecting indicators. No individual buyers, messages or confidential business records are included. Sandbox payments are excluded."
        actions={
          <div className="flex gap-1 text-sm">
            {Object.keys(PERIODS).map((d) => (
              <Link key={d} href={`/dashboard/analytics?days=${d}`} className={`rounded-md border px-3 py-1.5 ${Number(d) === days ? "border-ocean-700 bg-ocean-50" : "border-border bg-white"}`}>
                {d}d
              </Link>
            ))}
          </div>
        }
      />
      {error || !a ? (
        <Alert tone="danger">Analytics are unavailable right now.</Alert>
      ) : (
        <div className="space-y-8">
          <p className="text-sm text-muted-foreground">
            Period {formatDate(a.period.from)} – {formatDate(a.period.to)}. Groups with fewer than {a.min_group_size} businesses are hidden
            {a.regions_suppressed ? ` (${a.regions_suppressed} state${a.regions_suppressed === 1 ? "" : "s"} suppressed)` : ""}.
          </p>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Registered businesses" value={a.participation.registered_businesses ?? 0} />
            <StatCard label="Active businesses" value={a.participation.active_businesses ?? 0} hint="Listed or sold in period" />
            <StatCard label="Verified suppliers" value={a.participation.verified_suppliers ?? 0} />
            <StatCard label="Logistics providers" value={a.participation.logistics_providers ?? 0} />
            <StatCard label="Live listings" value={a.participation.published_listings ?? 0} />
          </section>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Orders placed" value={a.transactions.orders_placed} />
            <StatCard label="Completed transactions" value={a.transactions.orders_completed} />
            <StatCard label="GMV (completed)" value={formatMinor(a.transactions.gmv_minor)} hint="Value of goods + delivery. Not revenue." />
            <StatCard label="Marketplace revenue" value={formatMinor(a.transactions.marketplace_revenue_minor)} hint="Platform fees only" />
            <StatCard label="Cancellation rate" value={pct(a.transactions.cancellation_rate)} />
            <StatCard label="Dispute rate" value={pct(a.transactions.dispute_rate)} />
          </section>
          <div className="grid gap-4 lg:grid-cols-2">
            <BarChart
              title="Regional participation (businesses)"
              data={a.regional_participation.map((r) => ({ label: r.state, value: r.businesses }))}
              emptyText={`No state has ${a.min_group_size}+ businesses yet, so none are shown.`}
            />
            <BarChart
              title="Logistics bookings by service"
              data={Object.entries(a.logistics_utilisation.by_service_type).map(([k, v]) => ({
                label: LOGISTICS_SERVICE_TYPES.find((t) => t.value === k)?.label ?? k,
                value: v,
              }))}
              emptyText="No bookings in this period."
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Product availability</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <thead>
                  <tr>
                    <Th>Category</Th>
                    <Th>Live listings</Th>
                    <Th>Suppliers</Th>
                    <Th>Median price / kg</Th>
                  </tr>
                </thead>
                <tbody>
                  {a.category_availability.map((c) => (
                    <tr key={c.category}>
                      <Td>{c.category}</Td>
                      <Td>{c.listings}</Td>
                      <Td>{c.suppliers}</Td>
                      <Td>{c.median_price_per_kg_minor ? formatMinor(c.median_price_per_kg_minor) : "Hidden (too few suppliers)"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Weekly median transaction price per kg</CardTitle>
            </CardHeader>
            <CardContent>
              {a.price_trend_weekly.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not enough completed transactions from distinct sellers to publish a trend.</p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Week of</Th>
                      <Th>Category</Th>
                      <Th>Median / kg</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.price_trend_weekly.map((t) => (
                      <tr key={`${t.week}-${t.category}`}>
                        <Td>{formatDate(t.week)}</Td>
                        <Td>{t.category}</Td>
                        <Td>{formatMinor(t.median_price_per_kg_minor)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">Viewing this report is recorded in the audit log.</p>
        </div>
      )}
    </>
  );
}
