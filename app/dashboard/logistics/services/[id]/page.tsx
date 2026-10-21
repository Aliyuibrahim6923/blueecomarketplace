import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/form/action-form";
import { SubmitButton } from "@/components/form/fields";
import { GenericStatusBadge } from "@/components/marketplace/badges";
import { Alert, Card, CardContent, PageHeader } from "@/components/ui/primitives";
import { setServiceStatusAction } from "@/features/logistics/actions";
import { ServiceForm } from "@/features/logistics/service-form";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { LogisticsService } from "@/types/domain";

export const metadata: Metadata = { title: "Edit service" };

export default async function EditServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await requireViewer(`/dashboard/logistics/services/${id}`);
  const supabase = await createClient();
  const { data } = await supabase.from("logistics_services").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const service = data as LogisticsService;
  const business = viewer.businesses.find((b) => b.id === service.business_id);
  if (!business) notFound();
  const hidden = service.status === "hidden";

  return (
    <>
      <PageHeader
        title={service.title}
        description={
          <>
            <GenericStatusBadge status={service.status} />{" "}
            <Link href={`/logistics/${service.id}`} className="text-ocean-700 underline">
              View public page
            </Link>
          </>
        }
        actions={
          hidden ? null : (
            <div className="flex gap-2">
              {service.status === "published" ? (
                <ActionForm action={setServiceStatusAction} hidden={{ serviceId: service.id, status: "paused" }}>
                  <SubmitButton size="sm" variant="outline">Pause</SubmitButton>
                </ActionForm>
              ) : (
                <ActionForm action={setServiceStatusAction} hidden={{ serviceId: service.id, status: "published" }}>
                  <SubmitButton size="sm" variant="teal">Publish</SubmitButton>
                </ActionForm>
              )}
              <ActionForm action={setServiceStatusAction} hidden={{ serviceId: service.id, status: "archived" }} confirm="Archive this service?">
                <SubmitButton size="sm" variant="ghost">Archive</SubmitButton>
              </ActionForm>
            </div>
          )
        }
      />
      {sp.saved ? <Alert tone="success" className="mb-4">Service saved.</Alert> : null}
      {hidden ? <Alert tone="danger" className="mb-4" title="Hidden by a moderator">{service.moderation_note}</Alert> : null}
      <Card>
        <CardContent>
          <ServiceForm service={service} businesses={[{ id: business.id, name: business.name }]} />
        </CardContent>
      </Card>
    </>
  );
}
