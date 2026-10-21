"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authed, fromDbError, notSignedIn, parseForm } from "@/lib/actions";
import { absoluteUrl } from "@/lib/env";
import type { ActionResult } from "@/lib/errors";
import { getPaymentProvider, newPaymentReference } from "@/lib/payments";
import { uuid } from "@/lib/validation/common";
import {
  acceptOrderSchema,
  acceptQuotationSchema,
  checkoutSchema,
  messageSchema,
  offlinePaymentSchema,
  quotationSchema,
  reviewSchema,
  transitionSchema,
} from "@/lib/validation/schemas";

function revalidateOrder(id: string) {
  revalidatePath(`/dashboard/orders/${id}`);
  revalidatePath("/dashboard/orders");
}

/** Cart checkout for ONE seller. Prices are recomputed by create_order(). */
export async function checkoutAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult<{ orderId: string }>> {
  const parsed = parseForm(checkoutSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) redirect("/auth/sign-in?next=/cart");
  const d = parsed.data;
  const { data, error } = await supabase.rpc("create_order", {
    p_seller_business_id: d.sellerBusinessId,
    p_items: d.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    p_delivery_method: d.deliveryMethod,
    p_delivery_address: d.deliveryAddress ?? null,
    p_delivery_state: d.deliveryState ?? null,
    p_buyer_note: d.buyerNote ?? null,
    p_buyer_business_id: null,
  });
  if (error) return fromDbError(error);
  revalidatePath("/dashboard/orders");
  return { ok: true, message: "Order request sent to the supplier.", data: { orderId: data as string } };
}

export async function acceptOrderAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(acceptOrderSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const d = parsed.data;
  const { error } = await supabase.rpc("accept_order", {
    p_order_id: d.orderId,
    p_delivery_fee_minor: d.deliveryFee,
    p_expected_delivery_date: d.expectedDeliveryDate ?? null,
    p_delivery_terms: d.deliveryTerms ?? null,
    p_note: d.note ?? null,
  });
  if (error) return fromDbError(error);
  revalidateOrder(d.orderId);
  return { ok: true, message: "Order accepted. The buyer has been notified." };
}

export async function transitionOrderAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(transitionSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { error } = await supabase.rpc("transition_order", {
    p_order_id: parsed.data.orderId,
    p_to: parsed.data.to,
    p_note: parsed.data.note ?? null,
  });
  if (error) return fromDbError(error);
  revalidateOrder(parsed.data.orderId);
  return { ok: true, message: "Order updated." };
}

export async function sandboxPayAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const orderId = uuid.safeParse(formData.get("orderId"));
  if (!orderId.success) return { ok: false, error: "Unknown order." };
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { error } = await supabase.rpc("sandbox_confirm_payment", { p_order_id: orderId.data });
  if (error) return fromDbError(error);
  revalidateOrder(orderId.data);
  return { ok: true, message: "Sandbox payment recorded. This was a simulation — no money moved." };
}

export async function offlinePaymentAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(offlinePaymentSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { error } = await supabase.rpc("confirm_offline_payment", {
    p_order_id: parsed.data.orderId,
    p_reference: parsed.data.reference,
    p_note: parsed.data.note ?? null,
  });
  if (error) return fromDbError(error);
  revalidateOrder(parsed.data.orderId);
  return { ok: true, message: "Payment recorded. The buyer has been notified." };
}

