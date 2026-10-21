import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatusBadge } from "@/components/marketplace/badges";
import { EmptyState, Input, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { formatMinor } from "@/lib/money";
import { ORDER_STATUSES, ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orders/state-machine";
import { createClient } from "@/lib/supabase/server";
import { formatDate, humanize } from "@/lib/utils";

export const metadata: Metadata = { title: "Order monitoring" };

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const status = (ORDER_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as OrderStatus) : undefined;
  const number = (sp.q ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 30);
  const supabase = await createClient();
  let q = supabase
    .from("orders")
    .select("id, order_number, status, total_minor, currency, payment_provider, created_at, seller:businesses!orders_seller_business_id_fkey(name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) q = q.eq("status", status);
  if (number) q = q.ilike("order_number", `%${number}%`);
  const { data } = await q;

  return (
    <>
      <PageHeader title="Order monitoring" />
      <form className="mb-4 flex flex-wrap gap-2" action="/dashboard/admin/orders">
        <label htmlFor="ao-q" className="sr-only">Order number</label>
        <Input id="ao-q" name="q" defaultValue={number} placeholder="Order number" className="w-48" />
        <label htmlFor="ao-s" className="sr-only">Status</label>
        <select id="ao-s" name="status" defaultValue={status ?? ""} className="h-10 rounded-md border border-border bg-white px-2 text-sm">
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <button className="h-10 rounded-md border border-border bg-white px-4 text-sm">Filter</button>
      </form>
      {!data?.length ? (
        <EmptyState title="No orders" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Order</Th>
              <Th>Seller</Th>
              <Th>Total</Th>
              <Th>Payment</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((o) => {
              const s = (Array.isArray(o.seller) ? o.seller[0] : o.seller) as { name: string } | null;
              return (
                <tr key={o.id as string}>
                  <Td>
                    <Link href={`/dashboard/orders/${o.id as string}`} className="font-medium text-ocean-900 hover:underline">
                      {o.order_number as string}
                    </Link>
                    <p className="text-xs text-muted-foreground">{formatDate(o.created_at as string)}</p>
                  </Td>
                  <Td>{s?.name}</Td>
                  <Td className="tabular-nums">{formatMinor(o.total_minor as number, o.currency as string)}</Td>
                  <Td>{o.payment_provider ? humanize(o.payment_provider as string) : "—"}</Td>
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
