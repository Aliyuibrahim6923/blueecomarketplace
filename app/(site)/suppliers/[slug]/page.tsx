import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VerificationBadge } from "@/components/marketplace/badges";
import { ProductCard } from "@/components/marketplace/product-card";
import { Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui/primitives";
import { ReportForm } from "@/features/marketplace/report-form";
import { getViewer } from "@/lib/auth";
import { BUSINESS_CATEGORIES, stateName } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { Business, SearchResult } from "@/types/domain";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Supplier: ${slug.replace(/-/g, " ")}` };
}

export default async function SupplierPage({ params }: Params) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("businesses").select("*").eq("slug", slug).maybeSingle();
  if (!data) notFound();
  const business = data as Business;

  const [{ data: products }, { data: reviews }, { data: contact }, viewer] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, description, product_state, pricing_type, price_minor, currency, unit, available_quantity, min_order_quantity, location_state, location_city, available_from, delivery_options, published_at, expires_at, category:categories(slug, name), images:product_images(storage_path, sort_order)")
      .eq("business_id", business.id)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(24),
    supabase
      .from("reviews")
      .select("id, rating, comment, created_at")
      .eq("business_id", business.id)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.rpc("get_business_contact", { p_business_id: business.id }),
    getViewer(),
  ]);

  const now = new Date();
  const listings: SearchResult[] = (products ?? [])
    .filter((p) => !p.expires_at || new Date(p.expires_at as string) > now)
    .map((p) => {
      const cat = (Array.isArray(p.category) ? p.category[0] : p.category) as { slug: string; name: string } | null;
      const imgs = ((p.images ?? []) as { storage_path: string; sort_order: number }[]).sort((a, b) => a.sort_order - b.sort_order);
      return {
        ...(p as unknown as SearchResult),
        category_slug: cat?.slug ?? "",
        category_name: cat?.name ?? "",
        business_id: business.id,
        business_name: business.name,
        business_slug: business.slug,
        business_verification: business.verification_status,
        cover_image_path: imgs[0]?.storage_path ?? null,
        total_count: 0,
      };
    });
  const contactRow = (contact as { contact_phone: string | null; contact_email: string | null; whatsapp: string | null }[] | null)?.[0];
  const ratings = (reviews ?? []).map((r) => r.rating as number);
  const avg = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null;
  const categoryLabel = BUSINESS_CATEGORIES.find((c) => c.value === business.business_category)?.label;

  return (
    <div className="container-page py-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ocean-950">{business.name}</h1>
          <p className="text-sm text-muted-foreground">
            {categoryLabel} · {[business.city, stateName(business.state_code)].filter(Boolean).join(", ")} · on BlueMarket since{" "}
            {formatDate(business.created_at)}
          </p>
        </div>
        <VerificationBadge status={business.verification_status} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="listings-h">
          <h2 id="listings-h" className="text-lg font-semibold text-ocean-900">
            Current listings
          </h2>
          {listings.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="No active listings" description="This business has nothing listed right now." />
            </div>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {listings.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {business.description ? <p className="whitespace-pre-line">{business.description}</p> : <p className="text-muted-foreground">No description yet.</p>}
              {business.service_states.length ? (
                <p>
                  <span className="font-medium">Serves:</span> {business.service_states.map(stateName).join(", ")}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {business.verification_status === "verified"
                  ? `Reviewed by BlueMarket operations on ${formatDate(business.verified_at)}. This is not a government licence or endorsement.`
                  : "Business details are self-declared and have not been reviewed."}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {contactRow && (contactRow.contact_phone || contactRow.contact_email || contactRow.whatsapp) ? (
                <>
                  {contactRow.contact_phone ? <p>Phone: <a className="underline" href={`tel:${contactRow.contact_phone}`}>{contactRow.contact_phone}</a></p> : null}
                  {contactRow.whatsapp ? <p>WhatsApp: {contactRow.whatsapp}</p> : null}
                  {contactRow.contact_email ? <p>Email: <a className="underline" href={`mailto:${contactRow.contact_email}`}>{contactRow.contact_email}</a></p> : null}
                </>
              ) : (
                <p className="text-muted-foreground">Contact details are shared after you send an enquiry or order.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Reviews {avg ? `· ★ ${avg} (${ratings.length})` : ""}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {(reviews ?? []).length === 0 ? (
                <p className="text-muted-foreground">No reviews yet. Only buyers with completed orders can review.</p>
              ) : (
                (reviews ?? []).map((r) => (
                  <div key={r.id as string} className="border-b border-border pb-2 last:border-0">
                    <p aria-label={`${r.rating} out of 5`}>{"★".repeat(r.rating as number)}{"☆".repeat(5 - (r.rating as number))}</p>
                    {r.comment ? <p className="mt-1">{r.comment as string}</p> : null}
                    <p className="text-xs text-muted-foreground">{formatDate(r.created_at as string)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          {viewer ? <ReportForm targetType="business" targetId={business.id} label="Report this business" /> : null}
        </aside>
      </div>
    </div>
  );
}
