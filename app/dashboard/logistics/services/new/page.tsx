import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState, PageHeader } from "@/components/ui/primitives";
import { ServiceForm } from "@/features/logistics/service-form";
import { logisticsBusinesses, requireViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "New service" };

export default async function NewServicePage() {
  const viewer = await requireViewer("/dashboard/logistics/services/new");
  const businesses = logisticsBusinesses(viewer).filter((b) => b.status === "active");
  return (
    <>
      <PageHeader title="New logistics service" />
      {businesses.length === 0 ? (
        <EmptyState
          title="You need an active logistics business"
          action={
            <Button asChild>
              <Link href="/dashboard/business">Business profile</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent>
            <ServiceForm businesses={businesses.map((b) => ({ id: b.id, name: b.name }))} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
