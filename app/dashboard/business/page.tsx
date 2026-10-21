import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/form/action-form";
import { CheckboxField, CheckboxGroup, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/form/fields";
import { GenericStatusBadge, VerificationBadge } from "@/components/marketplace/badges";
import { Alert, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui/primitives";
import { addMemberAction, removeMemberAction, saveBusinessAction } from "@/features/business/actions";
import { VerificationForm } from "@/features/business/verification-form";
import { requireViewer } from "@/lib/auth";
import { BUSINESS_CATEGORIES, NIGERIAN_STATES, VERIFICATION_DOCUMENT_TYPES } from "@/lib/constants";
import { isManager } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatDate, humanize } from "@/lib/utils";
import type { Business } from "@/types/domain";

export const metadata: Metadata = { title: "Business profile & verification" };

const STATES = NIGERIAN_STATES.map((s) => ({ value: s.code, label: s.name }));

export default async function BusinessPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await requireViewer("/dashboard/business");
  const supabase = await createClient();
  const current = viewer.businesses.find((b) => b.id === sp.id) ?? viewer.businesses[0];
  const creating = sp.new === "1" || !current;

  let business: Business | null = null;
  let details: Record<string, string | null> | null = null;
  let requests: { id: string; status: string; document_type: string; reviewer_note: string | null; created_at: string }[] = [];
  let members: { user_id: string; role: string; profile: { full_name: string; email: string | null } | null }[] = [];

  if (!creating && current) {
    const [b, d, r, m] = await Promise.all([
      supabase.from("businesses").select("*").eq("id", current.id).single(),
      supabase.from("business_private_details").select("*").eq("business_id", current.id).maybeSingle(),
      supabase
        .from("business_verification_requests")
        .select("id, status, document_type, reviewer_note, created_at")
        .eq("business_id", current.id)
        .order("created_at", { ascending: false }),
      supabase.from("business_memberships").select("user_id, role").eq("business_id", current.id),
    ]);
    business = b.data as Business;
    details = d.data as Record<string, string | null> | null;
    requests = (r.data ?? []) as typeof requests;
    // Member names: own profile is readable; teammates are shown by role only (profiles are private).
    members = ((m.data ?? []) as { user_id: string; role: string }[]).map((row) => ({
      ...row,
      profile: row.user_id === viewer.id ? { full_name: viewer.profile.full_name, email: viewer.email } : null,
    }));
  }

  const canManage = creating || isManager(current?.membership_role);
  const isOwner = business?.owner_id === viewer.id;
  const defaultSupplier = viewer.roles.includes("supplier");
  const defaultLogistics = viewer.roles.includes("logistics_provider");

  return (
    <>
      <PageHeader
        title={creating ? "Create a business profile" : "Business profile & verification"}
        description="Buyers see your public profile. Private details are only visible to your team and marketplace administrators."
        actions={
          viewer.businesses.length > 0 ? (
            <div className="flex flex-wrap gap-2 text-sm">
              {viewer.businesses.map((b) => (
                <Link key={b.id} href={`/dashboard/business?id=${b.id}`} className={`rounded-md border px-3 py-1.5 ${b.id === current?.id && !creating ? "border-ocean-700 bg-ocean-50" : "border-border bg-white"}`}>
                  {b.name}
                </Link>
              ))}
              <Link href="/dashboard/business?new=1" className="rounded-md border border-dashed border-border px-3 py-1.5">
                + New business
              </Link>
            </div>
          ) : null
        }
      />
      {sp.welcome ? <Alert tone="info" className="mb-4">Welcome! Create your business profile to start listing products or services.</Alert> : null}
      {sp.created ? <Alert tone="success" className="mb-4">Business created. Next: submit verification documents and create your first listing.</Alert> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            {!canManage ? <Alert tone="info" className="mb-4">Only owners and managers can edit the profile.</Alert> : null}
            <ActionForm action={saveBusinessAction} hidden={{ businessId: creating ? undefined : business?.id }}>
              <fieldset disabled={!canManage} className="space-y-4">
                <TextField name="name" label="Trading name" defaultValue={business?.name} required />
                <SelectField name="businessCategory" label="Business type" defaultValue={business?.business_category ?? "other"} options={BUSINESS_CATEGORIES} />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-ocean-900">This business…</p>
                  <CheckboxField name="isSupplier" label="sells products" defaultChecked={business ? business.is_supplier : defaultSupplier} />
                  <CheckboxField
                    name="isLogisticsProvider"
                    label="offers logistics or cold-chain services"
                    defaultChecked={business ? business.is_logistics_provider : defaultLogistics}
                  />
                  <CheckboxField name="isBuyerOrganisation" label="buys products (restaurant, retailer, exporter…)" defaultChecked={business?.is_buyer_organisation} />
                </div>
                <TextAreaField name="description" label="About the business" rows={4} defaultValue={business?.description ?? ""} maxLength={2000} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField name="stateCode" label="State" placeholder="Choose…" defaultValue={business?.state_code ?? ""} options={STATES} required />
                  <TextField name="city" label="Town / landing site" defaultValue={business?.city ?? ""} />
                </div>
                <CheckboxGroup name="serviceStates" legend="States you serve" options={STATES} defaultValues={business?.service_states ?? []} columns={3} />
                <hr className="border-border" />
                <p className="text-sm font-semibold text-ocean-900">Private details</p>
                <TextField name="streetAddress" label="Street address" defaultValue={details?.street_address ?? ""} hint="Never shown publicly." />
                <TextField name="registrationNumber" label="CAC / registration number (optional)" defaultValue={details?.registration_number ?? ""} />
                <div className="grid gap-4 sm:grid-cols-3">
                  <TextField name="contactPhone" label="Business phone" type="tel" defaultValue={details?.contact_phone ?? ""} />
                  <TextField name="whatsapp" label="WhatsApp" type="tel" defaultValue={details?.whatsapp ?? ""} />
                  <TextField name="contactEmail" label="Business email" type="email" defaultValue={details?.contact_email ?? ""} />
                </div>
                <CheckboxField
                  name="contactPublic"
                  label="Show phone, WhatsApp and email on my public profile"
                  hint="Otherwise they are shared only with buyers who send an enquiry or order."
                  defaultChecked={business?.contact_public}
                />
                <SubmitButton>{creating ? "Create business" : "Save profile"}</SubmitButton>
              </fieldset>
            </ActionForm>
          </CardContent>
        </Card>

        {business ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Verification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <VerificationBadge status={business.verification_status} />
                  {business.verified_at ? <span className="text-xs text-muted-foreground">since {formatDate(business.verified_at)}</span> : null}
                </div>
                {business.verification_note ? <Alert tone="info" title="Reviewer note">{business.verification_note}</Alert> : null}
                <p className="text-xs text-muted-foreground">
                  Verification means BlueMarket operations reviewed your documents. It is not a government licence or endorsement.
                </p>
                {canManage && business.verification_status !== "pending_review" && business.status === "active" ? (
                  <VerificationForm businessId={business.id} />
                ) : null}
                {requests.length ? (
                  <ul className="space-y-2 text-sm">
                    {requests.map((r) => (
                      <li key={r.id} className="rounded-md border border-border p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span>{VERIFICATION_DOCUMENT_TYPES.find((d) => d.value === r.document_type)?.label}</span>
                          <GenericStatusBadge status={r.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">Submitted {formatDate(r.created_at)}</p>
                        {r.reviewer_note ? <p className="mt-1 text-xs">{r.reviewer_note}</p> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Team</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <ul className="space-y-2">
                  {members.map((m) => (
                    <li key={m.user_id} className="flex items-center justify-between gap-2">
                      <span>
                        {m.profile ? `${m.profile.full_name} (you)` : "Team member"} · {humanize(m.role)}
                      </span>
                      {isOwner && m.role !== "owner" ? (
                        <ActionForm action={removeMemberAction} hidden={{ businessId: business.id, userId: m.user_id }} confirm="Remove this team member?">
                          <SubmitButton variant="ghost" size="sm" pendingText="…">
                            Remove
                          </SubmitButton>
                        </ActionForm>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {isOwner ? (
                  <ActionForm action={addMemberAction} hidden={{ businessId: business.id }} resetOnSuccess>
                    <TextField name="email" label="Add a teammate by email" type="email" hint="They must already have a BlueMarket account." required />
                    <SelectField
                      name="role"
                      label="Role"
                      options={[
                        { value: "staff", label: "Staff — can manage listings and fulfil orders" },
                        { value: "manager", label: "Manager — can also accept orders and quote" },
                      ]}
                    />
                    <SubmitButton size="sm" variant="outline">
                      Add member
                    </SubmitButton>
                  </ActionForm>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-1 text-sm">
                <p>
                  Status: <GenericStatusBadge status={business.status} />
                </p>
                <p>
                  Public page:{" "}
                  <Link href={`/suppliers/${business.slug}`} className="text-ocean-700 underline">
                    /suppliers/{business.slug}
                  </Link>
                </p>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </>
  );
}
