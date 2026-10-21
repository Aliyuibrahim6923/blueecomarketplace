import type { Metadata } from "next";
import Link from "next/link";
import { GenericStatusBadge } from "@/components/marketplace/badges";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { logisticsBusinesses, requireViewer } from "@/lib/auth";
import { LOGISTICS_SERVICE_TYPES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "My services" };

export default async function ServicesPage() {
  const viewer = await requireViewer("/dashboard/logistics/services");
  const ids = logisticsBusinesses(viewer).map((b) => b.id);
  const supabase = await createClient();
  const { data } = ids.length
    ? await supabase
        .from("logistics_services")
        .select("id, title, service_type, status, updated_at, moderation_note")
        .in("business_id", ids)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
    : { data: [] };
  return (
    <>
      <PageHeader
        title="My services"
        actions={
          ids.length ? (
            <Button asChild variant="teal">
              <Link href="/dashboard/logistics/services/new">New service</Link>
            </Button>
          ) : null
        }
      />
      {!data?.length ? (
        <EmptyState title="No services yet" description="List delivery, refrigerated transport, cold storage or ice supply." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Service</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th>Updated</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.id as string}>
                <Td>
                  <Link href={`/dashboard/logistics/services/${s.id as string}`} className="font-medium text-ocean-900 hover:underline">
                    {s.title as string}
                  </Link>
                  {s.status === "hidden" && s.moderation_note ? <p className="text-xs text-red-700">Moderator: {s.moderation_note as string}</p> : null}
                </Td>
                <Td>{LOGISTICS_SERVICE_TYPES.find((t) => t.value === s.service_type)?.label}</Td>
                <Td>
                  <GenericStatusBadge status={s.status as string} />
                </Td>
                <Td>{formatDate(s.updated_at as string)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
