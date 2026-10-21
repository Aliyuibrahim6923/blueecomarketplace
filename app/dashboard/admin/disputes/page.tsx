import type { Metadata } from "next";
import Link from "next/link";
import { GenericStatusBadge } from "@/components/marketplace/badges";
import { EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import { formatDate, humanize, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Dispute cases" };

export default async function AdminDisputesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const showClosed = sp.closed === "1";
  const supabase = await createClient();
  let q = supabase
    .from("disputes")
    .select("id, category, status, created_at, updated_at, order:orders(order_number, total_minor)")
    .order("created_at", { ascending: true })
    .limit(200);
  q = showClosed ? q.in("status", ["resolved", "rejected"]) : q.in("status", ["open", "under_review", "awaiting_evidence"]);
  const { data } = await q;
  return (
    <>
      <PageHeader
        title="Dispute cases"
        description="Oldest first. Open a case to message parties, view evidence and record a decision."
        actions={
          <Link href={showClosed ? "/dashboard/admin/disputes" : "/dashboard/admin/disputes?closed=1"} className="text-sm text-ocean-700 underline">
            {showClosed ? "Show open cases" : "Show closed cases"}
          </Link>
        }
      />
      {!data?.length ? (
        <EmptyState title={showClosed ? "No closed cases" : "No open cases"} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Order</Th>
              <Th>Category</Th>
              <Th>Status</Th>
              <Th>Opened</Th>
              <Th>Age</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => {
              const o = (Array.isArray(d.order) ? d.order[0] : d.order) as { order_number: string } | null;
              return (
                <tr key={d.id as string}>
                  <Td>
                    <Link href={`/dashboard/disputes/${d.id as string}`} className="font-medium text-ocean-900 hover:underline">
                      {o?.order_number}
                    </Link>
                  </Td>
                  <Td>{humanize(d.category as string)}</Td>
                  <Td>
                    <GenericStatusBadge status={d.status as string} />
                  </Td>
                  <Td>{formatDate(d.created_at as string)}</Td>
                  <Td>{timeAgo(d.created_at as string)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
