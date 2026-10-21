import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/form/action-form";
import { SubmitButton, TextField } from "@/components/form/fields";
import { GenericStatusBadge } from "@/components/marketplace/badges";
import { EmptyState, Input, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { moderateAction } from "@/features/admin/actions";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Listing moderation" };

export default async function AdminListingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const kind = sp.kind === "services" ? "services" : "products";
  const supabase = await createClient();

  // Reported targets float to the top.
  const { data: reports } = await supabase
    .from("content_reports")
    .select("target_id")
    .in("status", ["open", "reviewing"])
    .in("target_type", kind === "products" ? ["product"] : ["logistics_service"]);
  const reported = new Set((reports ?? []).map((r) => r.target_id as string));
  const escaped = q.replace(/[%_\\]/g, (m) => `\\${m}`);

  const table = kind === "products" ? "products" : "logistics_services";
  const nameCol = kind === "products" ? "name" : "title";
  let query = supabase
    .from(table)
    .select(`id, ${nameCol}, status, moderation_note, updated_at, business:businesses(name)`)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (q) query = query.ilike(nameCol, `%${escaped}%`);
  if (sp.only === "reported") query = query.in("id", reported.size ? [...reported] : ["00000000-0000-0000-0000-000000000000"]);
  const { data } = await query;
  const rows = ((data ?? []) as unknown as Record<string, unknown>[]).sort(
    (a, b) => Number(reported.has(b.id as string)) - Number(reported.has(a.id as string)),
  );

  return (
    <>
      <PageHeader title="Moderation" description="Hide listings or services that break the marketplace rules. A reason is required and sent to the business." />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Link href="/dashboard/admin/listings" className={`rounded-md border px-3 py-1.5 ${kind === "products" ? "border-ocean-700 bg-ocean-50" : "border-border bg-white"}`}>
          Product listings
        </Link>
        <Link href="/dashboard/admin/listings?kind=services" className={`rounded-md border px-3 py-1.5 ${kind === "services" ? "border-ocean-700 bg-ocean-50" : "border-border bg-white"}`}>
          Logistics services
        </Link>
        <Link href={`/dashboard/admin/listings?kind=${kind}&only=reported`} className="rounded-md border border-border bg-white px-3 py-1.5">
          Reported only ({reported.size})
        </Link>
        <form className="ml-auto" action="/dashboard/admin/listings">
          <input type="hidden" name="kind" value={kind} />
          <label htmlFor="m-q" className="sr-only">Search</label>
          <Input id="m-q" name="q" defaultValue={q} placeholder="Search" className="w-56" />
        </form>
      </div>
      {!rows.length ? (
        <EmptyState title="Nothing to show" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Item</Th>
              <Th>Business</Th>
              <Th>Status</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const b = (Array.isArray(r.business) ? r.business[0] : r.business) as { name: string } | null;
              const hidden = r.status === "hidden";
              const href = kind === "products" ? `/products/${r.id as string}` : `/logistics/${r.id as string}`;
              return (
                <tr key={r.id as string}>
                  <Td>
                    <Link href={href} className="font-medium text-ocean-900 hover:underline">
                      {r[nameCol] as string}
                    </Link>
                    {reported.has(r.id as string) ? <p className="text-xs font-semibold text-red-700">Reported</p> : null}
                    {r.moderation_note ? <p className="text-xs text-muted-foreground">Note: {r.moderation_note as string}</p> : null}
                    <p className="text-xs text-muted-foreground">Updated {formatDate(r.updated_at as string)}</p>
                  </Td>
                  <Td>{b?.name}</Td>
                  <Td>
                    <GenericStatusBadge status={r.status as string} />
                  </Td>
                  <Td className="min-w-64">
                    <ActionForm
                      action={moderateAction}
                      hidden={{ targetId: r.id as string, kind: kind === "products" ? "product" : "logistics_service", action: hidden ? "restore" : "hide" }}
                      confirm={hidden ? "Restore this item as paused?" : "Hide this item from the marketplace?"}
                      className="space-y-2"
                    >
                      <TextField name="reason" label="Reason" required />
                      <SubmitButton size="sm" variant={hidden ? "outline" : "danger"}>
                        {hidden ? "Restore" : "Hide"}
                      </SubmitButton>
                    </ActionForm>
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
