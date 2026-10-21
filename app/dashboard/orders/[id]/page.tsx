import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/form/action-form";
import { SelectField, SubmitButton, TextAreaField, TextField } from "@/components/form/fields";
import { OrderStatusBadge, SandboxBadge } from "@/components/marketplace/badges";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle, Dl, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import {
  acceptOrderAction,
  offlinePaymentAction,
  reviewAction,
  sandboxPayAction,
  startProviderPaymentAction,
  transitionOrderAction,
} from "@/features/orders/actions";
import { ReorderButton } from "@/features/orders/reorder-button";
import { getPublicSettings, settingBool } from "@/features/products/queries";
import { hasRole, requireViewer } from "@/lib/auth";
import { deliveryLabel, stateName } from "@/lib/constants";
import { formatMinor } from "@/lib/money";
import { actionLabel, ORDER_HAPPY_PATH, ORDER_STATUS_LABEL, requiresReason, type OrderActor } from "@/lib/orders/state-machine";
import { getPaymentProvider } from "@/lib/payments";
import { isManager, uiOrderActions } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDate, formatDateTime, formatQuantity, humanize } from "@/lib/utils";
import type { CartItem } from "@/features/cart/store";
import type { Order, OrderHistory, OrderItem, PaymentTransaction } from "@/types/domain";

