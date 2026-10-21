import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/form/action-form";
import { SelectField, SubmitButton, TextAreaField, TextField } from "@/components/form/fields";
import { HeartIcon, MapPinIcon } from "@/components/icons";
import { SelfDeclared, VerificationBadge } from "@/components/marketplace/badges";
import { Price } from "@/components/marketplace/product-card";
import { ProductImage } from "@/components/marketplace/product-image";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle, Dl } from "@/components/ui/primitives";
import { AddToCart } from "@/features/cart/add-to-cart";
import { createEnquiryAction, toggleSavedProductAction } from "@/features/marketplace/actions";
import { ReportForm } from "@/features/marketplace/report-form";
import { ViewTracker } from "@/features/marketplace/view-tracker";
import { getViewer } from "@/lib/auth";
import { deliveryLabel, NIGERIAN_STATES, stateName } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatQuantity, humanize, timeAgo } from "@/lib/utils";
import type { Business, Product } from "@/types/domain";

type Params = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(id: string) {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("*, category:categories(name, slug), images:product_images(id, storage_path, alt_text, sort_order)")
    .eq("id", id)
    .maybeSingle();
  if (!product) return null;
  const { data: business } = await supabase.from("businesses").select("*").eq("id", product.business_id).maybeSingle();
  return { supabase, product, business: business as Business | null };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const data = await load(id);
  return { title: data ? (data.product.name as string) : "Listing not found" };
}

