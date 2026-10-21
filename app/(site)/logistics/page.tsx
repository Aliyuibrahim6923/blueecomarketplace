import type { Metadata } from "next";
import Link from "next/link";
import { VerificationBadge } from "@/components/marketplace/badges";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, Label, PageHeader, Select } from "@/components/ui/primitives";
import { LOGISTICS_SERVICE_TYPES, NIGERIAN_STATES, stateName } from "@/lib/constants";
import { formatMinor } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { VerificationStatus } from "@/types/domain";

export const metadata: Metadata = { title: "Logistics & cold-chain services" };

export default async function LogisticsDirectoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const type = LOGISTICS_SERVICE_TYPES.some((t) => t.value === sp.type) ? sp.type : undefined;
  const state = NIGERIAN_STATES.some((s) => s.code === sp.state) ? sp.state : undefined;

  const supabase = await createClient();
  let q = supabase
    .from("logistics_services")
    .select("id, service_type, title, description, coverage_states, capacity_description, temperature_range, base_price_minor, currency, pricing_unit, business:businesses(name, slug, verification_status)")
    .eq("status", "published")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(60);
  if (type) q = q.eq("service_type", type);
  if (state) q = q.contains("coverage_states", [state]);
  const { data, error } = await q;

  return (
    <div className="container-page py-8">
      <PageHeader
        title="Logistics & cold-chain services"
        description="Find delivery, refrigerated transport, cold storage and ice suppliers. Bookings are request-and-confirm: the provider confirms price and date before anything is agreed. There is no live vehicle tracking."
        actions={
          <Button asChild variant="teal">
            <Link href="/auth/sign-up?role=logistics_provider">List your service</Link>
          </Button>
        }
      />
      <form action="/logistics" className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-white p-4">
        <div>
          <Label htmlFor="l-type">Service</Label>
          <Select id="l-type" name="type" defaultValue={type ?? ""}>
            <option value="">All services</option>
            {LOGISTICS_SERVICE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="l-state">Covers state</Label>
          <Select id="l-state" name="state" defaultValue={state ?? ""}>
            <option value="">Any state</option>
            {NIGERIAN_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit">Filter</Button>
      </form>

      {error ? (
        <EmptyState title="The directory is unavailable right now" description="Please try again shortly." />
      ) : !data?.length ? (
        <EmptyState title="No services match" description="Try another state or service type." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {data.map((s) => {
            const b = (Array.isArray(s.business) ? s.business[0] : s.business) as { name: string; slug: string; verification_status: VerificationStatus } | null;
            return (
              <li key={s.id as string} className="rounded-lg border border-border bg-white p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="info">{LOGISTICS_SERVICE_TYPES.find((t) => t.value === s.service_type)?.label}</Badge>
                  {s.temperature_range ? <Badge tone="neutral">{s.temperature_range as string}</Badge> : null}
                </div>
                <h2 className="mt-2 text-lg font-semibold text-ocean-950">
                  <Link href={`/logistics/${s.id as string}`} className="hover:underline">
                    {s.title as string}
                  </Link>
                </h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.description as string}</p>
                <p className="mt-2 text-sm">
                  <span className="font-medium">Covers:</span> {(s.coverage_states as string[]).map(stateName).join(", ")}
                </p>
                {s.capacity_description ? <p className="text-sm"><span className="font-medium">Capacity:</span> {s.capacity_description as string}</p> : null}
                <p className="mt-2 text-sm font-semibold text-ocean-900">
                  {s.base_price_minor ? `From ${formatMinor(s.base_price_minor as number, s.currency as string)} ${s.pricing_unit ?? ""}` : "Price on request"}
                </p>
                {b ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-ocean-800">{b.name}</span>
                    <VerificationBadge status={b.verification_status} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
