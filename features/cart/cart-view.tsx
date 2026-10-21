"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { DELIVERY_OPTIONS, NIGERIAN_STATES } from "@/lib/constants";
import type { ActionResult } from "@/lib/errors";
import { formatMinor } from "@/lib/money";
import { computeTotals } from "@/lib/orders/pricing";
import { checkoutAction } from "@/features/orders/actions";
import { groupBySupplier, removeFromCart, removeSupplierItems, updateQuantity, useCart, type CartItem } from "./store";

export function CartView({ signedIn, feeBps, taxBps }: { signedIn: boolean; feeBps: number; taxBps: number }) {
  const items = useCart();
  const groups = groupBySupplier(items);
  if (items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        description="Add fixed-price listings to your cart, or send a quotation request for bulk orders."
        action={
          <Button asChild>
            <Link href="/marketplace">Browse the marketplace</Link>
          </Button>
        }
      />
    );
  }
  return (
    <div className="space-y-6">
      <Alert tone="info">
        Each supplier receives a separate order request. Prices and availability are checked again when you submit, and
        the supplier confirms delivery fees before you pay.
      </Alert>
      {groups.map((g) => (
        <SupplierCheckout key={g.businessId} businessId={g.businessId} businessName={g.businessName} items={g.items} signedIn={signedIn} feeBps={feeBps} taxBps={taxBps} />
      ))}
    </div>
  );
}

function SupplierCheckout({
  businessId,
  businessName,
  items,
  signedIn,
  feeBps,
  taxBps,
}: {
  businessId: string;
  businessName: string;
  items: CartItem[];
  signedIn: boolean;
  feeBps: number;
  taxBps: number;
}) {
  const router = useRouter();
  const [delivery, setDelivery] = React.useState("pickup");
  const [result, setResult] = React.useState<ActionResult<{ orderId: string }> | null>(null);
  const [pending, startTransition] = React.useTransition();

  // Only delivery methods every item supports.
  const methods = DELIVERY_OPTIONS.filter((o) => items.every((i) => i.deliveryOptions.includes(o.value)));
  let preview: ReturnType<typeof computeTotals> | null = null;
  try {
    preview = computeTotals({
      lines: items.map((i) => ({ unitPriceMinor: i.unitPriceMinor, quantity: i.quantity })),
      marketplaceFeeBps: feeBps,
      taxBps,
    });
  } catch {
    preview = null;
  }
  const currency = items[0]?.currency ?? "NGN";

  function submit(formData: FormData) {
    formData.set("sellerBusinessId", businessId);
    formData.set("items", JSON.stringify(items.map((i) => ({ productId: i.productId, quantity: i.quantity }))));
    startTransition(async () => {
      const res = (await checkoutAction({ ok: true }, formData)) as ActionResult<{ orderId: string }>;
      setResult(res);
      if (res.ok && res.data?.orderId) {
        removeSupplierItems(businessId);
        router.push(`/dashboard/orders/${res.data.orderId}?placed=1`);
      }
    });
  }

  const fieldError = (k: string) => (result && !result.ok ? result.fieldErrors?.[k]?.join(" ") : undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order from {businessName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y divide-border">
          {items.map((i) => (
            <li key={i.productId} className="flex flex-wrap items-end gap-3 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/products/${i.productId}`} className="font-medium text-ocean-900 hover:underline">
                  {i.name}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {formatMinor(i.unitPriceMinor, i.currency)} / {i.unit} · min {i.minOrderQuantity} {i.unit}
                </p>
              </div>
              <div className="w-28">
                <Label htmlFor={`q-${i.productId}`}>Qty ({i.unit})</Label>
                <Input
                  id={`q-${i.productId}`}
                  inputMode="decimal"
                  value={i.quantity}
                  onChange={(e) => updateQuantity(i.productId, e.target.value.trim())}
                />
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeFromCart(i.productId)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit(new FormData(e.currentTarget));
          }}
        >
          {result && !result.ok ? <Alert tone="danger">{result.error}</Alert> : null}
          <div>
            <Label htmlFor={`dm-${businessId}`}>Delivery</Label>
            <Select id={`dm-${businessId}`} name="deliveryMethod" value={delivery} onChange={(e) => setDelivery(e.target.value)}>
              {methods.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
            {methods.length === 0 ? (
              <p className="mt-1 text-sm text-red-700">These items have no delivery method in common. Order them separately.</p>
            ) : null}
          </div>
          {delivery !== "pickup" ? (
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
              <div>
                <Label htmlFor={`addr-${businessId}`}>Delivery address</Label>
                <Input id={`addr-${businessId}`} name="deliveryAddress" autoComplete="street-address" aria-invalid={fieldError("deliveryAddress") ? true : undefined} />
                {fieldError("deliveryAddress") ? <p className="text-xs text-red-700">{fieldError("deliveryAddress")}</p> : null}
              </div>
              <div>
                <Label htmlFor={`st-${businessId}`}>State</Label>
                <Select id={`st-${businessId}`} name="deliveryState" defaultValue="">
                  <option value="">Choose…</option>
                  {NIGERIAN_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </Select>
                {fieldError("deliveryState") ? <p className="text-xs text-red-700">{fieldError("deliveryState")}</p> : null}
              </div>
            </div>
          ) : null}
          <div>
            <Label htmlFor={`note-${businessId}`}>Note to supplier (optional)</Label>
            <Textarea id={`note-${businessId}`} name="buyerNote" rows={2} maxLength={1000} />
          </div>

          {preview ? (
            <dl className="space-y-1 rounded-md bg-muted p-3 text-sm">
              <div className="flex justify-between">
                <dt>Items subtotal (estimate)</dt>
                <dd className="tabular-nums">{formatMinor(preview.subtotalMinor, currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Marketplace fee</dt>
                <dd className="tabular-nums">{formatMinor(preview.marketplaceFeeMinor, currency)}</dd>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <dt>Delivery fee</dt>
                <dd>Set by the supplier when they accept</dd>
              </div>
              <p className="pt-1 text-xs text-muted-foreground">You will see and confirm the final total before paying.</p>
            </dl>
          ) : (
            <p className="text-sm text-red-700">Check the quantities: use numbers with at most 3 decimals.</p>
          )}

          {signedIn ? (
            <Button type="submit" variant="teal" disabled={pending || methods.length === 0 || !preview} aria-busy={pending}>
              {pending ? "Sending…" : "Send order request"}
            </Button>
          ) : (
            <Button asChild>
              <Link href="/auth/sign-in?next=/cart">Sign in to place the order</Link>
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
