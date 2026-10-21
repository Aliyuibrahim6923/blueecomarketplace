import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { CartView } from "@/features/cart/cart-view";
import { getPublicSettings, settingNumber } from "@/features/products/queries";
import { getViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage() {
  const [viewer, settings] = await Promise.all([getViewer(), getPublicSettings()]);
  return (
    <div className="container-page max-w-3xl py-8">
      <PageHeader title="Cart" description="Review quantities and delivery, then send an order request to each supplier." />
      <CartView signedIn={!!viewer} feeBps={settingNumber(settings, "marketplace_fee_bps", 0)} taxBps={settingNumber(settings, "tax_bps", 0)} />
    </div>
  );
}
