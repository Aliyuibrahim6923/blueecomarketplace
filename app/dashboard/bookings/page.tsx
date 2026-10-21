import type { Metadata } from "next";
import Link from "next/link";
import { GenericStatusBadge } from "@/components/marketplace/badges";
import { EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { logisticsBusinesses, requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Logistics bookings" };

export default async function BookingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await requireViewer("/dashboard/bookings");
  const providerIds = logisticsBusinesses(viewer).map((b) => b.id);
  const view = sp.view === "provider" && providerIds.length ? "provider" : "requested";
  const supabase = await createClient();
  let q = supabase
    .from("logistics_bookings")
    .select("id, status, requested_date, pickup_location, dropoff_location, created_at, service:logistics_services(title)")
    .order("created_at", { ascending: false })
    .limit(100);
  q = view === "provider" ? q.in("provider_business_id", providerIds) : q.eq("requester_id", viewer.id);
  const { data } = await q;

  return (
    <>
      <PageHeader title={view === "provider" ? "Booking requests" : "My logistics bookings"} />
      <div className="mb-4 flex gap-2 text-sm">
        <Link href="/dashboard/bookings?view=requested" className={`rounded-md border px-3 py-1.5 ${view === "requested" ? "border-ocean-700 bg-ocean-50" : "border-border bg-white"}`}>
          Requested by me
        </Link>
        {providerIds.length ? (
          <Link href="/dashboard/bookings?view=provider" className={`rounded-md border px-3 py-1.5 ${view === "provider" ? "border-ocean-700 bg-ocean-50" : "border-border bg-white"}`}>
            For my services
          </Link>
        ) : null}
      </div>
      {!data?.length ? (
        <EmptyState
          title="No bookings"
          description={view === "provider" ? "Requests for your services appear here." : "Book delivery or cold storage from the logistics directory."}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Service</Th>
              <Th>Route</Th>
              <Th>Date</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((b) => {
              const s = (Array.isArray(b.service) ? b.service[0] : b.service) as { title: string } | null;
              return (
                <tr key={b.id as string}>
                  <Td>
                    <Link href={`/dashboard/bookings/${b.id as string}`} className="font-medium text-ocean-900 hover:underline">
                      {s?.title ?? "Service"}
                    </Link>
                  </Td>
                  <Td>
                    {b.pickup_location as string} → {b.dropoff_location as string}
                  </Td>
                  <Td>{formatDate(b.requested_date as string)}</Td>
                  <Td>
                    <GenericStatusBadge status={b.status as string} />
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
