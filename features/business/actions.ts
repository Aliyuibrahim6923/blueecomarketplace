"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authed, fromDbError, notSignedIn, parseForm } from "@/lib/actions";
import type { ActionResult } from "@/lib/errors";
import { slugify } from "@/lib/utils";
import { uuid } from "@/lib/validation/common";
import { businessSchema, memberSchema, verificationRequestSchema } from "@/lib/validation/schemas";

async function uniqueSlug(supabase: Awaited<ReturnType<typeof authed>>["supabase"], name: string, excludeId?: string) {
  const base = slugify(name) || "business";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    let q = supabase.from("businesses").select("id").eq("slug", candidate);
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q.maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

export async function saveBusinessAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(businessSchema, formData, ["serviceStates"]);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const d = parsed.data;
  const businessId = uuid.safeParse(formData.get("businessId"));

  const publicFields = {
    name: d.name,
    description: d.description ?? null,
    business_category: d.businessCategory,
    is_supplier: d.isSupplier,
    is_logistics_provider: d.isLogisticsProvider,
    is_buyer_organisation: d.isBuyerOrganisation,
    state_code: d.stateCode,
    city: d.city ?? null,
    service_states: d.serviceStates,
    contact_public: d.contactPublic,
  };

  let id: string;
  if (businessId.success) {
    id = businessId.data;
    const { error } = await supabase.from("businesses").update(publicFields).eq("id", id);
    if (error) return fromDbError(error);
  } else {
    const slug = await uniqueSlug(supabase, d.name);
    const { data, error } = await supabase
      .from("businesses")
      .insert({ ...publicFields, owner_id: user.id, slug })
      .select("id")
      .single();
    if (error) return fromDbError(error);
    id = data.id as string;
    // Make sure the matching self-service roles exist.
    const roles = [d.isSupplier ? "supplier" : null, d.isLogisticsProvider ? "logistics_provider" : null].filter(Boolean);
    for (const role of roles) {
      await supabase.from("role_assignments").insert({ user_id: user.id, role }).select("id").maybeSingle();
    }
  }

  const { error: detailsError } = await supabase.from("business_private_details").upsert(
    {
      business_id: id,
      street_address: d.streetAddress ?? null,
      registration_number: d.registrationNumber ?? null,
      contact_phone: d.contactPhone ?? null,
      contact_email: d.contactEmail ?? null,
      whatsapp: d.whatsapp ?? null,
    },
    { onConflict: "business_id" },
  );
  if (detailsError) return fromDbError(detailsError);

  revalidatePath("/dashboard", "layout");
  if (!businessId.success) redirect(`/dashboard/business?id=${id}&created=1`);
  return { ok: true, message: "Business profile saved." };
}

export async function submitVerificationAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(verificationRequestSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const d = parsed.data;
  if (d.documentPath && !d.documentPath.startsWith(`${d.businessId}/`)) {
    return { ok: false, error: "The uploaded document does not belong to this business." };
  }
  const { error } = await supabase.from("business_verification_requests").insert({
    business_id: d.businessId,
    submitted_by: user.id,
    document_type: d.documentType,
    document_path: d.documentPath || null,
    document_expiry: d.documentExpiry ?? null,
    applicant_note: d.applicantNote ?? null,
  });
  if (error) return fromDbError(error);
  revalidatePath("/dashboard/business");
  return { ok: true, message: "Submitted for review. We will notify you when an administrator has decided." };
}

export async function addMemberAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(memberSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { error } = await supabase.rpc("add_business_member", {
    p_business_id: parsed.data.businessId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error) return fromDbError(error);
  revalidatePath("/dashboard/business");
  return { ok: true, message: "Team member added." };
}

export async function removeMemberAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const businessId = uuid.safeParse(formData.get("businessId"));
  const userId = uuid.safeParse(formData.get("userId"));
  if (!businessId.success || !userId.success) return { ok: false, error: "Invalid request." };
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { error } = await supabase.rpc("remove_business_member", { p_business_id: businessId.data, p_user_id: userId.data });
  if (error) return fromDbError(error);
  revalidatePath("/dashboard/business");
  return { ok: true, message: "Team member removed." };
}
