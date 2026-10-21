"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authed, fromDbError, notSignedIn, parseForm } from "@/lib/actions";
import type { ActionResult } from "@/lib/errors";
import { uuid } from "@/lib/validation/common";
import { categorySchema } from "@/lib/validation/schemas";

/**
 * Admin actions. Every one of these calls a SECURITY DEFINER function that
 * re-checks the admin role and writes an audit event — the UI check alone
 * grants nothing.
 */

const reason = z.string().trim().max(1000).optional();

const verificationDecision = z.object({
  requestId: uuid,
  decision: z.enum(["approved", "rejected", "changes_requested"]),
  note: reason,
});

export async function reviewVerificationAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(verificationDecision, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { error } = await supabase.rpc("review_verification_request", {
    p_request_id: parsed.data.requestId,
    p_decision: parsed.data.decision,
    p_note: parsed.data.note ?? "",
  });
  if (error) return fromDbError(error);
  revalidatePath("/dashboard/admin/businesses", "layout");
  return { ok: true, message: "Decision recorded and the business notified." };
}

const statusChange = z.object({ targetId: uuid, status: z.enum(["active", "suspended", "deactivated"]), reason });

export async function setAccountStatusAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(statusChange, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { error } = await supabase.rpc("admin_set_account_status", {
    p_user_id: parsed.data.targetId,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason ?? "",
  });
  if (error) return fromDbError(error);
  revalidatePath("/dashboard/admin/users");
  return { ok: true, message: "Account status updated." };
}

export async function setBusinessStatusAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(statusChange, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { error } = await supabase.rpc("admin_set_business_status", {
    p_business_id: parsed.data.targetId,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason ?? "",
  });
  if (error) return fromDbError(error);
  revalidatePath("/dashboard/admin/businesses", "layout");
  return { ok: true, message: "Business status updated." };
}

const roleChange = z.object({ targetId: uuid, role: z.enum(["admin", "agency_analyst"]), op: z.enum(["grant", "revoke"]) });

export async function changeRoleAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(roleChange, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { error } =
    parsed.data.op === "grant"
      ? await supabase.rpc("grant_privileged_role", { p_user_id: parsed.data.targetId, p_role: parsed.data.role })
      : await supabase.rpc("revoke_role", { p_user_id: parsed.data.targetId, p_role: parsed.data.role });
  if (error) return fromDbError(error);
  revalidatePath("/dashboard/admin/users");
  return { ok: true, message: parsed.data.op === "grant" ? "Role granted." : "Role revoked." };
}

const moderation = z.object({
  targetId: uuid,
  kind: z.enum(["product", "logistics_service"]),
  action: z.enum(["hide", "restore"]),
  reason: z.string().trim().min(5, "Record a reason (at least 5 characters)").max(1000),
});

export async function moderateAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(moderation, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const fn = parsed.data.kind === "product" ? "moderate_listing" : "moderate_logistics_service";
  const args =
    parsed.data.kind === "product"
      ? { p_product_id: parsed.data.targetId, p_action: parsed.data.action, p_note: parsed.data.reason }
      : { p_service_id: parsed.data.targetId, p_action: parsed.data.action, p_note: parsed.data.reason };
  const { error } = await supabase.rpc(fn, args);
  if (error) return fromDbError(error);
  revalidatePath("/dashboard/admin/listings");
  revalidatePath("/marketplace");
  return { ok: true, message: parsed.data.action === "hide" ? "Hidden from the marketplace." : "Restored as paused." };
}

const reportDecision = z.object({ targetId: uuid, status: z.enum(["reviewing", "actioned", "dismissed"]), reason });

export async function handleReportAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(reportDecision, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { error } = await supabase.rpc("handle_content_report", {
    p_report_id: parsed.data.targetId,
    p_status: parsed.data.status,
    p_note: parsed.data.reason ?? "",
  });
  if (error) return fromDbError(error);
  revalidatePath("/dashboard/admin/reports");
  return { ok: true, message: "Report updated." };
}

export async function closeSupportRequestAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const id = uuid.safeParse(formData.get("targetId"));
  if (!id.success) return { ok: false, error: "Unknown request." };
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { error } = await supabase.rpc("close_support_request", { p_request_id: id.data });
  if (error) return fromDbError(error);
  revalidatePath("/dashboard/admin/reports");
  return { ok: true, message: "Closed." };
}

const reviewModeration = z.object({ targetId: uuid, status: z.enum(["published", "hidden"]), reason });

export async function moderateReviewAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(reviewModeration, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { error } = await supabase.rpc("moderate_review", {
    p_review_id: parsed.data.targetId,
    p_status: parsed.data.status,
    p_note: parsed.data.reason ?? "",
  });
  if (error) return fromDbError(error);
  revalidatePath("/dashboard/admin/reports");
  return { ok: true, message: "Review updated." };
}

export async function saveCategoryAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(categorySchema, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const d = parsed.data;
  const row = { name: d.name, slug: d.slug, description: d.description ?? null, sort_order: d.sortOrder, is_active: d.isActive };
  // RLS allows writes only for admins; an audit trigger records every change.
  const { error } = d.id
    ? await supabase.from("categories").update(row).eq("id", d.id)
    : await supabase.from("categories").insert(row);
  if (error) return fromDbError(error);
  revalidatePath("/dashboard/admin/categories");
  revalidatePath("/categories");
  return { ok: true, message: "Category saved." };
}

const settingSchema = z.object({ key: z.string().regex(/^[a-z0-9_]{2,64}$/), value: z.string().trim().max(50), type: z.enum(["number", "boolean"]) });

export async function updateSettingAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(settingSchema, formData);
  if (!parsed.ok) return parsed.result;
  let value: number | boolean;
  if (parsed.data.type === "boolean") {
    value = parsed.data.value === "true";
  } else {
    if (!/^\d{1,6}$/.test(parsed.data.value)) return { ok: false, error: "Enter a whole number." };
    value = Number(parsed.data.value);
  }
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { error } = await supabase.rpc("update_platform_setting", { p_key: parsed.data.key, p_value: value });
  if (error) return fromDbError(error);
  revalidatePath("/dashboard/admin/settings");
  return { ok: true, message: "Setting updated (recorded in the audit log)." };
}