export default async function ProductPage({ params }: Params) {
  const { id } = await params;
  const data = await load(id);
  if (!data || !data.business) notFound();
  const { supabase, business } = data;
  const product = data.product as Product & {
    category: { name: string; slug: string } | null;
    images: { id: string; storage_path: string; alt_text: string | null; sort_order: number }[];
  };
  const viewer = await getViewer();
  const isMember = !!viewer?.businesses.some((b) => b.id === business.id);
  const isPublic = product.status === "published" && (!product.expires_at || new Date(product.expires_at) > new Date());

  const images = [...(product.images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const [{ data: saved }, { data: rating }] = await Promise.all([
    viewer
      ? supabase.from("saved_products").select("product_id").eq("product_id", product.id).eq("user_id", viewer.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("reviews").select("rating").eq("business_id", business.id).eq("status", "published"),
  ]);
  const ratings = (rating ?? []).map((r) => r.rating as number);
  const avg = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null;

  return (
    <div className="container-page py-8">
      {isPublic && !isMember ? <ViewTracker productId={product.id} /> : null}
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/marketplace" className="hover:underline">
          Marketplace
        </Link>
        {product.category ? (
          <>
            {" / "}
            <Link href={`/marketplace?category=${product.category.slug}`} className="hover:underline">
              {product.category.name}
            </Link>
          </>
        ) : null}
      </nav>

      {!isPublic ? (
        <Alert tone="warning" className="mt-4" title={`This listing is ${product.status === "published" ? "expired" : product.status}`}>
          {isMember
            ? product.status === "hidden"
              ? `Hidden by a moderator: ${product.moderation_note ?? "no note"}. Contact support to appeal.`
              : "Only your business can see it. Publish or refresh it from your dashboard."
            : "It is not currently available to buyers."}
        </Alert>
      ) : null}

      <div className="mt-4 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <section aria-label="Photos" className="space-y-3">
          <ProductImage path={images[0]?.storage_path} alt={images[0]?.alt_text ?? product.name} className="rounded-lg" priority sizes="(min-width: 1024px) 50vw, 100vw" />
          {images.length > 1 ? (
            <ul className="grid grid-cols-4 gap-2">
              {images.slice(1).map((img) => (
                <li key={img.id}>
                  <ProductImage path={img.storage_path} alt={img.alt_text ?? product.name} className="rounded-md" sizes="25vw" />
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="space-y-5">
          <div>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="info">{humanize(product.product_state)}</Badge>
              {product.category ? <Badge>{product.category.name}</Badge> : null}
            </div>
            <h1 className="mt-2 text-2xl font-bold text-ocean-950 sm:text-3xl">{product.name}</h1>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPinIcon width={14} height={14} />
              {[product.location_city, stateName(product.location_state)].filter(Boolean).join(", ")} · updated{" "}
              {timeAgo(product.published_at ?? product.updated_at)}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-white p-4">
            <Price priceMinor={product.price_minor} currency={product.currency} unit={product.unit} pricingType={product.pricing_type} />
            <p className="mt-1 text-sm text-muted-foreground">
              {formatQuantity(product.available_quantity, product.unit)} available · minimum order{" "}
              {formatQuantity(product.min_order_quantity, product.unit)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Availability is confirmed by the seller when they accept your order. Stock is not reserved until then.
            </p>
            <div className="mt-4">
              {!isPublic || isMember ? null : product.pricing_type === "fixed" && product.price_minor ? (
                <AddToCart
                  availableQuantity={Number(product.available_quantity)}
                  item={{
                    productId: product.id,
                    businessId: business.id,
                    businessName: business.name,
                    name: product.name,
                    unit: product.unit,
                    unitPriceMinor: Number(product.price_minor),
                    currency: product.currency,
                    minOrderQuantity: Number(product.min_order_quantity),
                    deliveryOptions: product.delivery_options,
                  }}
                />
              ) : (
                <p className="text-sm font-medium text-ocean-800">This seller prices on request — send a quotation request below.</p>
              )}
              {isMember ? (
                <Button asChild variant="outline">
                  <Link href={`/dashboard/supplier/listings/${product.id}`}>Edit this listing</Link>
                </Button>
              ) : null}
            </div>
            {viewer && !isMember && isPublic ? (
              <ActionForm action={toggleSavedProductAction} hidden={{ productId: product.id }} className="mt-3">
                <SubmitButton variant="ghost" size="sm" pendingText="…">
                  <HeartIcon width={16} height={16} /> {saved ? "Remove from saved" : "Save for later"}
                </SubmitButton>
              </ActionForm>
            ) : null}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Product details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-line text-sm leading-relaxed">{product.description}</p>
              <Dl
                items={[
                  { label: "Size / grade", value: product.size_grade },
                  { label: "Packaging", value: product.packaging },
                  { label: "Available from", value: formatDate(product.available_from) },
                  { label: "Harvest / landing date", value: product.harvest_date ? formatDate(product.harvest_date) : null },
                  { label: "Delivery options", value: product.delivery_options.map(deliveryLabel).join(", ") },
                  { label: "Listing expires", value: product.expires_at ? formatDate(product.expires_at) : null },
                ]}
              />
              {product.handling_info || product.certification_info ? (
                <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
                  <p className="flex items-center gap-2 font-medium">
                    Origin, handling & certificates <SelfDeclared />
                  </p>
                  {product.handling_info ? <p>{product.handling_info}</p> : null}
                  {product.certification_info ? <p>{product.certification_info}</p> : null}
                  <p className="text-xs text-muted-foreground">
                    Provided by the seller and not checked by BlueMarket. Ask for documents before you rely on them.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Seller</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/suppliers/${business.slug}`} className="font-semibold text-ocean-800 hover:underline">
                  {business.name}
                </Link>
                <VerificationBadge status={business.verification_status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {stateName(business.state_code)}
                {avg ? ` · ★ ${avg} from ${ratings.length} completed order${ratings.length === 1 ? "" : "s"}` : " · No reviews yet"}
              </p>
              <p className="text-xs text-muted-foreground">
                Ratings come from completed orders only. They are not proof of regulatory compliance or product safety.
              </p>
            </CardContent>
          </Card>

          {isPublic && !isMember ? (
            <Card id="enquire">
              <CardHeader>
                <CardTitle>{product.pricing_type === "quote_required" ? "Request a quotation" : "Ask the seller"}</CardTitle>
              </CardHeader>
              <CardContent>
                {viewer ? (
                  <ActionForm
                    action={createEnquiryAction}
                    hidden={{
                      supplierBusinessId: business.id,
                      productId: product.id,
                      kind: product.pricing_type === "quote_required" ? "quote_request" : "general",
                    }}
                    refreshOnSuccess={false}
                  >
                    <TextField name="subject" label="Subject" defaultValue={`About: ${product.name}`.slice(0, 150)} required />
                    <TextAreaField
                      name="message"
                      label="Message"
                      rows={4}
                      placeholder="Volumes, how often you need it, quality requirements…"
                      required
                    />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <TextField name="requestedQuantity" label={`Quantity (${product.unit})`} inputMode="decimal" />
                      <TextField name="requestedDeliveryDate" label="Needed by" type="date" />
                      <SelectField
                        name="deliveryState"
                        label="Delivery state"
                        placeholder="—"
                        options={NIGERIAN_STATES.map((s) => ({ value: s.code, label: s.name }))}
                      />
                    </div>
                    <SubmitButton pendingText="Sending…">Send</SubmitButton>
                  </ActionForm>
                ) : (
                  <p className="text-sm">
                    <Link href={`/auth/sign-in?next=/products/${product.id}`} className="font-semibold text-ocean-700 underline">
                      Sign in
                    </Link>{" "}
                    to contact the seller or request a quotation.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}

          {viewer && !isMember ? <ReportForm targetType="product" targetId={product.id} /> : null}
        </section>
      </div>
    </div>
  );
}
