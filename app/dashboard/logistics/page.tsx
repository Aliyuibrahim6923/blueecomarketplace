import type { Metadata } from "next";
import Link from "next/link";
import { StatCard } from "@/components/charts/bar-chart";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { logisticsBusinesses, requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Logistics provider" };

export default async function LogisticsOverviewPage() {
  const viewer = await requireViewer("/dashboard/logistics");
  const ids = logisticsBusinesses(viewer).map((b) => b.id);
  if (!ids.length) {
    return (
      <>
        <PageHeader title="Logistics provider" />
        <EmptyState
          title="No logistics business yet"
          description="Create a business profile and tick “offers logistics or cold-chain services”."
          action={
            <Button asChild>
              <Link href="/dashboard/business">Business profile</Link>
            </Button>
          }
        />
      </>
    );
  }
  const supabase = await createClient();
  const [services, requested, active, completed] = await Promise.all([
    supabase.from("logistics_services").select("id", { count: "exact", head: true }).in("business_id", ids).eq("status", "published"),
    supabase.from("logistics_bookings").select("id", { count: "exact", head: true }).in("provider_business_id", ids).eq("status", "requested"),
    supabase.from("logistics_bookings").select("id", { count: "exact", head: true }).in("provider_business_id", ids).in("status", ["quoted", "confirmed", "in_progress"]),
    supabase.from("logistics_bookings").select("id", { count: "exact", head: true }).in("provider_business_id", ids).eq("status", "completed"),
  ]);
  return (
    <>
      <PageHeader
        title="Logistics provider"
        actions={
          <Button asChild variant="teal">
            <Link href="/dashboard/logistics/services/new">New service</Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Published services" value={services.count ?? 0} />
        <StatCard label="New requests" value={requested.count ?? 0} />
        <StatCard label="Active bookings" value={active.count ?? 0} />
        <StatCard label="Completed" value={completed.count ?? 0} />
      </div>
      <div className="mt-6 flex gap-3">
        <Button asChild variant="outline">
          <Link href="/dashboard/bookings?view=provider">See booking requests</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/logistics/services">Manage services</Link>
        </Button>
      </div>
    </>
  );
}
