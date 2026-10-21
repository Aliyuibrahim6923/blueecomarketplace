import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/form/action-form";
import { SelectField, SubmitButton, TextAreaField, TextField } from "@/components/form/fields";
import { GenericStatusBadge } from "@/components/marketplace/badges";
import { Alert, Card, CardContent, CardHeader, CardTitle, Dl, PageHeader } from "@/components/ui/primitives";
import {
  acceptQuotationAction,
  closeEnquiryAction,
  createQuotationAction,
  respondQuotationAction,
  sendEnquiryMessageAction,
} from "@/features/orders/actions";
import { requireViewer } from "@/lib/auth";
import { DELIVERY_OPTIONS, NIGERIAN_STATES, stateName, UNITS } from "@/lib/constants";
import { formatMinor } from "@/lib/money";
import { lineTotalMinor } from "@/lib/orders/pricing";
import { isManager } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDate, formatDateTime, formatQuantity } from "@/lib/utils";
import type { Enquiry, Quotation } from "@/types/domain";

export const metadata: Metadata = { title: "Enquiry" };

export default async function EnquiryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await requireViewer(`/dashboard/enquiries/${id}`);
  const supabase = await createClient();
  const { data } = await supabase.from("enquiries").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const enquiry = data as Enquiry;

  const [{ data: messages }, { data: quotations }, { data: supplier }, { data: product }] = await Promise.all([
    supabase.from("enquiry_messages").select("id, sender_id, body, created_at").eq("enquiry_id", id).order("created_at"),
    supabase.from("quotations").select("*").eq("enquiry_id", id).order("created_at", { ascending: false }),
    supabase.from("businesses").select("id, name, slug").eq("id", enquiry.supplier_business_id).maybeSingle(),
    enquiry.product_id
      ? supabase.from("products").select("id, name, unit").eq("id", enquiry.product_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const isBuyer = enquiry.buyer_id === viewer.id;
  const membership = viewer.businesses.find((b) => b.id === enquiry.supplier_business_id);
  const canQuote = !!membership && isManager(membership.membership_role) && enquiry.status !== "closed";
  const quotes = (quotations ?? []) as Quotation[];
  const today = new Date().toISOString().slice(0, 10);
  const states = NIGERIAN_STATES.map((s) => ({ value: s.code, label: s.name }));

  return (
    <>
      <PageHeader
        title={enquiry.subject}
        description={
          <>
            <GenericStatusBadge status={enquiry.status} /> · {enquiry.kind === "quote_request" ? "Quotation request" : "Question"} to{" "}
            {supplier ? <Link href={`/suppliers/${supplier.slug as string}`} className="underline">{supplier.name as string}</Link> : "supplier"} ·{" "}
            {formatDate(enquiry.created_at)}
          </>
        }
        actions={
          enquiry.status !== "closed" ? (
            <ActionForm action={closeEnquiryAction} hidden={{ enquiryId: enquiry.id }} confirm="Close this enquiry? Open quotations will expire.">
              <SubmitButton variant="outline" size="sm">
                Close enquiry
              </SubmitButton>
            </ActionForm>
          ) : null
        }
      />
      {sp.sent ? <Alert tone="success" className="mb-4">Sent. The supplier has been notified.</Alert> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-3">
              <p className="whitespace-pre-line text-sm">{enquiry.message}</p>
              <Dl
                items={[
                  { label: "Product", value: product ? <Link href={`/products/${product.id as string}`} className="underline">{product.name as string}</Link> : null },
                  { label: "Quantity", value: enquiry.requested_quantity ? formatQuantity(enquiry.requested_quantity, (product?.unit as string) ?? "") : null },
                  { label: "Needed by", value: enquiry.requested_delivery_date ? formatDate(enquiry.requested_delivery_date) : null },
                  { label: "Delivery state", value: enquiry.delivery_state ? stateName(enquiry.delivery_state) : null },
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Messages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(messages ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No replies yet.</p> : null}
              <ul className="space-y-2">
                {(messages ?? []).map((m) => {
                  const mine = m.sender_id === viewer.id;
                  const fromBuyer = m.sender_id === enquiry.buyer_id;
                  return (
                    <li key={m.id as string} className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm", mine ? "ml-auto bg-ocean-700 text-white" : "bg-muted")}>
                      <p className="whitespace-pre-line">{m.body as string}</p>
                      <p className={cn("mt-1 text-[11px]", mine ? "text-ocean-100" : "text-muted-foreground")}>
                        {mine ? "You" : fromBuyer ? "Buyer" : "Supplier"} · {formatDateTime(m.created_at as string)}
                      </p>
                    </li>
                  );
                })}
              </ul>
              {enquiry.status !== "closed" ? (
                <ActionForm action={sendEnquiryMessageAction} hidden={{ enquiryId: enquiry.id }} resetOnSuccess>
                  <TextAreaField name="body" label="Reply" rows={3} required hint="Do not share passwords or card details." />
                  <SubmitButton size="sm" pendingText="Sending…">
                    Send
                  </SubmitButton>
                </ActionForm>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          {quotes.map((q) => {
            const line = lineTotalMinor(q.unit_price_minor, q.quantity);
            const expired = q.valid_until < today;
            return (
              <Card key={q.id}>
                <CardHeader className="flex items-center justify-between">
                  <CardTitle>Quotation</CardTitle>
                  <GenericStatusBadge status={q.status === "sent" && expired ? "expired" : q.status} />
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="font-medium">{q.item_description}</p>
                  <dl className="space-y-1">
                    <div className="flex justify-between"><dt>Unit price</dt><dd className="tabular-nums">{formatMinor(q.unit_price_minor, q.currency)} / {q.unit}</dd></div>
                    <div className="flex justify-between"><dt>Quantity</dt><dd>{formatQuantity(q.quantity, q.unit)}</dd></div>
                    <div className="flex justify-between"><dt>Items</dt><dd className="tabular-nums">{formatMinor(line, q.currency)}</dd></div>
                    <div className="flex justify-between"><dt>Delivery fee</dt><dd className="tabular-nums">{formatMinor(q.delivery_fee_minor, q.currency)}</dd></div>
                    <div className="flex justify-between"><dt>Valid until</dt><dd>{formatDate(q.valid_until)}</dd></div>
                  </dl>
                  {q.delivery_terms ? <p className="text-muted-foreground">{q.delivery_terms}</p> : null}
                  <p className="text-xs text-muted-foreground">Marketplace fee and any tax are added on the order and shown before payment.</p>
                  {q.order_id ? (
                    <Link href={`/dashboard/orders/${q.order_id}`} className="font-semibold text-ocean-700 underline">
                      View order
                    </Link>
                  ) : null}
                  {isBuyer && q.status === "sent" && !expired ? (
                    <>
                      <ActionForm action={acceptQuotationAction} hidden={{ quotationId: q.id }} refreshOnSuccess={false}>
                        <SelectField name="deliveryMethod" label="Delivery" options={DELIVERY_OPTIONS} defaultValue="seller_delivery" />
                        <TextField name="deliveryAddress" label="Delivery address (if delivered)" />
                        <SelectField name="deliveryState" label="Delivery state" placeholder="—" options={states} defaultValue={enquiry.delivery_state ?? ""} />
                        <TextAreaField name="buyerNote" label="Note" rows={2} />
                        <SubmitButton variant="teal" className="w-full">
                          Accept and create order
                        </SubmitButton>
                      </ActionForm>
                      <ActionForm action={respondQuotationAction} hidden={{ quotationId: q.id, response: "declined", enquiryId: enquiry.id }}>
                        <SubmitButton variant="ghost" size="sm">
                          Decline
                        </SubmitButton>
                      </ActionForm>
                    </>
                  ) : null}
                  {canQuote && q.status === "sent" ? (
                    <ActionForm action={respondQuotationAction} hidden={{ quotationId: q.id, response: "withdrawn", enquiryId: enquiry.id }}>
                      <SubmitButton variant="ghost" size="sm">
                        Withdraw quotation
                      </SubmitButton>
                    </ActionForm>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}

          {canQuote ? (
            <Card>
              <CardHeader>
                <CardTitle>Send a quotation</CardTitle>
              </CardHeader>
              <CardContent>
                <ActionForm action={createQuotationAction} hidden={{ enquiryId: enquiry.id, productId: enquiry.product_id }} resetOnSuccess>
                  <TextField name="itemDescription" label="Item" defaultValue={(product?.name as string) ?? ""} required />
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField name="unit" label="Unit" defaultValue={(product?.unit as string) ?? "kg"} options={UNITS.map((u) => ({ value: u, label: u }))} />
                    <TextField name="quantity" label="Quantity" inputMode="decimal" defaultValue={enquiry.requested_quantity ? String(enquiry.requested_quantity) : ""} required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField name="unitPrice" label="Unit price (₦)" inputMode="decimal" required />
                    <TextField name="deliveryFee" label="Delivery fee (₦)" inputMode="decimal" defaultValue="0" />
                  </div>
                  <TextField name="validUntil" label="Valid until" type="date" required />
                  <TextAreaField name="deliveryTerms" label="Terms" rows={2} placeholder="Delivery schedule, packaging, payment terms…" />
                  <SubmitButton className="w-full">Send quotation</SubmitButton>
                </ActionForm>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
