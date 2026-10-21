import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/form/action-form";
import { SelectField, SubmitButton, TextField } from "@/components/form/fields";
import { GenericStatusBadge } from "@/components/marketplace/badges";
import { Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader } from "@/components/ui/primitives";
import { closeSupportRequestAction, handleReportAction, moderateReviewAction } from "@/features/admin/actions";
import { REPORT_REASONS, SUPPORT_TOPICS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, humanize } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports & support" };

function targetHref(type: string, id: string) {
  switch (type) {
    case "product":
      return `/products/${id}`;
    case "logistics_service":
      return `/logistics/${id}`;
    case "business":
      return `/dashboard/admin/businesses/${id}`;
    default:
      return `/dashboard/admin/users?id=${id}`;
  }
}

export default async function AdminReportsPage() {
  const supabase = await createClient();
  const [{ data: reports }, { data: support }, { data: reviews }] = await Promise.all([
    supabase.from("content_reports").select("*").in("status", ["open", "reviewing"]).order("created_at").limit(100),
    supabase.from("support_requests").select("*").eq("status", "open").order("created_at").limit(100),
    supabase.from("reviews").select("id, rating, comment, status, created_at, business:businesses(name)").order("created_at", { ascending: false }).limit(30),
  ]);

  return (
    <>
      <PageHeader title="Reports & support" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Content reports ({reports?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!reports?.length ? <EmptyState title="No open reports" /> : null}
            {(reports ?? []).map((r) => (
              <div key={r.id as string} className="space-y-2 rounded-md border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={targetHref(r.target_type as string, r.target_id as string)} className="font-medium text-ocean-900 underline">
                    {humanize(r.target_type as string)}: {REPORT_REASONS.find((x) => x.value === r.reason)?.label}
                  </Link>
                  <GenericStatusBadge status={r.status as string} />
                </div>
                {r.details ? <p>{r.details as string}</p> : null}
                <p className="text-xs text-muted-foreground">{formatDateTime(r.created_at as string)}</p>
                <ActionForm action={handleReportAction} hidden={{ targetId: r.id as string }} className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <SelectField
                      name="status"
                      label="Outcome"
                      options={[
                        { value: "reviewing", label: "Reviewing" },
                        { value: "actioned", label: "Actioned" },
                        { value: "dismissed", label: "Dismissed" },
                      ]}
                    />
                    <TextField name="reason" label="Note" />
                  </div>
                  <SubmitButton size="sm" variant="outline">
                    Save
                  </SubmitButton>
                </ActionForm>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">To hide a listing, use Listing moderation; then mark the report as actioned.</p>
          </CardContent>
        </Card>

        <Card id="support">
          <CardHeader>
            <CardTitle>Support requests ({support?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!support?.length ? <EmptyState title="No open requests" /> : null}
            {(support ?? []).map((s) => (
              <div key={s.id as string} className="space-y-1 rounded-md border border-border p-3 text-sm">
                <p className="font-medium">
                  {SUPPORT_TOPICS.find((t) => t.value === s.topic)?.label} · {s.name as string}
                </p>
                <p className="whitespace-pre-line">{s.message as string}</p>
                <p className="text-xs text-muted-foreground">
                  <a href={`mailto:${s.email as string}`} className="underline">
                    {s.email as string}
                  </a>{" "}
                  · {formatDateTime(s.created_at as string)}
                </p>
                <ActionForm action={closeSupportRequestAction} hidden={{ targetId: s.id as string }}>
                  <SubmitButton size="sm" variant="ghost">
                    Mark handled
                  </SubmitButton>
                </ActionForm>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Recent reviews</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(reviews ?? []).map((r) => {
              const b = (Array.isArray(r.business) ? r.business[0] : r.business) as { name: string } | null;
              const hidden = r.status === "hidden";
              return (
                <div key={r.id as string} className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-2 text-sm last:border-0">
                  <div>
                    <p>
                      {"★".repeat(r.rating as number)} for <strong>{b?.name}</strong> <GenericStatusBadge status={r.status as string} />
                    </p>
                    {r.comment ? <p>{r.comment as string}</p> : null}
                  </div>
                  <ActionForm action={moderateReviewAction} hidden={{ targetId: r.id as string, status: hidden ? "published" : "hidden" }} className="flex items-end gap-2 space-y-0">
                    <TextField name="reason" label="Note" className="w-40" />
                    <SubmitButton size="sm" variant="outline">
                      {hidden ? "Show" : "Hide"}
                    </SubmitButton>
                  </ActionForm>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
