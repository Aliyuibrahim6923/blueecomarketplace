import type { Metadata } from "next";
import Link from "next/link";
import { GenericStatusBadge, VerificationBadge } from "@/components/marketplace/badges";
import { EmptyState, Input, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { stateName, VERIFICATION_DOCUMENT_TYPES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { VerificationStatus } from "@/types/domain";

export const metadata: Metadata = { title: "Verification queue" };

export default async function AdminBusinessesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const supabase = await createClient();
  const [{ data: pending }, { data: businesses }] = await Promise.all([
    supabase
      .from("business_verification_requests")
      .select("id, document_type, created_at, business:businesses(id, name, state_code)")
      .eq("status", "pending_review")
      .order("created_at"),
    (() => {
      let query = supabase
        .from("businesses")
        .select("id, name, slug, state_code, verification_status, status, is_supplier, is_logistics_provider, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (q) query = query.ilike("name", `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`);
      return query;
    })(),
  ]);

  return (
    <>
      <PageHeader title="Businesses & verification" description="Oldest requests first. Decisions are recorded in the audit log and the business is notified." />
      <h2 className="mb-2 text-lg font-semibold text-ocean-900">Pending verification ({pending?.length ?? 0})</h2>
      {!pending?.length ? (
        <EmptyState title="Queue is empty" />
      ) : (
        <Table className="mb-8">
          <thead>
            <tr>
              <Th>Business</Th>
              <Th>Document</Th>
              <Th>State</Th>
              <Th>Submitted</Th>
            </tr>
          </thead>
          <tbody>
            {pending.map((r) => {
              const b = (Array.isArray(r.business) ? r.business[0] : r.business) as { id: string; name: string; state_code: string } | null;
              return (
                <tr key={r.id as string}>
                  <Td>
                    <Link href={`/dashboard/admin/businesses/${b?.id}`} className="font-medium text-ocean-900 hover:underline">
                      {b?.name}
                    </Link>
                  </Td>
                  <Td>{VERIFICATION_DOCUMENT_TYPES.find((d) => d.value === r.document_type)?.label}</Td>
                  <Td>{stateName(b?.state_code)}</Td>
                  <Td>{formatDate(r.created_at as string)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <div className="mb-2 mt-8 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-ocean-900">All businesses</h2>
        <form action="/dashboard/admin/businesses" className="flex gap-2">
          <label htmlFor="b-q" className="sr-only">Search businesses</label>
          <Input id="b-q" name="q" defaultValue={q} placeholder="Search by name" className="w-56" />
        </form>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Type</Th>
            <Th>Verification</Th>
            <Th>Status</Th>
            <Th>Joined</Th>
          </tr>
        </thead>
        <tbody>
          {(businesses ?? []).map((b) => (
            <tr key={b.id as string}>
              <Td>
                <Link href={`/dashboard/admin/businesses/${b.id as string}`} className="font-medium text-ocean-900 hover:underline">
                  {b.name as string}
                </Link>
                <p className="text-xs text-muted-foreground">{stateName(b.state_code as string)}</p>
              </Td>
              <Td>{[b.is_supplier ? "Supplier" : null, b.is_logistics_provider ? "Logistics" : null].filter(Boolean).join(", ") || "Buyer org"}</Td>
              <Td>
                <VerificationBadge status={b.verification_status as VerificationStatus} />
              </Td>
              <Td>
                <GenericStatusBadge status={b.status as string} />
              </Td>
              <Td>{formatDate(b.created_at as string)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