/** Start a hosted checkout with the configured licensed provider. */
export async function startProviderPaymentAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const orderId = uuid.safeParse(formData.get("orderId"));
  if (!orderId.success) return { ok: false, error: "Unknown order." };
  const provider = getPaymentProvider();
  if (!provider) return { ok: false, error: "Online payment is not available yet." };
  const { supabase, user } = await authed();
  if (!user?.email) return notSignedIn;

  const reference = newPaymentReference();
  const { error } = await supabase.rpc("create_payment_transaction", {
    p_order_id: orderId.data,
    p_provider: provider.id,
    p_reference: reference,
  });
  if (error) return fromDbError(error);

  // Amount and currency come from the database row we just created, not the browser.
  const { data: tx } = await supabase
    .from("payment_transactions")
    .select("amount_minor, currency")
    .eq("reference", reference)
    .single();
  if (!tx) return { ok: false, error: "Could not start the payment." };

  let checkoutUrl: string;
  try {
    const result = await provider.initialize({
      reference,
      amountMinor: Number(tx.amount_minor),
      currency: tx.currency as string,
      email: user.email,
      callbackUrl: absoluteUrl(`/api/payments/callback?provider=${provider.id}`),
      metadata: { order_id: orderId.data },
    });
    checkoutUrl = result.authorizationUrl;
  } catch {
    return { ok: false, error: "The payment provider is unavailable. Please try again shortly." };
  }
  redirect(checkoutUrl);
}

export async function reviewAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(reviewSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { error } = await supabase.from("reviews").insert({
    order_id: parsed.data.orderId,
    author_id: user.id,
    business_id: parsed.data.businessId,
    rating: parsed.data.rating,
    comment: parsed.data.comment ?? null,
  });
  if (error) return fromDbError(error, "You can review a supplier once, after the order is completed.");
  revalidateOrder(parsed.data.orderId);
  return { ok: true, message: "Thank you for your review." };
}

// ---------------------------------------------------------------- enquiries & quotations
export async function sendEnquiryMessageAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(messageSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { error } = await supabase
    .from("enquiry_messages")
    .insert({ enquiry_id: parsed.data.enquiryId, sender_id: user.id, body: parsed.data.body });
  if (error) return fromDbError(error, "Could not send. The enquiry may be closed.");
  revalidatePath(`/dashboard/enquiries/${parsed.data.enquiryId}`);
  return { ok: true };
}

export async function createQuotationAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(quotationSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const d = parsed.data;
  const productId = uuid.safeParse(formData.get("productId"));
  const { error } = await supabase.rpc("create_quotation", {
    p_enquiry_id: d.enquiryId,
    p_item_description: d.itemDescription,
    p_unit: d.unit,
    p_unit_price_minor: d.unitPrice,
    p_quantity: d.quantity,
    p_delivery_fee_minor: d.deliveryFee,
    p_valid_until: d.validUntil,
    p_delivery_terms: d.deliveryTerms ?? null,
    p_product_id: productId.success ? productId.data : null,
  });
  if (error) return fromDbError(error);
  revalidatePath(`/dashboard/enquiries/${d.enquiryId}`);
  return { ok: true, message: "Quotation sent to the buyer." };
}

const quotationResponseSchema = z.object({ quotationId: uuid, response: z.enum(["declined", "withdrawn"]), enquiryId: uuid });

export async function respondQuotationAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(quotationResponseSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { error } = await supabase.rpc("respond_quotation", {
    p_quotation_id: parsed.data.quotationId,
    p_response: parsed.data.response,
  });
  if (error) return fromDbError(error);
  revalidatePath(`/dashboard/enquiries/${parsed.data.enquiryId}`);
  return { ok: true, message: parsed.data.response === "declined" ? "Quotation declined." : "Quotation withdrawn." };
}

export async function acceptQuotationAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(acceptQuotationSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const d = parsed.data;
  const { data, error } = await supabase.rpc("accept_quotation", {
    p_quotation_id: d.quotationId,
    p_delivery_method: d.deliveryMethod,
    p_delivery_address: d.deliveryAddress ?? null,
    p_delivery_state: d.deliveryState ?? null,
    p_buyer_note: d.buyerNote ?? null,
  });
  if (error) return fromDbError(error);
  redirect(`/dashboard/orders/${data as string}?from=quote`);
}

export async function closeEnquiryAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const enquiryId = uuid.safeParse(formData.get("enquiryId"));
  if (!enquiryId.success) return { ok: false, error: "Unknown enquiry." };
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { error } = await supabase.rpc("close_enquiry", { p_enquiry_id: enquiryId.data });
  if (error) return fromDbError(error);
  revalidatePath(`/dashboard/enquiries/${enquiryId.data}`);
  return { ok: true, message: "Enquiry closed." };
}
