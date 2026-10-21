"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authed, fromDbError, notSignedIn, parseForm } from "@/lib/actions";
import type { ActionResult } from "@/lib/errors";
import { uuid } from "@/lib/validation/common";
import { disputeMessageSchema, disputeSchema, resolveDisputeSchema } from "@/lib/validation/schemas";

const SAFE_EVIDENCE_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|pdf)$/;
const MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

export async function openDisputeAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(disputeSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { data, error } = await supabase.rpc("open_dispute", {
    p_order_id: parsed.data.orderId,
    p_category: parsed.data.category,
    p_description: parsed.data.description,
  });
  if (error) return fromDbError(error);
  redirect(`/dashboard/disputes/${data as string}?opened=1`);
}

export async function disputeMessageAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(disputeMessageSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { error } = await supabase.from("dispute_messages").insert({
    dispute_id: parsed.data.disputeId,
    sender_id: user.id,
    body: parsed.data.body,
    is_internal: parsed.data.isInternal,
  });
  if (error) return fromDbError(error, "Could not post the message. The dispute may be closed.");
  revalidatePath(`/dashboard/disputes/${parsed.data.disputeId}`);
  return { ok: true };
}

const attachmentSchema = z.object({
  disputeId: uuid,
  storagePath: z.string().regex(SAFE_EVIDENCE_PATH),
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(MIME),
  sizeBytes: z.coerce.number().int().positive().max(10 * 1024 * 1024),
});

export async function attachEvidenceAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(attachmentSchema, formData);
  if (!parsed.ok) return { ok: false, error: "That file could not be attached." };
  const d = parsed.data;
  if (!d.storagePath.startsWith(`${d.disputeId}/`)) return { ok: false, error: "That file could not be attached." };
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { error } = await supabase.from("dispute_attachments").insert({
    dispute_id: d.disputeId,
    uploaded_by: user.id,
    storage_path: d.storagePath,
    file_name: d.fileName,
    mime_type: d.mimeType,
    size_bytes: d.sizeBytes,
  });
  if (error) return fromDbError(error);
  revalidatePath(`/dashboard/disputes/${d.disputeId}`);
  return { ok: true, message: "Evidence attached." };
}

const adminUpdateSchema = z.object({
  disputeId: uuid,
  status: z.enum(["under_review", "awaiting_evidence"]),
  note: z.string().trim().max(4000).optional(),
});

export async function adminUpdateDisputeAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(adminUpdateSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { error } = await supabase.rpc("admin_update_dispute", {
    p_dispute_id: parsed.data.disputeId,
    p_status: parsed.data.status,
    p_note: parsed.data.note || null,
  });
  if (error) return fromDbError(error);
  revalidatePath(`/dashboard/disputes/${parsed.data.disputeId}`);
  return { ok: true, message: "Dispute updated." };
}

export async function resolveDisputeAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(resolveDisputeSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { error } = await supabase.rpc("resolve_dispute", {
    p_dispute_id: parsed.data.disputeId,
    p_outcome: parsed.data.outcome,
    p_resolution_note: parsed.data.note,
    p_reject: parsed.data.reject,
  });
  if (error) return fromDbError(error);
  revalidatePath(`/dashboard/disputes/${parsed.data.disputeId}`);
  revalidatePath("/dashboard/admin/disputes");
  return { ok: true, message: "Decision recorded and both parties notified." };
}
