import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/form/action-form";
import { SelectField, SubmitButton, TextAreaField } from "@/components/form/fields";
import { GenericStatusBadge, VerificationBadge } from "@/components/marketplace/badges";
import { Alert, Card, CardContent, CardHeader, CardTitle, Dl, PageHeader } from "@/components/ui/primitives";
import { reviewVerificationAction, setBusinessStatusAction } from "@/features/admin/actions";
import { BUSINESS_CATEGORIES, stateName, VERIFICATION_DOCUMENT_TYPES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { Business } from "@/types/domain";

export const metadata: Metadata = { title: "Business review" };

export default async function AdminBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("businesses").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const business = data as Business;
  const [{ data: details }, { data: requests }, { data: owner }, { count: listings }, { count: orders }] = await Promise.all([
    supabase.from("business_private_details").select("*").eq("business_id", id).maybeSingle(),
    supabase.from("business_verification_requests").select("*").eq("business_id", id).order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email, phone, account_status").eq("id", business.owner_id).maybeSingle(),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("business_id", id),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("seller_business_id", id),
  ]);

  // Signed URLs (60 s) for private verification documents; Storage RLS re-checks admin access.
  const paths = (requests ?? []).map((r) => r.document_path as string | null).filter((p): p is string => !!p);
  const { data: signed } = paths.length
    ? await supabase.storage.from("verification-documents").createSignedUrls(paths, 60)
    : { data: [] as { path: string | null; signedUrl: string | null }[] };
  const docUrl = (p: string | null) => (p ? (signed ?? []).find((s) => s.path === p)?.signedUrl ?? null : null);

  return (
    <>
      <PageHeader
        title={business.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <VerificationBadge status={business.verification_status} /> <GenericStatusBadge status={business.status} />
            <Link href={`/suppliers/${business.slug}`} className="text-ocean-700 underline">
              Public profile
            </Link>
          </span>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Dl
                items={[
                  { label: "Category", value: BUSINESS_CATEGORIES.find((c) => c.value === business.business_category)?.label },
                  { label: "Location", value: [business.city, stateName(business.state_code)].filter(Boolean).join(", ") },
                  { label: "Owner", value: owner ? `${owner.full_name as string} (${owner.email as string})` : null },
                  { label: "Owner account", value: owner ? <GenericStatusBadge status={owner.account_status as string} /> : null },
                  { label: "Address (private)", value: details?.street_address as string | null },
                  { label: "Registration no. (private)", value: details?.registration_number as string | null },
                  { label: "Contact", value: [details?.contact_phone, details?.contact_email].filter(Boolean).join(" · ") || null },
                  { label: "Listings / orders", value: `${listings ?? 0} / ${orders ?? 0}` },
                  { label: "Joined", value: formatDate(business.created_at) },
                ]}
              />
              {business.description ? <p className="mt-4 whitespace-pre-line text-sm">{business.description}</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Verification requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(requests ?? []).length === 0 ? <p className="text-sm text-muted-foreground">None submitted.</p> : null}
              {(requests ?? []).map((r) => {
                const url = docUrl(r.document_path as string | null);
                return (
                  <div key={r.id as string} className="space-y-2 rounded-md border border-border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{VERIFICATION_DOCUMENT_TYPES.find((d) => d.value === r.document_type)?.label}</p>
                      <GenericStatusBadge status={r.status as string} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Submitted {formatDateTime(r.created_at as string)}
                      {r.document_expiry ? ` · document expires ${formatDate(r.document_expiry as string)}` : ""}
                    </p>
                    {r.applicant_note ? <p>{r.applicant_note as string}</p> : null}
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-ocean-700 underline">
                        Open document (link valid 60 s)
                      </a>
                    ) : r.document_path ? (
                      <p className="text-xs text-red-700">Document could not be opened.</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">No document attached.</p>
                    )}
                    {r.reviewer_note ? <p className="text-xs">Reviewer: {r.reviewer_note as string}</p> : null}
                    {r.status === "pending_review" ? (
                      <ActionForm action={reviewVerificationAction} hidden={{ requestId: r.id as string }} confirm="Record this verification decision?">
                        <SelectField
                          name="decision"
                          label="Decision"
                          options={[
                            { value: "approved", label: "Approve — mark business verified" },
                            { value: "changes_requested", label: "Request changes / more information" },
                            { value: "rejected", label: "Reject" },
                          ]}
                        />
                        <TextAreaField name="note" label="Note to the business" rows={2} hint="Required when rejecting or requesting changes." />
                        <Alert tone="warning">
                          Approve only after checking the document against its issuer where possible. Do not treat an upload as
                          authentic without a verification step.
                        </Alert>
                        <SubmitButton size="sm">Record decision</SubmitButton>
                      </ActionForm>
                    ) : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <aside>
          <Card>
            <CardHeader>
              <CardTitle>{business.status === "active" ? "Suspend business" : "Reactivate business"}</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm
                action={setBusinessStatusAction}
                hidden={{ targetId: business.id, status: business.status === "active" ? "suspended" : "active" }}
                confirm={business.status === "active" ? "Suspend this business? Its listings will disappear." : "Reactivate this business?"}
              >
                <TextAreaField name="reason" label="Reason (recorded and sent to the business)" rows={3} required={business.status === "active"} />
                <SubmitButton variant={business.status === "active" ? "danger" : "teal"} className="w-full">
                  {business.status === "active" ? "Suspend" : "Reactivate"}
                </SubmitButton>
              </ActionForm>
              {business.suspended_reason ? <p className="mt-3 text-sm">Current reason: {business.suspended_reason}</p> : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
