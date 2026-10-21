import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState, PageHeader } from "@/components/ui/primitives";
import { ListingForm } from "@/features/products/listing-form";
import { listCategories } from "@/features/products/queries";
import { requireViewer, supplierBusinesses } from "@/lib/auth";

export const metadata: Metadata = { title: "New listing" };

export default async function NewListingPage() {
  const viewer = await requireViewer("/dashboard/supplier/listings/new");
  const businesses = supplierBusinesses(viewer).filter((b) => b.status === "active");
  const categories = await listCategories();
  return (
    <>
      <PageHeader title="New listing" description="Save as a draft, then add photos. Publish when it is ready for buyers." />
      {businesses.length === 0 ? (
        <EmptyState
          title="You need an active supplier business"
          action={
            <Button asChild>
              <Link href="/dashboard/business">Business profile</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent>
            <ListingForm
              businesses={businesses.map((b) => ({ id: b.id, name: b.name }))}
              categories={categories.map((c) => ({ id: c.id, name: c.name }))}
              defaults={{ locationState: businesses[0]?.state_code ?? "" }}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
