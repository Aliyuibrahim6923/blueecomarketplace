import type { Metadata } from "next";
import Link from "next/link";
import { BarChart, StatCard } from "@/components/charts/bar-chart";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireViewer, supplierBusinesses } from "@/lib/auth";
import { formatMinor } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Supplier overview" };

type Insights = {
  listings: Record<string, number>;
  orders: Record<string, number>;
  open_enquiries: number;
  average_rating: number | null;
  review_count: number;
  top_products: { id: string; name: string; views: number; saves: number; enquiries: number; orders: number }[];
};

export default async function SupplierOverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await requireViewer("/dashboard/supplier");
  const businesses = supplierBusinesses(viewer);
  if (businesses.length === 0) {
    return (
      <>
        <PageHeader title="Supplier overview" />
        <EmptyState
          title="No supplier business yet"
          description="Create a business profile and tick “sells products” to start listing."
          action={
            <Button asChild>
              <Link href="/dashboard/business">Create business profile</Link>
            </Button>
          }
        />
      </>
    );
  }
  const business = businesses.find((b) => b.id === sp.business) ?? businesses[0]!;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("supplier_insights", { p_business_id: business.id });
  const insights = data as Insights | null;

  return (
    <>
      <PageHeader
        title="Supplier overview"
        description={business.name}
        actions={
          <Button asChild variant="teal">
            <Link href="/dashboard/supplier/listings/new">New listing</Link>
          </Button>
        }
      />
      {businesses.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          {businesses.map((b) => (
            <Link key={b.id} href={`/dashboard/supplier?business=${b.id}`} className={`rounded-md border px-3 py-1.5 ${b.id === business.id ? "border-ocean-700 bg-ocean-50" : "border-border bg-white"}`}>
              {b.name}
            </Link>
          ))}
        </div>
      ) : null}
      {business.verification_status !== "verified" ? (
        <Alert tone="info" className="mb-4">
          Verified businesses earn more buyer trust.{" "}
          <Link href={`/dashboard/business?id=${business.id}`} className="font-semibold underline">
            Submit verification documents
          </Link>
        </Alert>
      ) : null}
      {error || !insights ? (
        <Alert tone="danger">Insights are unavailable right now.</Alert>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Published listings" value={insights.listings.published ?? 0} hint={`${insights.listings.expired ?? 0} expired — refresh to show again`} />
            <StatCard label="New order requests" value={insights.orders.requested ?? 0} />
            <StatCard label="Orders in progress" value={insights.orders.in_progress ?? 0} />
            <StatCard label="Open enquiries" value={insights.open_enquiries} />
            <StatCard label="Completed orders" value={insights.orders.completed ?? 0} />
            <StatCard label="Completed sales (items)" value={formatMinor(insights.orders.completed_value_minor ?? 0)} hint="Item value of completed orders, before fees" />
            <StatCard label="Last 30 days" value={formatMinor(insights.orders.last_30_days_value_minor ?? 0)} />
            <StatCard label="Rating" value={insights.average_rating ? `★ ${insights.average_rating}` : "—"} hint={`${insights.review_count} reviews`} />
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <BarChart title="Listing views" data={insights.top_products.map((p) => ({ label: p.name, value: p.views }))} />
            <BarChart title="Orders per listing" data={insights.top_products.filter((p) => p.orders > 0).map((p) => ({ label: p.name, value: p.orders }))} emptyText="No orders yet." />
          </div>
        </>
      )}
    </>
  );
}
