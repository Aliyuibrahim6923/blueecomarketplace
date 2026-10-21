import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/form/action-form";
import { SubmitButton } from "@/components/form/fields";
import { StorageUploader } from "@/components/form/storage-uploader";
import { GenericStatusBadge } from "@/components/marketplace/badges";
import { ProductImage } from "@/components/marketplace/product-image";
import { Alert, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui/primitives";
import { attachImageAction, removeImageAction, setListingStatusAction } from "@/features/products/actions";
import { ListingForm } from "@/features/products/listing-form";
import { getPublicSettings, listCategories, settingNumber } from "@/features/products/queries";
import { requireViewer } from "@/lib/auth";
import { minorToMajorString } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { Product } from "@/types/domain";

export const metadata: Metadata = { title: "Edit listing" };

export default async function EditListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await requireViewer(`/dashboard/supplier/listings/${id}`);
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("*, images:product_images(id, storage_path, alt_text, sort_order)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const product = data as Product & { images: { id: string; storage_path: string; alt_text: string | null; sort_order: number }[] };
  const business = viewer.businesses.find((b) => b.id === product.business_id);
  if (!business) notFound();

  const [categories, settings] = await Promise.all([listCategories(), getPublicSettings()]);
  const maxImages = settingNumber(settings, "max_listing_images", 6);
  const images = [...product.images].sort((a, b) => a.sort_order - b.sort_order);
  const hidden = product.status === "hidden";

  return (
    <>
      <PageHeader
        title={product.name}
        description={
          <>
            <GenericStatusBadge status={product.status} />{" "}
            {product.status === "published" ? `Visible until ${formatDate(product.expires_at)}.` : null}{" "}
            <Link href={`/products/${product.id}`} className="text-ocean-700 underline">
              View listing page
            </Link>
          </>
        }
        actions={
          hidden ? null : (
            <div className="flex flex-wrap gap-2">
              {product.status !== "published" ? (
                <ActionForm action={setListingStatusAction} hidden={{ productId: product.id, status: "published" }}>
                  <SubmitButton size="sm" variant="teal">Publish</SubmitButton>
                </ActionForm>
              ) : (
                <ActionForm action={setListingStatusAction} hidden={{ productId: product.id, status: "paused" }}>
                  <SubmitButton size="sm" variant="outline">Pause</SubmitButton>
                </ActionForm>
              )}
              {product.status !== "archived" ? (
                <ActionForm action={setListingStatusAction} hidden={{ productId: product.id, status: "archived" }} confirm="Archive this listing? Buyers will no longer see it.">
                  <SubmitButton size="sm" variant="ghost">Archive</SubmitButton>
                </ActionForm>
              ) : null}
            </div>
          )
        }
      />
      {sp.saved ? <Alert tone="success" className="mb-4">Listing saved. Add photos below, then publish when ready.</Alert> : null}
      {hidden ? (
        <Alert tone="danger" className="mb-4" title="Hidden by a moderator">
          {product.moderation_note ?? "No note recorded."} You can still edit the listing; contact support through Help to appeal.
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card>
          <CardContent>
            <ListingForm
              productId={product.id}
              businesses={[{ id: business.id, name: business.name }]}
              categories={categories.map((c) => ({ id: c.id, name: c.name }))}
              defaults={{
                businessId: product.business_id,
                categoryId: product.category_id,
                name: product.name,
                description: product.description,
                productState: product.product_state as never,
                pricingType: product.pricing_type,
                price: minorToMajorString(product.price_minor),
                unit: product.unit as never,
                availableQuantity: String(product.available_quantity),
                minOrderQuantity: String(product.min_order_quantity),
                sizeGrade: product.size_grade ?? "",
                packaging: product.packaging ?? "",
                locationState: product.location_state,
                locationCity: product.location_city ?? "",
                availableFrom: product.available_from,
                harvestDate: product.harvest_date ?? "",
                handlingInfo: product.handling_info ?? "",
                deliveryOptions: product.delivery_options,
                certificationInfo: product.certification_info ?? "",
              }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Photos ({images.length}/{maxImages})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="grid grid-cols-2 gap-2">
              {images.map((img, i) => (
                <li key={img.id} className="space-y-1">
                  <ProductImage path={img.storage_path} alt={img.alt_text ?? product.name} className="rounded-md" sizes="200px" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{i === 0 ? "Cover photo" : `Photo ${i + 1}`}</span>
                    <ActionForm action={removeImageAction} hidden={{ imageId: img.id }} confirm="Remove this photo?">
                      <SubmitButton size="sm" variant="ghost" className="h-7 min-h-0 px-2 text-xs">Remove</SubmitButton>
                    </ActionForm>
                  </div>
                </li>
              ))}
            </ul>
            {images.length < maxImages ? (
              <StorageUploader
                bucket="product-images"
                folderId={product.business_id}
                accept={["image/jpeg", "image/png", "image/webp"]}
                maxBytes={5 * 1024 * 1024}
                compress
                multiple
                label="Add photos"
                hint="Use your own photos of the actual product. They are resized on your phone before upload to save data."
                onUploaded={attachImageAction}
                fields={{ productId: product.id, altText: product.name }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Photo limit reached. Remove one to add another.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
