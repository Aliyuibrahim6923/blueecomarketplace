import type { Metadata } from "next";
import Link from "next/link";
import { GenericStatusBadge } from "@/components/marketplace/badges";
import { Badge, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Enquiries & quotations" };

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await requireViewer("/dashboard/enquiries");
  const sellerIds = viewer.businesses.filter((b) => b.is_supplier).map((b) => b.id);
  const view = sp.view === "selling" && sellerIds.length ? "selling" : "buying";
  const supabase = await createClient();
  let q = supabase
    .from("enquiries")
    .select("id, subject, kind, status, created_at, updated_at, supplier:businesses!enquiries_supplier_business_id_fkey(name)")
    .order("updated_at", { ascending: false })
    .limit(100);
  q = view === "selling" ? q.in("supplier_business_id", sellerIds) : q.eq("buyer_id", viewer.id);
  const { data } = await q;

  return (
    <>
      <PageHeader title={view === "selling" ? "Incoming enquiries" : "My enquiries & quotations"} />
      <div className="mb-4 flex gap-2 text-sm">
        <Link href="/dashboard/enquiries?view=buying" className={`rounded-md border px-3 py-1.5 ${view === "buying" ? "border-ocean-700 bg-ocean-50" : "border-border bg-white"}`}>
          Sent
        </Link>
        {sellerIds.length ? (
          <Link href="/dashboard/enquiries?view=selling" className={`rounded-md border px-3 py-1.5 ${view === "selling" ? "border-ocean-700 bg-ocean-50" : "border-border bg-white"}`}>
            Received
          </Link>
        ) : null}
      </div>
      {!data?.length ? (
        <EmptyState
          title="No enquiries yet"
          description={view === "buying" ? "Ask a supplier a question or request a quotation from any listing." : "Buyer questions and quotation requests appear here."}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Subject</Th>
              <Th>{view === "buying" ? "Supplier" : "Type"}</Th>
              <Th>Status</Th>
              <Th>Last activity</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((e) => {
              const s = (Array.isArray(e.supplier) ? e.supplier[0] : e.supplier) as { name: string } | null;
              return (
                <tr key={e.id as string}>
                  <Td>
                    <Link href={`/dashboard/enquiries/${e.id as string}`} className="font-medium text-ocean-900 hover:underline">
                      {e.subject as string}
                    </Link>
                  </Td>
                  <Td>{view === "buying" ? s?.name : <Badge tone={e.kind === "quote_request" ? "info" : "neutral"}>{e.kind === "quote_request" ? "Quote request" : "Question"}</Badge>}</Td>
                  <Td>
                    <GenericStatusBadge status={e.status as string} />
                  </Td>
                  <Td>{formatDate(e.updated_at as string)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
