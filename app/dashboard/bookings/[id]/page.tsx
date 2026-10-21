import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/form/action-form";
import { SubmitButton, TextAreaField, TextField } from "@/components/form/fields";
import { GenericStatusBadge } from "@/components/marketplace/badges";
import { Alert, Card, CardContent, CardHeader, CardTitle, Dl, PageHeader } from "@/components/ui/primitives";
import { transitionBookingAction } from "@/features/logistics/actions";
import { requireViewer } from "@/lib/auth";
import { formatMinor } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { LogisticsBooking } from "@/types/domain";

export const metadata: Metadata = { title: "Logistics booking" };

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await requireViewer(`/dashboard/bookings/${id}`);
  const supabase = await createClient();
  const { data } = await supabase.from("logistics_bookings").select("*, service:logistics_services(title, service_type)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const booking = data as LogisticsBooking & { service: { title: string; service_type: string } | null };
  const isProvider = viewer.businesses.some((b) => b.id === booking.provider_business_id);
  const isRequester = booking.requester_id === viewer.id;
  const { data: order } = booking.order_id
    ? await supabase.from("orders").select("id, order_number").eq("id", booking.order_id).maybeSingle()
    : { data: null };

  const s = booking.status;
  const hidden = { bookingId: booking.id };

  return (
    <>
      <PageHeader
        title={booking.service?.title ?? "Booking"}
        description={
          <>
            <GenericStatusBadge status={s} /> · requested {formatDateTime(booking.created_at)}
          </>
        }
      />
      {sp.sent ? <Alert tone="success" className="mb-4">Booking request sent. The provider will quote, confirm or decline.</Alert> : null}
      {booking.cancellation_reason ? <Alert tone="danger" className="mb-4" title="Declined / cancelled">{booking.cancellation_reason}</Alert> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <Card>
          <CardContent>
            <Dl
              items={[
                { label: "Pickup", value: booking.pickup_location },
                { label: "Drop-off", value: booking.dropoff_location },
                { label: "Date requested", value: formatDate(booking.requested_date) },
                { label: "Cargo", value: booking.cargo_description },
                { label: "Quantity", value: booking.quantity_description },
                { label: "Special requirements", value: booking.special_requirements },
                { label: "Linked order", value: order ? <Link href={`/dashboard/orders/${order.id as string}`} className="underline">{order.order_number as string}</Link> : null },
                { label: "Quoted price", value: booking.quoted_price_minor ? formatMinor(booking.quoted_price_minor, booking.currency) : null },
                { label: "Expected date", value: booking.expected_date ? formatDate(booking.expected_date) : null },
                { label: "Terms & responsibilities", value: booking.delivery_terms },
                { label: "Provider note", value: booking.provider_note },
                {
                  label: "Proof of delivery",
                  value: booking.proof_of_delivery_note ? `${booking.proof_of_delivery_note} (${formatDateTime(booking.proof_recorded_at)})` : null,
                },
              ]}
            />
            <p className="mt-4 text-xs text-muted-foreground">
              Bookings are confirmed by request and reply. BlueMarket does not track vehicles in real time.
            </p>
          </CardContent>
        </Card>

        <aside className="space-y-4">
          {isProvider && s === "requested" ? (
            <Card>
              <CardHeader>
                <CardTitle>Respond</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ActionForm action={transitionBookingAction} hidden={{ ...hidden, to: "quoted" }}>
                  <TextField name="quotedPrice" label="Price (₦)" inputMode="decimal" required />
                  <TextField name="expectedDate" label="Expected date" type="date" />
                  <TextAreaField name="deliveryTerms" label="Terms & responsibilities" rows={2} placeholder="Loading, waiting time, ice, liability…" />
                  <TextAreaField name="note" label="Note" rows={2} />
                  <SubmitButton className="w-full">Send quote</SubmitButton>
                </ActionForm>
                <details className="rounded-md border border-border p-3">
                  <summary className="cursor-pointer text-sm font-medium">Decline</summary>
                  <ActionForm action={transitionBookingAction} hidden={{ ...hidden, to: "declined" }} className="mt-3">
                    <TextAreaField name="note" label="Reason" rows={2} required />
                    <SubmitButton variant="danger" size="sm">
                      Decline booking
                    </SubmitButton>
                  </ActionForm>
                </details>
              </CardContent>
            </Card>
          ) : null}

          {isRequester && s === "quoted" ? (
            <Card>
              <CardHeader>
                <CardTitle>Accept the quote?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">
                  {booking.quoted_price_minor ? formatMinor(booking.quoted_price_minor, booking.currency) : "—"}
                  {booking.expected_date ? ` · ${formatDate(booking.expected_date)}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">Pay the provider as agreed with them. BlueMarket does not collect logistics payments in this release.</p>
                <ActionForm action={transitionBookingAction} hidden={{ ...hidden, to: "confirmed" }}>
                  <SubmitButton variant="teal" className="w-full">
                    Confirm booking
                  </SubmitButton>
                </ActionForm>
              </CardContent>
            </Card>
          ) : null}

          {isProvider && s === "confirmed" ? (
            <ActionForm action={transitionBookingAction} hidden={{ ...hidden, to: "in_progress" }}>
              <SubmitButton className="w-full">Mark as in progress</SubmitButton>
            </ActionForm>
          ) : null}

          {isProvider && s === "in_progress" ? (
            <Card>
              <CardHeader>
                <CardTitle>Record proof of delivery</CardTitle>
              </CardHeader>
              <CardContent>
                <ActionForm action={transitionBookingAction} hidden={{ ...hidden, to: "completed" }}>
                  <TextAreaField name="note" label="Who received it, when, and in what condition" rows={3} required />
                  <SubmitButton variant="teal" className="w-full">
                    Complete booking
                  </SubmitButton>
                </ActionForm>
              </CardContent>
            </Card>
          ) : null}

          {(isRequester && ["requested", "quoted", "confirmed"].includes(s)) || (isProvider && s === "confirmed") ? (
            <details className="rounded-md border border-border bg-white p-3">
              <summary className="cursor-pointer text-sm font-medium">Cancel booking</summary>
              <ActionForm action={transitionBookingAction} hidden={{ ...hidden, to: "cancelled" }} className="mt-3">
                <TextAreaField name="note" label="Reason" rows={2} required />
                <SubmitButton variant="danger" size="sm">
                  Cancel
                </SubmitButton>
              </ActionForm>
            </details>
          ) : null}
        </aside>
      </div>
    </>
  );
}
