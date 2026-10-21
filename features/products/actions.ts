"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authed, fromDbError, notSignedIn, parseForm } from "@/lib/actions";
import type { ActionResult } from "@/lib/errors";
import { uuid } from "@/lib/validation/common";
import { listingSchema } from "@/lib/validation/schemas";

const SAFE_IMAGE_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/;

export async function saveListingAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = parseForm(listingSchema, formData, ["deliveryOptions"]);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const d = parsed.data;
  const productId = uuid.safeParse(formData.get("productId"));

  const fields = {
    category_id: d.categoryId,
    name: d.name,
    description: d.description,
    product_state: d.productState,
    pricing_type: d.pricingType,
    price_minor: d.priceMinor,
    unit: d.unit,
    available_quantity: d.availableQuantity,
    min_order_quantity: d.minOrderQuantity,
    size_grade: d.sizeGrade ?? null,
    packaging: d.packaging ?? null,
    location_state: d.locationState,
    location_city: d.locationCity ?? null,
    available_from: d.availableFrom,
    harvest_date: d.harvestDate ?? null,
    handling_info: d.handlingInfo ?? null,
    delivery_options: d.deliveryOptions,
    certification_info: d.certificationInfo ?? null,
  };

  let id: string;
  if (productId.success) {
    id = productId.data;
    const update: Record<string, unknown> = { ...fields };
    if (d.intent === "publish") update.status = "published";
    const { data, error } = await supabase.from("products").update(update).eq("id", id).select("id");
    if (error) return fromDbError(error);
    if (!data?.length) return { ok: false, error: "Listing not found, or you cannot edit it." };
  } else {
    const { data, error } = await supabase
      .from("products")
      .insert({
        ...fields,
        business_id: d.businessId,
        created_by: user.id,
        status: d.intent === "publish" ? "published" : "draft",
      })
      .select("id")
      .single();
    if (error) return fromDbError(error);
    id = data.id as string;
  }

  revalidatePath("/dashboard/supplier/listings");
  revalidatePath("/marketplace");
  if (!productId.success) redirect(`/dashboard/supplier/listings/${id}?saved=1`);
  return { ok: true, message: d.intent === "publish" ? "Saved and published." : "Saved.", data: { id } };
}

const statusSchema = z.object({
  productId: uuid,
  status: z.enum(["published", "paused", "archived", "draft"]),
});

export async function setListingStatusAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(statusSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { data, error } = await supabase
    .from("products")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.productId)
    .select("id");
  if (error) return fromDbError(error);
  if (!data?.length) return { ok: false, error: "Listing not found, or you cannot edit it." };
  revalidatePath("/dashboard/supplier/listings");
  revalidatePath("/marketplace");
  const labels = { published: "Published.", paused: "Paused — hidden from buyers.", archived: "Archived.", draft: "Moved to drafts." };
  return { ok: true, message: labels[parsed.data.status] };
}

export async function refreshListingAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const productId = uuid.safeParse(formData.get("productId"));
  if (!productId.success) return { ok: false, error: "Unknown listing." };
  const qtyRaw = String(formData.get("availableQuantity") ?? "").trim();
  if (qtyRaw && !/^\d{1,10}(\.\d{1,3})?$/.test(qtyRaw)) return { ok: false, error: "Enter a valid quantity." };
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { error } = await supabase.rpc("refresh_listing", {
    p_product_id: productId.data,
    p_available_quantity: qtyRaw ? qtyRaw : null,
  });
  if (error) return fromDbError(error);
  revalidatePath("/dashboard/supplier/listings");
  return { ok: true, message: "Availability confirmed. The listing stays visible for another period." };
}

/** Called after the browser uploaded a photo straight to Storage (RLS-checked). */
export async function attachImageAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const productId = uuid.safeParse(formData.get("productId"));
  const path = String(formData.get("storagePath") ?? "");
  const alt = String(formData.get("altText") ?? "").trim().slice(0, 200);
  if (!productId.success || !SAFE_IMAGE_PATH.test(path)) return { ok: false, error: "Invalid upload." };
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { count } = await supabase.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId.data);
  const { error } = await supabase
    .from("product_images")
    .insert({ product_id: productId.data, storage_path: path, alt_text: alt || null, sort_order: count ?? 0 });
  if (error) {
    await supabase.storage.from("product-images").remove([path]);
    return fromDbError(error);
  }
  revalidatePath(`/dashboard/supplier/listings/${productId.data}`);
  return { ok: true, message: "Photo added." };
}

export async function removeImageAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const imageId = uuid.safeParse(formData.get("imageId"));
  if (!imageId.success) return { ok: false, error: "Unknown photo." };
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { data, error } = await supabase.from("product_images").delete().eq("id", imageId.data).select("storage_path, product_id");
  if (error) return fromDbError(error);
  const row = data?.[0];
  if (!row) return { ok: false, error: "Photo not found." };
  await supabase.storage.from("product-images").remove([row.storage_path as string]);
  revalidatePath(`/dashboard/supplier/listings/${row.product_id as string}`);
  return { ok: true, message: "Photo removed." };
}
