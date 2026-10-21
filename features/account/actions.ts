"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authed, fromDbError, notSignedIn, parseForm } from "@/lib/actions";
import type { ActionResult } from "@/lib/errors";
import { uuid } from "@/lib/validation/common";
import { profileSchema } from "@/lib/validation/schemas";

export async function updateProfileAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(profileSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const d = parsed.data;
  if (d.smsNotifications && !d.phone) {
    return { ok: false, error: "Add a phone number to receive SMS notifications.", fieldErrors: { phone: ["Required for SMS"] } };
  }
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: d.fullName,
      phone: d.phone ?? null,
      email_notifications: d.emailNotifications,
      sms_notifications: d.smsNotifications,
      marketing_consent: d.marketingConsent,
    })
    .eq("id", user.id);
  if (error) return fromDbError(error);
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Saved." };
}

const roleSchema = z.object({ role: z.enum(["buyer", "supplier", "logistics_provider"]) });

export async function addSelfServiceRoleAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(roleSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { error } = await supabase.from("role_assignments").insert({ user_id: user.id, role: parsed.data.role });
  if (error && error.code !== "23505") return fromDbError(error);
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Role added." };
}

export async function requestDeletionAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const reasonText = String(formData.get("reason") ?? "").trim().slice(0, 500);
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { error } = await supabase.rpc("request_account_deletion", { p_reason: reasonText || null });
  if (error) return fromDbError(error);
  revalidatePath("/dashboard/account");
  return {
    ok: true,
    message:
      "Request received. Our team will delete or anonymise your data, keeping only records the law requires (for example completed transactions).",
  };
}

export async function markNotificationsReadAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const id = formData.get("id");
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  let q = supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
  if (id) {
    const parsed = uuid.safeParse(id);
    if (!parsed.success) return { ok: false, error: "Unknown notification." };
    q = q.eq("id", parsed.data);
  }
  const { error } = await q;
  if (error) return fromDbError(error);
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
