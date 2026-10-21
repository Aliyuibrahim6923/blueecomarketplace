import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/form/action-form";
import { SubmitButton } from "@/components/form/fields";
import { Price } from "@/components/marketplace/product-card";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { toggleSavedProductAction } from "@/features/marketplace/actions";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Saved products" };

export default async function SavedPage() {
  const viewer = await requireViewer("/dashboard/saved");
  const supabase = await createClient();
  const { data } = await supabase
    .from("saved_products")
    .select("created_at, product:products(id, name, status, price_minor, currency, unit, pricing_type, expires_at)")
    .eq("user_id", viewer.id)
    .order("created_at", { ascending: false });

  const rows = (data ?? [])
    .map((r) => (Array.isArray(r.product) ? r.product[0] : r.product))
    .filter(Boolean) as { id: string; name: string; status: string; price_minor: number | null; currency: string; unit: string; pricing_type: string; expires_at: string | null }[];

  return (
    <>
      <PageHeader title="Saved products" />
      {rows.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          description="Use “Save for later” on a listing to keep it here."
          action={
            <Button asChild>
              <Link href="/marketplace">Browse the marketplace</Link>
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-white">
          {rows.map((p) => {
            const available = p.status === "published" && (!p.expires_at || new Date(p.expires_at) > new Date());
            return (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <Link href={`/products/${p.id}`} className="font-medium text-ocean-900 hover:underline">
                    {p.name}
                  </Link>
                  <p className="text-sm">
                    {available ? <Price priceMinor={p.price_minor} currency={p.currency} unit={p.unit} pricingType={p.pricing_type} /> : <span className="text-muted-foreground">No longer available</span>}
                  </p>
                </div>
                <ActionForm action={toggleSavedProductAction} hidden={{ productId: p.id }}>
                  <SubmitButton variant="ghost" size="sm" pendingText="…">
                    Remove
                  </SubmitButton>
                </ActionForm>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
