import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPinIcon } from "@/components/icons";
import { SelfDeclared, VerificationBadge } from "@/components/marketplace/badges";
import { Price } from "@/components/marketplace/product-card";
import { ProductImage } from "@/components/marketplace/product-image";
import { Badge, Card, CardContent, CardHeader, CardTitle, Dl } from "@/components/ui/primitives";
import { ContactButtons } from "@/features/marketplace/contact-buttons";
import { deliveryLabel, stateName } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatQuantity, humanize, timeAgo } from "@/lib/utils";
import type { Business, Product } from "@/types/domain";

type Params = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Loaded = {
  product: Product & {
    category: { name: string; slug: string } | null;
    images: { id: string; storage_path: string; alt_text: string | null; sort_order: number }[];
  };
  business: Business;
  contact: { contact_phone: string | null; contact_email: string | null; whatsapp: string | null } | undefined;
};

async function load(id: string): Promise<Loaded | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("*, category:categories(name, slug), images:product_images(id, storage_path, alt_text, sort_order)")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (!product) return null;
  if (product.expires_at && new Date(product.expires_at as string) <= new Date()) return null;
  const [{ data: business }, { data: contact }] = await Promise.all([
    supabase.from("businesses").select("*").eq("id", product.business_id).eq("status", "active").maybeSingle(),
    supabase.rpc("get_business_contact", { p_business_id: product.business_id }),
  ]);
  if (!business) return null;
  return {
    product: product as Loaded["product"],
    business: business as Business,
    contact: (contact as Loaded["contact"][] | null)?.[0],
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const data = await load(id);
  return { title: data ? data.product.name : "Listing not available" };
}

export default async function PublicListingPage({ params }: Params) {
  const { id } = await params;
  const data = await load(id);
  if (!data) notFound();
  const { product, business, contact } = data;
  const images = [...(product.images ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="container-page py-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/market" className="hover:underline">
          Marketplace
        </Link>
        {product.category ? (
          <>
            {" / "}
            <Link href={`/market?category=${product.category.slug}`} className="hover:underline">
              {product.category.name}
            </Link>
          </>
        ) : null}
      </nav>

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
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Contact the seller</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ocean-800">{business.name}</span>
                <VerificationBadge status={business.verification_status} />
              </div>
              <p className="text-sm text-muted-foreground">{stateName(business.state_code)}</p>
              <ContactButtons contact={contact} productName={product.name} businessName={business.name} />
              <p className="text-xs text-muted-foreground">
                Agree price, quantity, delivery and payment directly with the seller. Never pay before you are confident the
                seller is genuine.
              </p>
            </CardContent>
          </Card>

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
                ]}
              />
              {product.handling_info || product.certification_info ? (
                <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
                  <p className="flex items-center gap-2 font-medium">
                    Origin, handling & certificates <SelfDeclared />
                  </p>
                  {product.handling_info ? <p>{product.handling_info}</p> : null}
                  {product.certification_info ? <p>{product.certification_info}</p> : null}
                  <p className="text-xs text-muted-foreground">Provided by the seller and not checked by BlueMarket.</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
