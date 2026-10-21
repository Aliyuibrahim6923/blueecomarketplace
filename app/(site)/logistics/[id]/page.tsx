import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/form/action-form";
import { SelectField, SubmitButton, TextAreaField, TextField } from "@/components/form/fields";
import { VerificationBadge } from "@/components/marketplace/badges";
import { Card, CardContent, CardHeader, CardTitle, Dl } from "@/components/ui/primitives";
import { requestBookingAction } from "@/features/logistics/actions";
import { ReportForm } from "@/features/marketplace/report-form";
import { getViewer } from "@/lib/auth";
import { LOGISTICS_SERVICE_TYPES, stateName } from "@/lib/constants";
import { formatMinor } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { LogisticsService, VerificationStatus } from "@/types/domain";

export const metadata: Metadata = { title: "Logistics service" };
const UUID = /^[0-9a-f-]{36}$/i;

export default async function LogisticsServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase
    .from("logistics_services")
    .select("*, business:businesses(id, name, slug, verification_status)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const service = data as LogisticsService & { business: { id: string; name: string; slug: string; verification_status: VerificationStatus } };
  const viewer = await getViewer();
  const isProvider = !!viewer?.businesses.some((b) => b.id === service.business_id);

  // Orders the viewer is part of, to link a booking to an order (optional).
  const { data: orders } = viewer
    ? await supabase
        .from("orders")
        .select("id, order_number, status")
        .in("status", ["accepted", "awaiting_payment", "paid", "preparing"])
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [] as { id: string; order_number: string; status: string }[] };

  return (
    <div className="container-page grid gap-6 py-8 lg:grid-cols-[1fr_24rem]">
      <section>
        <p className="text-sm text-muted-foreground">
          <Link href="/logistics" className="hover:underline">
            Logistics & cold chain
          </Link>
        </p>
        <h1 className="mt-1 text-2xl font-bold text-ocean-950">{service.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-ocean-800">{service.business.name}</span>
          <VerificationBadge status={service.business.verification_status} />
        </div>
        <Card className="mt-5">
          <CardContent className="space-y-4">
            <p className="whitespace-pre-line text-sm">{service.description}</p>
            <Dl
              items={[
                { label: "Service", value: LOGISTICS_SERVICE_TYPES.find((t) => t.value === service.service_type)?.label },
                { label: "Coverage", value: service.coverage_states.map(stateName).join(", ") },
                { label: "Capacity", value: service.capacity_description },
                { label: "Temperature", value: service.temperature_range },
                {
                  label: "Indicative price",
                  value: service.base_price_minor ? `${formatMinor(service.base_price_minor, service.currency)} ${service.pricing_unit ?? ""}` : "On request",
                },
                { label: "Pricing notes", value: service.pricing_notes },
              ]}
            />
            <p className="text-xs text-muted-foreground">
              Indicative prices are set by the provider. The final price, responsibilities and date are confirmed in the booking.
            </p>
          </CardContent>
        </Card>
        {viewer && !isProvider ? (
          <div className="mt-4">
            <ReportForm targetType="logistics_service" targetId={service.id} label="Report this service" />
          </div>
        ) : null}
      </section>

      <aside>
        <Card>
          <CardHeader>
            <CardTitle>Request a booking</CardTitle>
          </CardHeader>
          <CardContent>
            {service.status !== "published" ? (
              <p className="text-sm text-muted-foreground">This service is not accepting bookings right now.</p>
            ) : isProvider ? (
              <p className="text-sm text-muted-foreground">This is your service. Manage it from your dashboard.</p>
            ) : viewer ? (
              <ActionForm action={requestBookingAction} hidden={{ serviceId: service.id }} refreshOnSuccess={false}>
                <TextField name="pickupLocation" label="Pickup location" required />
                <TextField name="dropoffLocation" label="Drop-off location" required />
                <TextField name="requestedDate" label="Date needed" type="date" required />
                <TextAreaField name="cargoDescription" label="What needs moving or storing?" rows={3} required />
                <TextField name="quantityDescription" label="Quantity / weight" placeholder="e.g. 500 kg in 20 crates" />
                <TextAreaField name="specialRequirements" label="Special requirements" rows={2} placeholder="Temperature, ice, loading help…" />
                {orders && orders.length ? (
                  <SelectField
                    name="orderId"
                    label="Link to an order (optional)"
                    placeholder="Not linked"
                    defaultValue={sp.order ?? ""}
                    options={orders.map((o) => ({ value: o.id as string, label: o.order_number as string }))}
                  />
                ) : null}
                <SubmitButton variant="teal" className="w-full" pendingText="Sending…">
                  Send booking request
                </SubmitButton>
              </ActionForm>
            ) : (
              <p className="text-sm">
                <Link href={`/auth/sign-in?next=/logistics/${service.id}`} className="font-semibold text-ocean-700 underline">
                  Sign in
                </Link>{" "}
                to request a booking.
              </p>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
