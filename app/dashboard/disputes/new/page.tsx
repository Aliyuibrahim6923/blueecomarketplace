import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/form/action-form";
import { SelectField, SubmitButton, TextAreaField } from "@/components/form/fields";
import { Card, CardContent, PageHeader } from "@/components/ui/primitives";
import { openDisputeAction } from "@/features/disputes/actions";
import { requireViewer } from "@/lib/auth";
import { DISPUTE_CATEGORIES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Open a dispute" };

export default async function NewDisputePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const orderId = sp.order ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) notFound();
  await requireViewer(`/dashboard/disputes/new?order=${orderId}`);
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("id, order_number, status").eq("id", orderId).maybeSingle();
  if (!order) notFound();

  const categories = DISPUTE_CATEGORIES.filter((c) => c.value !== "cancellation_request" || ["paid", "preparing"].includes(order.status as string));

  return (
    <>
      <PageHeader
        title={`Open a dispute for ${order.order_number as string}`}
        description="Describe what happened. Both parties and the BlueMarket team can see the dispute. You can add photos or receipts on the next page."
      />
      <Card className="max-w-2xl">
        <CardContent>
          <ActionForm action={openDisputeAction} hidden={{ orderId: order.id as string }} refreshOnSuccess={false} confirm="Open a dispute? The order will be paused until it is resolved.">
            <SelectField name="category" label="What is the problem?" options={categories} required />
            <TextAreaField name="description" label="Details" rows={6} required hint="Dates, quantities, what was agreed and what happened." />
            <div className="flex gap-2">
              <SubmitButton variant="danger">Open dispute</SubmitButton>
              <Link href={`/dashboard/orders/${order.id as string}`} className="inline-flex h-10 items-center px-3 text-sm underline">
                Cancel
              </Link>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </>
  );
}
