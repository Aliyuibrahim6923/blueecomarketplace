import type { Metadata } from "next";
import { ActionForm } from "@/components/form/action-form";
import { CheckboxField, SubmitButton, TextAreaField, TextField } from "@/components/form/fields";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui/primitives";
import { addSelfServiceRoleAction, requestDeletionAction, updateProfileAction } from "@/features/account/actions";
import { requireViewer } from "@/lib/auth";
import { SELF_SERVICE_ROLES } from "@/lib/constants";
import { formatDate, humanize } from "@/lib/utils";

export const metadata: Metadata = { title: "Account & privacy" };

export default async function AccountPage() {
  const viewer = await requireViewer("/dashboard/account");
  const p = viewer.profile;
  const missingRoles = SELF_SERVICE_ROLES.filter((r) => !viewer.roles.includes(r.value));

  return (
    <>
      <PageHeader title="Account & privacy" description="Your details, notification preferences, roles and data rights." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile & notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={updateProfileAction}>
              <TextField name="fullName" label="Full name" defaultValue={p.full_name} required />
              <TextField name="email" label="Email" defaultValue={viewer.email ?? ""} disabled hint="Contact support to change your email." />
              <TextField name="phone" label="Phone" type="tel" defaultValue={p.phone ?? ""} hint="Shared only with people you trade with." />
              <CheckboxField name="emailNotifications" label="Email me about orders, enquiries and account changes" defaultChecked={p.email_notifications} />
              <CheckboxField
                name="smsNotifications"
                label="Send SMS alerts"
                hint="Messages never include amounts or personal details. Available when an SMS provider is configured."
                defaultChecked={p.sms_notifications}
              />
              <CheckboxField name="marketingConsent" label="Occasional marketplace news" defaultChecked={p.marketing_consent} />
              <SubmitButton>Save</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Roles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {viewer.roles.map((r) => (
                  <Badge key={r} tone={r === "admin" || r === "agency_analyst" ? "warning" : "info"}>
                    {humanize(r)}
                  </Badge>
                ))}
              </div>
              {missingRoles.map((r) => (
                <ActionForm key={r.value} action={addSelfServiceRoleAction} hidden={{ role: r.value }} className="space-y-0">
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">{r.label}</p>
                      <p className="text-xs text-muted-foreground">{r.description}</p>
                    </div>
                    <SubmitButton size="sm" variant="outline" pendingText="…">
                      Add
                    </SubmitButton>
                  </div>
                </ActionForm>
              ))}
              <p className="text-xs text-muted-foreground">Administrator and agency roles can only be granted by an administrator.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>Download a copy of the personal data and records linked to your account (JSON).</p>
              <Button asChild variant="outline">
                <a href="/api/account/export" download>
                  Download my data
                </a>
              </Button>
              <hr className="border-border" />
              {p.deletion_requested_at ? (
                <Alert tone="warning">Deletion requested on {formatDate(p.deletion_requested_at)}. Our team will contact you.</Alert>
              ) : (
                <ActionForm action={requestDeletionAction} confirm="Request deletion of your account? Our team will process it.">
                  <p>
                    Ask us to delete your account. Records the law requires us to keep (such as completed transactions) are
                    retained for the required period, then deleted or anonymised.
                  </p>
                  <TextAreaField name="reason" label="Reason (optional)" rows={2} maxLength={500} />
                  <SubmitButton variant="danger" size="sm">
                    Request account deletion
                  </SubmitButton>
                </ActionForm>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
