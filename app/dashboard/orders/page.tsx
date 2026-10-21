import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatusBadge } from "@/components/marketplace/badges";
import { EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { requireViewer } from "@/lib/auth";
import { formatMinor } from "@/lib/money";
import { ORDER_STATUSES, ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orders/state-machine";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await requireViewer("/dashboard/orders");
  const sellerIds = viewer.businesses.filter((b) => b.is_supplier).map((b) => b.id);
  const view = sp.view === "selling" && sellerIds.length ? "selling" : "buying";
  const status = (ORDER_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as OrderStatus) : undefined;

  const supabase = await createClient();
  let q = supabase
    .from("orders")
    .select("id, order_number, status, total_minor, currency, created_at, seller:businesses!orders_seller_business_id_fkey(name)")
    .order("created_at", { ascending: false })
    .limit(100);
  q = view === "selling" ? q.in("seller_business_id", sellerIds) : q.eq("buyer_id", viewer.id);
  if (status) q = q.eq("status", status);
  const { data } = await q;

  return (
    <>
      <PageHeader title={view === "selling" ? "Incoming orders" : "My orders"} />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Link href="/dashboard/orders?view=buying" className={`rounded-md border px-3 py-1.5 ${view === "buying" ? "border-ocean-700 bg-ocean-50" : "border-border bg-white"}`}>
          Buying
        </Link>
        {sellerIds.length ? (
          <Link href="/dashboard/orders?view=selling" className={`rounded-md border px-3 py-1.5 ${view === "selling" ? "border-ocean-700 bg-ocean-50" : "border-border bg-white"}`}>
            Selling
          </Link>
        ) : null}
        <form className="ml-auto flex items-center gap-2" action="/dashboard/orders">
          <input type="hidden" name="view" value={view} />
          <label htmlFor="o-status" className="sr-only">
            Status
          </label>
          <select id="o-status" name="status" defaultValue={status ?? ""} className="h-9 rounded-md border border-border bg-white px-2">
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <button className="h-9 rounded-md border border-border bg-white px-3">Filter</button>
        </form>
      </div>
      {!data?.length ? (
        <EmptyState title="No orders yet" description={view === "buying" ? "Orders you place appear here." : "Orders from buyers appear here."} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Order</Th>
              <Th>{view === "selling" ? "Placed" : "Supplier"}</Th>
              <Th>Total</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((o) => {
              const seller = (Array.isArray(o.seller) ? o.seller[0] : o.seller) as { name: string } | null;
              return (
                <tr key={o.id as string}>
                  <Td>
                    <Link href={`/dashboard/orders/${o.id as string}`} className="font-medium text-ocean-900 hover:underline">
                      {o.order_number as string}
                    </Link>
                    <p className="text-xs text-muted-foreground">{formatDate(o.created_at as string)}</p>
                  </Td>
                  <Td>{view === "selling" ? formatDate(o.created_at as string) : seller?.name}</Td>
                  <Td className="tabular-nums">{formatMinor(o.total_minor as number, o.currency as string)}</Td>
                  <Td>
                    <OrderStatusBadge status={o.status as OrderStatus} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
