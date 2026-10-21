import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/form/action-form";
import { SubmitButton } from "@/components/form/fields";
import { GenericStatusBadge } from "@/components/marketplace/badges";
import { Price } from "@/components/marketplace/product-card";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { refreshListingAction } from "@/features/products/actions";
import { requireViewer, supplierBusinesses } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatQuantity } from "@/lib/utils";
import type { Product } from "@/types/domain";

export const metadata: Metadata = { title: "My listings" };

export default async function ListingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await requireViewer("/dashboard/supplier/listings");
  const ids = supplierBusinesses(viewer).map((b) => b.id);
  const supabase = await createClient();
  const status = ["draft", "published", "paused", "archived", "hidden"].includes(sp.status ?? "") ? sp.status : undefined;

  let q = supabase
    .from("products")
    .select("id, name, status, pricing_type, price_minor, currency, unit, available_quantity, expires_at, updated_at, moderation_note, business_id")
    .in("business_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (status) q = q.eq("status", status);
  const { data } = await q;
  const rows = (data ?? []) as Product[];
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Listings"
        description="Published listings expire after the set period unless you confirm they are still available."
        actions={
          ids.length ? (
            <Button asChild variant="teal">
              <Link href="/dashboard/supplier/listings/new">New listing</Link>
            </Button>
          ) : null
        }
      />
      <nav className="mb-4 flex flex-wrap gap-2 text-sm" aria-label="Filter by status">
        {[undefined, "published", "draft", "paused", "archived", "hidden"].map((s) => (
          <Link key={s ?? "all"} href={s ? `/dashboard/supplier/listings?status=${s}` : "/dashboard/supplier/listings"} className={`rounded-full border px-3 py-1 ${status === s ? "border-ocean-700 bg-ocean-50" : "border-border bg-white"}`}>
            {s ? s[0]!.toUpperCase() + s.slice(1) : "All"}
          </Link>
        ))}
      </nav>
      {!ids.length ? (
        <EmptyState title="Create a supplier business first" action={<Button asChild><Link href="/dashboard/business">Business profile</Link></Button>} />
      ) : rows.length === 0 ? (
        <EmptyState title="No listings here" description="Create a listing to appear in the marketplace." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Listing</Th>
              <Th>Price</Th>
              <Th>Available</Th>
              <Th>Status</Th>
              <Th>Visible until</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const expired = p.status === "published" && p.expires_at && new Date(p.expires_at) <= now;
              return (
                <tr key={p.id}>
                  <Td>
                    <Link href={`/dashboard/supplier/listings/${p.id}`} className="font-medium text-ocean-900 hover:underline">
                      {p.name}
                    </Link>
                    {p.status === "hidden" && p.moderation_note ? <p className="text-xs text-red-700">Moderator: {p.moderation_note}</p> : null}
                  </Td>
                  <Td>
                    <Price priceMinor={p.price_minor} currency={p.currency} unit={p.unit} pricingType={p.pricing_type} />
                  </Td>
                  <Td>{formatQuantity(p.available_quantity, p.unit)}</Td>
                  <Td>{expired ? <Badge tone="warning">Expired</Badge> : <GenericStatusBadge status={p.status} />}</Td>
                  <Td>{p.status === "published" ? formatDate(p.expires_at) : "—"}</Td>
                  <Td>
                    {p.status === "published" ? (
                      <ActionForm action={refreshListingAction} hidden={{ productId: p.id }}>
                        <SubmitButton size="sm" variant="outline" pendingText="…">
                          Still available
                        </SubmitButton>
                      </ActionForm>
                    ) : null}
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
