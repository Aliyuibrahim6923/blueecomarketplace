"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authed, fromDbError, notSignedIn, parseForm } from "@/lib/actions";
import type { ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { enquirySchema, reportSchema, supportSchema } from "@/lib/validation/schemas";
import { uuid } from "@/lib/validation/common";

export async function toggleSavedProductAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const id = uuid.safeParse(formData.get("productId"));
  if (!id.success) return { ok: false, error: "Unknown product." };
  const { supabase, user } = await authed();
  if (!user) redirect(`/auth/sign-in?next=/products/${id.data}`);

  const { data: existing } = await supabase
    .from("saved_products")
    .select("product_id")
    .eq("user_id", user.id)
    .eq("product_id", id.data)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from("saved_products").delete().eq("user_id", user.id).eq("product_id", id.data)
    : await supabase.from("saved_products").insert({ user_id: user.id, product_id: id.data });
  if (error) return fromDbError(error);
  revalidatePath("/dashboard/saved");
  return { ok: true, message: existing ? "Removed from saved products." : "Saved. Find it under Saved products." };
}

export async function createEnquiryAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(enquirySchema, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const d = parsed.data;
  const { data, error } = await supabase
    .from("enquiries")
    .insert({
      buyer_id: user.id,
      supplier_business_id: d.supplierBusinessId,
      product_id: d.productId ?? null,
      kind: d.kind,
      subject: d.subject,
      message: d.message,
      requested_quantity: d.requestedQuantity ?? null,
      requested_delivery_date: d.requestedDeliveryDate ?? null,
      delivery_state: d.deliveryState ?? null,
    })
    .select("id")
    .single();
  if (error) return fromDbError(error, "Could not send the enquiry. Suppliers cannot message their own business.");
  redirect(`/dashboard/enquiries/${data.id}?sent=1`);
}

export async function reportContentAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(reportSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { error } = await supabase.from("content_reports").insert({
    reporter_id: user.id,
    target_type: parsed.data.targetType,
    target_id: parsed.data.targetId,
    reason: parsed.data.reason,
    details: parsed.data.details ?? null,
  });
  if (error) return fromDbError(error);
  return { ok: true, message: "Thank you. Our team will review this report." };
}

export async function supportRequestAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(supportSchema, formData);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const { error } = await supabase.from("support_requests").insert({
    name: parsed.data.name,
    email: parsed.data.email,
    topic: parsed.data.topic,
    message: parsed.data.message,
  });
  if (error) return fromDbError(error);
  return { ok: true, message: "Message received. We will reply by email." };
}