export const metadata: Metadata = { title: "Order" };

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await requireViewer(`/dashboard/orders/${id}`);
  const supabase = await createClient();

  const { data: orderRow } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (!orderRow) notFound();
  const order = orderRow as Order;

  const [items, history, payments, parties, seller, dispute, review, settings] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", id),
    supabase.from("order_status_history").select("*").eq("order_id", id).order("created_at"),
    supabase.from("payment_transactions").select("id, provider, reference, amount_minor, currency, status, reconciliation_status, note, created_at").eq("order_id", id).order("created_at"),
    supabase.rpc("get_order_parties", { p_order_id: id }),
    supabase.from("businesses").select("id, name, slug").eq("id", order.seller_business_id).maybeSingle(),
    supabase.from("disputes").select("id, status").eq("order_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("reviews").select("id").eq("order_id", id).eq("author_id", viewer.id).maybeSingle(),
    getPublicSettings(),
  ]);

  const orderItems = (items.data ?? []) as OrderItem[];
  const timeline = (history.data ?? []) as OrderHistory[];
  const txs = (payments.data ?? []) as PaymentTransaction[];
  const party = (parties.data as Record<string, string | null>[] | null)?.[0];
  const membership = viewer.businesses.find((b) => b.id === order.seller_business_id);
  const actor: OrderActor | null =
    order.buyer_id === viewer.id ? "buyer" : membership ? "seller" : hasRole(viewer, "admin") ? "admin" : null;
  const manager = isManager(membership?.membership_role);
  const generic = uiOrderActions(order.status, actor, membership?.membership_role);
  const sandboxEnabled = settingBool(settings, "payment_sandbox_enabled", false);
  const offlineEnabled = settingBool(settings, "offline_payments_enabled", false);
  const provider = getPaymentProvider();
  const activeDispute = dispute.data && !["resolved", "rejected"].includes(dispute.data.status as string) ? dispute.data : null;
  const canDispute = (actor === "buyer" || actor === "seller") && ["paid", "preparing", "dispatched", "delivered"].includes(order.status);
  const canBookLogistics = (actor === "buyer" || actor === "seller") && ["accepted", "awaiting_payment", "paid", "preparing"].includes(order.status);

  // Reorder: current listings for the same products (fixed price, still published).
  let reorderItems: CartItem[] = [];
  if (actor === "buyer" && ["completed", "delivered", "cancelled", "rejected"].includes(order.status)) {
    const productIds = orderItems.map((i) => i.product_id).filter((x): x is string => !!x);
    if (productIds.length) {
      const { data: products } = await supabase
        .from("products")
        .select("id, name, unit, price_minor, currency, pricing_type, min_order_quantity, delivery_options, status")
        .in("id", productIds)
        .eq("status", "published")
        .eq("pricing_type", "fixed");
      reorderItems = (products ?? []).map((p) => ({
        productId: p.id as string,
        businessId: order.seller_business_id,
        businessName: (seller.data?.name as string) ?? "Supplier",
        name: p.name as string,
        unit: p.unit as string,
        unitPriceMinor: Number(p.price_minor),
        currency: p.currency as string,
        quantity: String(orderItems.find((i) => i.product_id === p.id)?.quantity ?? p.min_order_quantity),
        minOrderQuantity: Number(p.min_order_quantity),
        deliveryOptions: p.delivery_options as string[],
      }));
    }
  }

  const reachedIndex = ORDER_HAPPY_PATH.indexOf(order.status);

  return (
    <>
      <PageHeader
        title={`Order ${order.order_number}`}
        description={
          <>
            <OrderStatusBadge status={order.status} /> · placed {formatDateTime(order.placed_at ?? order.created_at)} ·{" "}
            {actor === "buyer" ? "you are the buyer" : actor === "seller" ? "you are the seller" : "administrator view"}
          </>
        }
        actions={<ReorderButton items={reorderItems} />}
      />
      {sp.placed ? <Alert tone="success" className="mb-4">Order request sent. The supplier will confirm availability, delivery fee and date.</Alert> : null}
      {sp.from === "quote" ? <Alert tone="success" className="mb-4">Quotation accepted — this order already has agreed terms. Confirm the total to proceed to payment.</Alert> : null}
      {activeDispute ? (
        <Alert tone="warning" className="mb-4" title="This order is in dispute">
          <Link href={`/dashboard/disputes/${activeDispute.id as string}`} className="underline">
            Open the dispute
          </Link>{" "}
          to add messages or evidence.
        </Alert>
      ) : null}
      {order.rejection_reason ? <Alert tone="danger" className="mb-4" title="Declined by seller">{order.rejection_reason}</Alert> : null}
      {order.cancellation_reason ? <Alert tone="danger" className="mb-4" title="Cancelled">{order.cancellation_reason}</Alert> : null}

      {/* Progress */}
      <ol className="mb-6 flex gap-1 overflow-x-auto pb-1" aria-label="Order progress">
        {ORDER_HAPPY_PATH.map((s, i) => (
          <li
            key={s}
            className={cn(
              "min-w-24 flex-1 rounded px-2 py-1 text-center text-[11px] font-medium",
              reachedIndex >= i ? "bg-teal-600 text-white" : "bg-muted text-muted-foreground",
            )}
            aria-current={order.status === s ? "step" : undefined}
          >
            {ORDER_STATUS_LABEL[s]}
          </li>
        ))}
      </ol>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <thead>
                  <tr>
                    <Th>Item</Th>
                    <Th>Unit price</Th>
                    <Th>Quantity</Th>
                    <Th className="text-right">Line total</Th>
                  </tr>
                </thead>
                <tbody>
                  {orderItems.map((i) => (
                    <tr key={i.id}>
                      <Td>{i.product_id ? <Link href={`/products/${i.product_id}`} className="hover:underline">{i.product_name}</Link> : i.product_name}</Td>
                      <Td className="tabular-nums">{formatMinor(i.unit_price_minor, order.currency)} / {i.unit}</Td>
                      <Td>{formatQuantity(i.quantity, i.unit)}</Td>
                      <Td className="text-right tabular-nums">{formatMinor(i.line_total_minor, order.currency)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <dl className="ml-auto max-w-sm space-y-1 text-sm">
                {[
                  ["Items subtotal", order.subtotal_minor],
                  [order.status === "requested" ? "Delivery fee (set when accepted)" : "Delivery fee", order.delivery_fee_minor],
                  [`Marketplace fee (${(order.marketplace_fee_bps / 100).toFixed(2)}%)`, order.marketplace_fee_minor],
                  [`Tax (${(order.tax_bps / 100).toFixed(2)}%)`, order.tax_minor],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="tabular-nums">{formatMinor(value as number, order.currency)}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-4 border-t border-border pt-1 text-base font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatMinor(order.total_minor, order.currency)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Delivery & parties</CardTitle>
            </CardHeader>
            <CardContent>
              <Dl
                items={[
                  { label: "Method", value: deliveryLabel(order.delivery_method) },
                  { label: "Address", value: order.delivery_address ? `${order.delivery_address}, ${stateName(order.delivery_state)}` : null },
                  { label: "Expected", value: order.expected_delivery_date ? formatDate(order.expected_delivery_date) : null },
                  { label: "Delivery terms", value: order.delivery_terms },
                  { label: "Buyer note", value: order.buyer_note },
                  { label: "Seller note", value: order.seller_note },
                  { label: "Seller", value: seller.data ? <Link href={`/suppliers/${seller.data.slug as string}`} className="underline">{seller.data.name as string}</Link> : null },
                  { label: "Seller contact", value: party ? [party.seller_phone, party.seller_email].filter(Boolean).join(" · ") || null : null },
                  { label: "Buyer", value: party?.buyer_name },
                  { label: "Buyer contact", value: party ? [party.buyer_phone, party.buyer_email].filter(Boolean).join(" · ") || null : null },
                ]}
              />
              {canBookLogistics ? (
                <p className="mt-4 text-sm">
                  Need transport or cold storage?{" "}
                  <Link href={`/logistics?order=${order.id}`} className="font-semibold text-ocean-700 underline">
                    Find a logistics provider
                  </Link>
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-4 border-l border-border pl-5">
                {timeline.map((h) => (
                  <li key={h.id}>
                    <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-teal-500" aria-hidden />
                    <p className="text-sm font-medium">
                      {ORDER_STATUS_LABEL[h.to_status]} <span className="font-normal text-muted-foreground">by {h.actor_kind}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(h.created_at)}</p>
                    {h.note ? <p className="mt-0.5 text-sm">{h.note}</p> : null}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {txs.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Payments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {txs.map((t) => (
                  <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2">
                    <div>
                      <p className="font-medium">
                        {humanize(t.provider)} · {formatMinor(t.amount_minor, t.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ref {t.reference} · {formatDateTime(t.created_at)}
                      </p>
                      {t.note ? <p className="text-xs">{t.note}</p> : null}
                    </div>
                    <div className="flex gap-1">
                      {t.provider === "sandbox" ? <SandboxBadge /> : null}
                      <Badge tone={t.status === "succeeded" ? "success" : t.status === "failed" ? "danger" : "neutral"}>{humanize(t.status)}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Actions */}
        <aside className="space-y-4">
          {actor === "seller" && order.status === "requested" && manager ? (
            <Card>
              <CardHeader>
                <CardTitle>Accept this order</CardTitle>
              </CardHeader>
              <CardContent>
                <ActionForm action={acceptOrderAction} hidden={{ orderId: order.id }}>
                  <TextField
                    name="deliveryFee"
                    label="Delivery fee (₦)"
                    inputMode="decimal"
                    defaultValue="0"
                    disabled={order.delivery_method === "pickup"}
                    hint={order.delivery_method === "pickup" ? "Pickup orders have no delivery fee." : "The buyer sees this before paying."}
                  />
                  {order.delivery_method === "pickup" ? <input type="hidden" name="deliveryFee" value="0" /> : null}
                  <TextField name="expectedDeliveryDate" label={order.delivery_method === "pickup" ? "Ready for pickup on" : "Expected delivery date"} type="date" />
                  <TextAreaField name="deliveryTerms" label="Delivery / pickup terms" rows={2} placeholder="Who arranges transport, packaging, ice, timing…" />
                  <TextAreaField name="note" label="Note to buyer" rows={2} />
                  <p className="text-xs text-muted-foreground">Accepting confirms you can supply the quantities. Update the listing quantity yourself — stock is not reserved automatically.</p>
                  <SubmitButton variant="teal" className="w-full">
                    Accept order
                  </SubmitButton>
                </ActionForm>
              </CardContent>
            </Card>
          ) : null}

          {actor === "buyer" && order.status === "awaiting_payment" ? (
            <Card>
              <CardHeader>
                <CardTitle>Pay {formatMinor(order.total_minor, order.currency)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {provider ? (
                  <ActionForm action={startProviderPaymentAction} hidden={{ orderId: order.id }} refreshOnSuccess={false}>
                    <SubmitButton variant="teal" className="w-full" pendingText="Opening secure checkout…">
                      Pay online with {provider.displayName}
                    </SubmitButton>
                    <p className="text-xs text-muted-foreground">You will be sent to the provider&apos;s secure page. We never see your card details.</p>
                  </ActionForm>
                ) : null}
                {offlineEnabled ? (
                  <div className="rounded-md bg-muted p-3">
                    <p className="font-medium">Paying the seller directly</p>
                    <p className="mt-1 text-muted-foreground">
                      Pay as agreed with the seller (for example by bank transfer) and keep your receipt. The seller records the
                      payment here, and you will be notified.
                    </p>
                  </div>
                ) : null}
                {sandboxEnabled ? (
                  <ActionForm action={sandboxPayAction} hidden={{ orderId: order.id }} confirm="Simulate a payment? No real money will move.">
                    <SubmitButton variant="outline" className="w-full">
                      Simulate payment (sandbox)
                    </SubmitButton>
                    <p className="text-xs text-amber-800">Testing only. A sandbox payment is not a real transaction and is excluded from reports.</p>
                  </ActionForm>
                ) : null}
                {!provider && !offlineEnabled && !sandboxEnabled ? <p className="text-muted-foreground">Payment options are not configured yet. Contact support.</p> : null}
              </CardContent>
            </Card>
          ) : null}

          {(actor === "seller" && manager) || actor === "admin" ? (
            order.status === "awaiting_payment" && offlineEnabled ? (
              <Card>
                <CardHeader>
                  <CardTitle>Record a payment received</CardTitle>
                </CardHeader>
                <CardContent>
                  <ActionForm action={offlinePaymentAction} hidden={{ orderId: order.id }} confirm="Confirm you have received the full payment?">
                    <TextField name="reference" label="Transfer or receipt reference" required />
                    <TextField name="note" label="Note (optional)" />
                    <SubmitButton className="w-full">Mark as paid</SubmitButton>
                  </ActionForm>
                </CardContent>
              </Card>
            ) : null
          ) : null}

          {generic.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Next steps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {generic.map((to) =>
                  requiresReason(to) ? (
                    <details key={to} className="rounded-md border border-border p-3">
                      <summary className="cursor-pointer text-sm font-medium">{actionLabel(to, actor!)}</summary>
                      <ActionForm action={transitionOrderAction} hidden={{ orderId: order.id, to }} className="mt-3">
                        <TextAreaField name="note" label="Reason" rows={2} required />
                        <SubmitButton variant="danger" size="sm">
                          Confirm
                        </SubmitButton>
                      </ActionForm>
                    </details>
                  ) : (
                    <ActionForm key={to} action={transitionOrderAction} hidden={{ orderId: order.id, to }}>
                      <SubmitButton className="w-full" variant={to === "completed" || to === "delivered" ? "teal" : "default"}>
                        {actionLabel(to, actor!)}
                      </SubmitButton>
                    </ActionForm>
                  ),
                )}
              </CardContent>
            </Card>
          ) : null}

          {canDispute && !activeDispute ? (
            <Card>
              <CardContent className="space-y-2 text-sm">
                <p>Problem with this order?</p>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/disputes/new?order=${order.id}`}>Open a dispute</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {actor === "buyer" && order.status === "completed" && !review.data ? (
            <Card>
              <CardHeader>
                <CardTitle>Rate this supplier</CardTitle>
              </CardHeader>
              <CardContent>
                <ActionForm action={reviewAction} hidden={{ orderId: order.id, businessId: order.seller_business_id }}>
                  <SelectField
                    name="rating"
                    label="Rating"
                    options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${"★".repeat(n)} (${n})` }))}
                    required
                  />
                  <TextAreaField name="comment" label="Comment (optional)" rows={3} maxLength={2000} />
                  <SubmitButton>Submit review</SubmitButton>
                </ActionForm>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
