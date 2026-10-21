import type { Metadata } from "next";
import Link from "next/link";
import { GenericStatusBadge } from "@/components/marketplace/badges";
import { EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, humanize } from "@/lib/utils";

export const metadata: Metadata = { title: "Disputes" };

export default async function DisputesPage() {
  await requireViewer("/dashboard/disputes");
  const supabase = await createClient();
  // RLS returns only disputes the viewer participates in (or all, for admins).
  const { data } = await supabase
    .from("disputes")
    .select("id, category, status, created_at, order:orders(order_number)")
    .order("created_at", { ascending: false })
    .limit(100);
  return (
    <>
      <PageHeader title="Disputes" description="Open a dispute from the order page if something goes wrong after payment." />
      {!data?.length ? (
        <EmptyState title="No disputes" description="Hopefully it stays that way." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Order</Th>
              <Th>Reason</Th>
              <Th>Status</Th>
              <Th>Opened</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => {
              const order = (Array.isArray(d.order) ? d.order[0] : d.order) as { order_number: string } | null;
              return (
                <tr key={d.id as string}>
                  <Td>
                    <Link href={`/dashboard/disputes/${d.id as string}`} className="font-medium text-ocean-900 hover:underline">
                      {order?.order_number ?? "Order"}
                    </Link>
                  </Td>
                  <Td>{humanize(d.category as string)}</Td>
                  <Td>
                    <GenericStatusBadge status={d.status as string} />
                  </Td>
                  <Td>{formatDate(d.created_at as string)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
