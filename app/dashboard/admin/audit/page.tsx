import type { Metadata } from "next";
import Link from "next/link";
import { Badge, EmptyState, Input, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, humanize } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit log" };
const PAGE = 100;

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const entity = (sp.entity ?? "").replace(/[^a-z_]/g, "").slice(0, 40);
  const supabase = await createClient();
  let q = supabase
    .from("audit_logs")
    .select("id, actor_id, action, entity_type, entity_id, outcome, metadata, created_at")
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (entity) q = q.eq("entity_type", entity);
  const { data } = await q;

  return (
    <>
      <PageHeader title="Audit log" description="Append-only record of privileged actions, verification decisions, payment events and dispute outcomes." />
      <form className="mb-4 flex gap-2" action="/dashboard/admin/audit">
        <label htmlFor="a-e" className="sr-only">Entity type</label>
        <Input id="a-e" name="entity" defaultValue={entity} placeholder="Entity type, e.g. business" className="w-64" />
        <button className="h-10 rounded-md border border-border bg-white px-4 text-sm">Filter</button>
      </form>
      {!data?.length ? (
        <EmptyState title="No entries" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Action</Th>
              <Th>Entity</Th>
              <Th>Actor</Th>
              <Th>Details</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((a) => (
              <tr key={a.id as number}>
                <Td className="whitespace-nowrap">{formatDateTime(a.created_at as string)}</Td>
                <Td>
                  {humanize(a.action as string)} {a.outcome !== "success" ? <Badge tone="danger">{a.outcome as string}</Badge> : null}
                </Td>
                <Td>
                  {a.entity_type as string}
                  <p className="font-mono text-[11px] text-muted-foreground">{(a.entity_id as string | null) ?? ""}</p>
                </Td>
                <Td className="font-mono text-[11px]">
                  {a.actor_id ? <Link href={`/dashboard/admin/users?id=${a.actor_id as string}`} className="underline">{(a.actor_id as string).slice(0, 8)}</Link> : "system"}
                </Td>
                <Td>
                  <details>
                    <summary className="cursor-pointer text-xs">View</summary>
                    <pre className="mt-1 max-w-md overflow-x-auto whitespace-pre-wrap text-[11px]">{JSON.stringify(a.metadata, null, 2)}</pre>
                  </details>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <div className="mt-4 flex justify-between text-sm">
        {page > 1 ? <Link href={`/dashboard/admin/audit?page=${page - 1}${entity ? `&entity=${entity}` : ""}`} className="underline">Newer</Link> : <span />}
        {(data?.length ?? 0) === PAGE ? <Link href={`/dashboard/admin/audit?page=${page + 1}${entity ? `&entity=${entity}` : ""}`} className="underline">Older</Link> : null}
      </div>
    </>
  );
}
