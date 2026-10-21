import type { Metadata } from "next";
import Link from "next/link";
import { StatCard } from "@/components/charts/bar-chart";
import { OrderStatusBadge } from "@/components/marketplace/badges";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader } from "@/components/ui/primitives";
import { hasRole, requireViewer } from "@/lib/auth";
import { formatMinor } from "@/lib/money";
import type { OrderStatus } from "@/lib/orders/state-machine";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await requireViewer();
  const supabase = await createClient();
  const sellerIds = viewer.businesses.filter((b) => b.is_supplier).map((b) => b.id);

  const [{ data: myOrders }, { data: incoming }, { count: openEnquiries }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, status, total_minor, currency, created_at")
      .eq("buyer_id", viewer.id)
      .order("created_at", { ascending: false })
      .limit(5),
    sellerIds.length
      ? supabase
          .from("orders")
          .select("id, order_number, status, total_minor, currency, created_at")
          .in("seller_business_id", sellerIds)
          .in("status", ["requested", "accepted", "awaiting_payment", "paid", "preparing", "dispatched", "disputed"])
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] as never[] }),
    sellerIds.length
      ? supabase.from("enquiries").select("id", { count: "exact", head: true }).in("supplier_business_id", sellerIds).neq("status", "closed")
      : Promise.resolve({ count: 0 }),
  ]);

  const wantsToSell = hasRole(viewer, "supplier") || hasRole(viewer, "logistics_provider");

  return (
    <>
      <PageHeader title={`Welcome, ${viewer.profile.full_name.split(" ")[0] || "there"}`} description="Your orders, enquiries and next steps." />
      {sp.denied ? <Alert tone="warning" className="mb-4">You do not have access to that area.</Alert> : null}
      {sp.password === "updated" ? <Alert tone="success" className="mb-4">Your password was updated.</Alert> : null}

      {wantsToSell && viewer.businesses.length === 0 ? (
        <Alert tone="info" className="mb-6" title="Create your business profile">
          You need a business profile before you can publish listings or services.{" "}
          <Link href="/dashboard/business" className="font-semibold underline">
            Set it up now
          </Link>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="My recent orders" value={myOrders?.length ?? 0} />
        <StatCard label="Incoming orders in progress" value={incoming?.length ?? 0} />
        <StatCard label="Open enquiries to answer" value={openEnquiries ?? 0} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <OrdersCard title="My orders" orders={myOrders ?? []} empty="You have not placed any orders yet." href="/dashboard/orders?view=buying" />
        {sellerIds.length ? (
          <OrdersCard title="Incoming orders" orders={incoming ?? []} empty="No orders need your attention." href="/dashboard/orders?view=selling" />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Start buying</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>Search fresh fish, frozen seafood, aquaculture and processed products from suppliers across Nigeria.</p>
              <Button asChild>
                <Link href="/marketplace">Browse the marketplace</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

type OrderRow = { id: string; order_number: string; status: OrderStatus; total_minor: number; currency: string; created_at: string };

function OrdersCard({ title, orders, empty, href }: { title: string; orders: OrderRow[]; empty: string; href: string }) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <Link href={href} className="text-sm font-semibold text-ocean-700 hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <EmptyState title={empty} />
        ) : (
          <ul className="divide-y divide-border">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <Link href={`/dashboard/orders/${o.id}`} className="font-medium text-ocean-900 hover:underline">
                    {o.order_number}
                  </Link>
                  <p className="text-xs text-muted-foreground">{formatDate(o.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm tabular-nums">{formatMinor(o.total_minor, o.currency)}</span>
                  <OrderStatusBadge status={o.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
