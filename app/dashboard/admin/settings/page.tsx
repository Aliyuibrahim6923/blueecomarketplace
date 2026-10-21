import type { Metadata } from "next";
import { ActionForm } from "@/components/form/action-form";
import { SelectField, SubmitButton, TextField } from "@/components/form/fields";
import { Alert, Badge, Card, CardContent, PageHeader } from "@/components/ui/primitives";
import { updateSettingAction } from "@/features/admin/actions";
import { getPaymentProvider } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Platform settings" };

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("platform_settings").select("*").order("key");
  const provider = getPaymentProvider();
  const sandbox = (data ?? []).find((s) => s.key === "payment_sandbox_enabled")?.value === true;
  return (
    <>
      <PageHeader title="Platform settings" description="Every change is recorded with before and after values in the audit log." />
      <Alert tone={provider ? "success" : "info"} className="mb-4" title="Payment provider">
        {provider ? `${provider.displayName} is configured on the server.` : "No licensed payment provider is configured (environment variables). Only sandbox and offline flows are available."}
      </Alert>
      {sandbox && process.env.NODE_ENV === "production" ? (
        <Alert tone="danger" className="mb-4" title="Sandbox payments are enabled">
          Turn this off before real users transact. Sandbox payments are simulated and move no money.
        </Alert>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {(data ?? []).map((s) => {
          const isBool = typeof s.value === "boolean";
          return (
            <Card key={s.key as string}>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-sm font-semibold">{s.key as string}</p>
                  <Badge tone={s.is_public ? "info" : "neutral"}>{s.is_public ? "Public" : "Private"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{s.description as string}</p>
                <ActionForm action={updateSettingAction} hidden={{ key: s.key as string, type: isBool ? "boolean" : "number" }} className="flex flex-wrap items-end gap-2 space-y-0">
                  {isBool ? (
                    <SelectField
                      name="value"
                      label="Value"
                      defaultValue={String(s.value)}
                      options={[
                        { value: "true", label: "On" },
                        { value: "false", label: "Off" },
                      ]}
                      className="w-32"
                    />
                  ) : (
                    <TextField name="value" label="Value" defaultValue={String(s.value)} inputMode="numeric" className="w-32" />
                  )}
                  <SubmitButton size="sm" variant="outline">
                    Update
                  </SubmitButton>
                </ActionForm>
                <p className="text-xs text-muted-foreground">Last changed {formatDateTime(s.updated_at as string)}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
