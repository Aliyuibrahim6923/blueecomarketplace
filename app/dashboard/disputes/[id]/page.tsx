import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/form/action-form";
import { CheckboxField, SelectField, SubmitButton, TextAreaField } from "@/components/form/fields";
import { StorageUploader } from "@/components/form/storage-uploader";
import { GenericStatusBadge, OrderStatusBadge } from "@/components/marketplace/badges";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle, Dl, PageHeader } from "@/components/ui/primitives";
import { adminUpdateDisputeAction, attachEvidenceAction, disputeMessageAction, resolveDisputeAction } from "@/features/disputes/actions";
import { hasRole, requireViewer } from "@/lib/auth";
import type { OrderStatus } from "@/lib/orders/state-machine";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDateTime, humanize } from "@/lib/utils";
import type { Dispute } from "@/types/domain";

export const metadata: Metadata = { title: "Dispute" };

export default async function DisputePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await requireViewer(`/dashboard/disputes/${id}`);
  const supabase = await createClient();
  const { data } = await supabase.from("disputes").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const dispute = data as Dispute;
  const isAdmin = hasRole(viewer, "admin");

  const [{ data: order }, { data: messages }, { data: attachments }] = await Promise.all([
    supabase.from("orders").select("id, order_number, status, buyer_id").eq("id", dispute.order_id).maybeSingle(),
    supabase.from("dispute_messages").select("id, sender_id, body, is_internal, created_at").eq("dispute_id", id).order("created_at"),
    supabase.from("dispute_attachments").select("id, storage_path, file_name, mime_type, size_bytes, uploaded_by, created_at").eq("dispute_id", id).order("created_at"),
  ]);

  // Private evidence is served with short-lived signed URLs (Storage RLS re-checks access).
  const signed = attachments?.length
    ? await supabase.storage.from("dispute-evidence").createSignedUrls(
        attachments.map((a) => a.storage_path as string),
        60,
      )
    : { data: [] as { signedUrl: string | null; path: string | null }[] };
  const urlFor = (path: string) => signed.data?.find((s) => s.path === path)?.signedUrl ?? null;

  const open = !["resolved", "rejected"].includes(dispute.status);
  const roleOf = (userId: string) => (userId === order?.buyer_id ? "Buyer" : userId === viewer.id ? "You" : "Seller / staff");

  return (
    <>
      <PageHeader
        title={`Dispute · ${order?.order_number ?? ""}`}
        description={
          <>
            <GenericStatusBadge status={dispute.status} /> · {humanize(dispute.category)} · opened {formatDateTime(dispute.created_at)}
          </>
        }
      />
      {sp.opened ? <Alert tone="success" className="mb-4">Dispute opened. Add any photos, receipts or messages that help explain the problem.</Alert> : null}
      {dispute.resolution_note ? (
        <Alert tone={dispute.status === "resolved" ? "success" : "info"} className="mb-4" title={`Decision: ${humanize(dispute.outcome ?? "")}`}>
          {dispute.resolution_note}
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-3">
              <p className="whitespace-pre-line text-sm">{dispute.description}</p>
              <Dl
                items={[
                  {
                    label: "Order",
                    value: order ? (
                      <Link href={`/dashboard/orders/${order.id as string}`} className="underline">
                        {order.order_number as string}
                      </Link>
                    ) : null,
                  },
                  { label: "Order status", value: order ? <OrderStatusBadge status={order.status as OrderStatus} /> : null },
                  { label: "Status before dispute", value: humanize(dispute.previous_order_status) },
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-2">
                {(messages ?? []).map((m) => (
                  <li
                    key={m.id as string}
                    className={cn("rounded-lg px-3 py-2 text-sm", m.is_internal ? "bg-amber-50 ring-1 ring-amber-200" : m.sender_id === viewer.id ? "bg-ocean-50" : "bg-muted")}
                  >
                    {m.is_internal ? <Badge tone="warning">Internal note — not visible to parties</Badge> : null}
                    <p className="whitespace-pre-line">{m.body as string}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {roleOf(m.sender_id as string)} · {formatDateTime(m.created_at as string)}
                    </p>
                  </li>
                ))}
              </ul>
              {open ? (
                <ActionForm action={disputeMessageAction} hidden={{ disputeId: dispute.id }} resetOnSuccess>
                  <TextAreaField name="body" label="Add a message" rows={3} required />
                  {isAdmin ? <CheckboxField name="isInternal" label="Internal note (administrators only)" /> : null}
                  <SubmitButton size="sm">Post</SubmitButton>
                </ActionForm>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evidence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {(attachments ?? []).length === 0 ? <p className="text-muted-foreground">No files yet.</p> : null}
              <ul className="space-y-1">
                {(attachments ?? []).map((a) => {
                  const url = urlFor(a.storage_path as string);
                  return (
                    <li key={a.id as string} className="flex justify-between gap-2">
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
                          {a.file_name as string}
                        </a>
                      ) : (
                        <span>{a.file_name as string}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {roleOf(a.uploaded_by as string)} · {formatDateTime(a.created_at as string)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-muted-foreground">Links expire after 60 seconds. Refresh the page to get new ones.</p>
              {open ? (
                <StorageUploader
                  bucket="dispute-evidence"
                  folderId={dispute.id}
                  accept={["image/jpeg", "image/png", "image/webp", "application/pdf"]}
                  maxBytes={10 * 1024 * 1024}
                  compress
                  label="Upload photo or PDF"
                  hint="Private to the parties and the BlueMarket team. Max 10 MB."
                  onUploaded={attachEvidenceAction}
                  fields={{ disputeId: dispute.id }}
                />
              ) : null}
            </CardContent>
          </Card>
        </div>

        {isAdmin && open ? (
          <aside className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Case handling</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ActionForm action={adminUpdateDisputeAction} hidden={{ disputeId: dispute.id }}>
                  <SelectField
                    name="status"
                    label="Set status"
                    options={[
                      { value: "under_review", label: "Under review" },
                      { value: "awaiting_evidence", label: "Awaiting evidence" },
                    ]}
                  />
                  <TextAreaField name="note" label="Message to both parties (optional)" rows={2} />
                  <SubmitButton size="sm" variant="outline">
                    Update
                  </SubmitButton>
                </ActionForm>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Decision</CardTitle>
              </CardHeader>
              <CardContent>
                <ActionForm action={resolveDisputeAction} hidden={{ disputeId: dispute.id }} confirm="Record this decision? Both parties will be notified.">
                  <SelectField
                    name="outcome"
                    label="Outcome"
                    options={[
                      { value: "refund", label: "Refund buyer (order → refunded)" },
                      { value: "partial_refund", label: "Partial refund (order → completed)" },
                      { value: "complete_order", label: "Complete the order" },
                      { value: "no_action", label: "No action (restore previous status)" },
                    ]}
                  />
                  <TextAreaField name="note" label="Reasoning (shared with both parties)" rows={4} required />
                  <CheckboxField name="reject" label="Reject the dispute as unfounded" />
                  <p className="text-xs text-muted-foreground">
                    Refunds must be processed through the payment provider or by the seller; this records the decision.
                  </p>
                  <SubmitButton variant="danger" className="w-full">
                    Record decision
                  </SubmitButton>
                </ActionForm>
              </CardContent>
            </Card>
          </aside>
        ) : null}
      </div>
    </>
  );
}
