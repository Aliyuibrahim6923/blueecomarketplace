"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authed, fromDbError, notSignedIn, parseForm } from "@/lib/actions";
import type { ActionResult } from "@/lib/errors";
import { uuid } from "@/lib/validation/common";
import { bookingSchema, bookingTransitionSchema, logisticsServiceSchema } from "@/lib/validation/schemas";

export async function saveServiceAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(logisticsServiceSchema, formData, ["coverageStates"]);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const d = parsed.data;
  const serviceId = uuid.safeParse(formData.get("serviceId"));
  const fields = {
    service_type: d.serviceType,
    title: d.title,
    description: d.description,
    coverage_states: d.coverageStates,
    capacity_description: d.capacityDescription ?? null,
    temperature_range: d.temperatureRange ?? null,
    base_price_minor: d.basePrice ?? null,
    pricing_unit: d.pricingUnit ?? null,
    pricing_notes: d.pricingNotes ?? null,
  };
  if (serviceId.success) {
    const update: Record<string, unknown> = { ...fields };
    if (d.intent === "publish") update.status = "published";
    const { data, error } = await supabase.from("logistics_services").update(update).eq("id", serviceId.data).select("id");
    if (error) return fromDbError(error);
    if (!data?.length) return { ok: false, error: "Service not found, or you cannot edit it." };
    revalidatePath("/dashboard/logistics/services");
    return { ok: true, message: "Service saved." };
  }
  const { data, error } = await supabase
    .from("logistics_services")
    .insert({ ...fields, business_id: d.businessId, created_by: user.id, status: d.intent === "publish" ? "published" : "draft" })
    .select("id")
    .single();
  if (error) return fromDbError(error);
  redirect(`/dashboard/logistics/services/${data.id as string}?saved=1`);
}

const serviceStatusSchema = z.object({ serviceId: uuid, status: z.enum(["published", "paused", "archived"]) });

export async function setServiceStatusAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(serviceStatusSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { data, error } = await supabase
    .from("logistics_services")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.serviceId)
    .select("id");
  if (error) return fromDbError(error);
  if (!data?.length) return { ok: false, error: "Service not found." };
  revalidatePath("/dashboard/logistics/services");
  return { ok: true, message: "Status updated." };
}

export async function requestBookingAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(bookingSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const d = parsed.data;
  const { data: service } = await supabase.from("logistics_services").select("business_id").eq("id", d.serviceId).maybeSingle();
  if (!service) return { ok: false, error: "This service is no longer available." };
  const { data, error } = await supabase
    .from("logistics_bookings")
    .insert({
      service_id: d.serviceId,
      // Re-derived by a database trigger; supplied here only to satisfy the column.
      provider_business_id: service.business_id,
      requester_id: user.id,
      order_id: d.orderId ?? null,
      pickup_location: d.pickupLocation,
      dropoff_location: d.dropoffLocation,
      requested_date: d.requestedDate,
      cargo_description: d.cargoDescription,
      quantity_description: d.quantityDescription ?? null,
      special_requirements: d.specialRequirements ?? null,
    })
    .select("id")
    .single();
  if (error) return fromDbError(error, "Could not send the booking request. You cannot book your own service.");
  redirect(`/dashboard/bookings/${data.id as string}?sent=1`);
}

export async function transitionBookingAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(bookingTransitionSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const d = parsed.data;
  const { error } = await supabase.rpc("transition_booking", {
    p_booking_id: d.bookingId,
    p_to: d.to,
    p_quoted_price_minor: d.quotedPrice ?? null,
    p_expected_date: d.expectedDate ?? null,
    p_delivery_terms: d.deliveryTerms ?? null,
    p_note: d.note ?? null,
  });
  if (error) return fromDbError(error);
  revalidatePath(`/dashboard/bookings/${d.bookingId}`);
  return { ok: true, message: "Booking updated." };
}
