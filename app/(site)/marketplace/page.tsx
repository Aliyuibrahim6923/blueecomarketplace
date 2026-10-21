import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/marketplace/product-card";
import { Pagination } from "@/components/marketplace/pagination";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, Input, Label, Select } from "@/components/ui/primitives";
import { DELIVERY_OPTIONS, NIGERIAN_STATES, PAGE_SIZE, PRODUCT_STATES } from "@/lib/constants";
import { parseMajorToMinor } from "@/lib/money";
import { humanize } from "@/lib/utils";
import { listCategories, searchProducts, type SearchFilters } from "@/features/products/queries";

export const metadata: Metadata = { title: "Marketplace" };

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

const SORTS = [
  { value: "relevance", label: "Best match" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
] as const;

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const params = {
    q: one(sp.q)?.slice(0, 100),
    category: one(sp.category),
    state: one(sp.state),
    product_state: one(sp.product_state),
    min: one(sp.min),
    max: one(sp.max),
    verified: one(sp.verified),
    delivery: one(sp.delivery),
    fixed: one(sp.fixed),
    sort: one(sp.sort),
  };
  const page = Math.max(1, Math.min(500, Number(one(sp.page)) || 1));
  const sort = SORTS.some((s) => s.value === params.sort) ? (params.sort as SearchFilters["sort"]) : undefined;

  const filters: SearchFilters = {
    q: params.q,
    category: params.category,
    state: NIGERIAN_STATES.some((s) => s.code === params.state) ? params.state : undefined,
    productState: (PRODUCT_STATES as readonly string[]).includes(params.product_state ?? "") ? params.product_state : undefined,
    minPrice: params.min ? (parseMajorToMinor(params.min) ?? undefined) : undefined,
    maxPrice: params.max ? (parseMajorToMinor(params.max) ?? undefined) : undefined,
    verifiedOnly: params.verified === "1",
    delivery: DELIVERY_OPTIONS.some((d) => d.value === params.delivery) ? params.delivery : undefined,
    fixedOnly: params.fixed === "1",
    sort,
    page,
  };

  const [categories, { results, total, error }] = await Promise.all([listCategories(), searchProducts(filters)]);
  const activeCategory = categories.find((c) => c.slug === params.category);

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold text-ocean-950">{activeCategory ? activeCategory.name : "Marketplace"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Listings are published by suppliers and expire unless refreshed, so what you see is recent. Check verification
        status and delivery terms before you order.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_1fr]">
        {/* Filters: a plain GET form so it works without JavaScript */}
        <form action="/marketplace" className="space-y-4 rounded-lg border border-border bg-white p-4 lg:sticky lg:top-20 lg:self-start" role="search">
          <div>
            <Label htmlFor="f-q">Search</Label>
            <Input id="f-q" name="q" defaultValue={params.q} placeholder="Product or supplier" />
          </div>
          <div>
            <Label htmlFor="f-cat">Category</Label>
            <Select id="f-cat" name="category" defaultValue={params.category ?? ""}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="f-state">Location (state)</Label>
            <Select id="f-state" name="state" defaultValue={filters.state ?? ""}>
              <option value="">Anywhere in Nigeria</option>
              {NIGERIAN_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="f-ps">Product state</Label>
            <Select id="f-ps" name="product_state" defaultValue={filters.productState ?? ""}>
              <option value="">Any</option>
              {PRODUCT_STATES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-ocean-900">Price per unit (₦)</legend>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <Input name="min" inputMode="decimal" aria-label="Minimum price in naira" placeholder="Min" defaultValue={params.min} />
              <Input name="max" inputMode="decimal" aria-label="Maximum price in naira" placeholder="Max" defaultValue={params.max} />
            </div>
          </fieldset>
          <div>
            <Label htmlFor="f-del">Delivery option</Label>
            <Select id="f-del" name="delivery" defaultValue={filters.delivery ?? ""}>
              <option value="">Any</option>
              {DELIVERY_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="verified" value="1" defaultChecked={filters.verifiedOnly} className="h-4 w-4" />
            Verified businesses only
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="fixed" value="1" defaultChecked={filters.fixedOnly} className="h-4 w-4" />
            Fixed price only (no quote needed)
          </label>
          <div>
            <Label htmlFor="f-sort">Sort by</Label>
            <Select id="f-sort" name="sort" defaultValue={sort ?? (params.q ? "relevance" : "newest")}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              Apply
            </Button>
            <Button asChild variant="outline">
              <Link href="/marketplace">Clear</Link>
            </Button>
          </div>
        </form>

        <section aria-live="polite">
          {error ? (
            <Alert tone="danger" title="Search is unavailable right now">
              Please try again in a moment.
            </Alert>
          ) : results.length === 0 ? (
            <EmptyState
              title="No listings match your search"
              description="Try a broader search, another state, or remove some filters. You can also ask suppliers for a quote."
              action={
                <Button asChild variant="outline">
                  <Link href="/marketplace">Show all listings</Link>
                </Button>
              }
            />
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                {total.toLocaleString("en-NG")} listing{total === 1 ? "" : "s"}
              </p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
              <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/marketplace" params={params} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
