import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/marketplace/product-card";
import { Pagination } from "@/components/marketplace/pagination";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, Input, Label, Select } from "@/components/ui/primitives";
import { listCategories, searchProducts, type SearchFilters } from "@/features/products/queries";
import { NIGERIAN_STATES, PAGE_SIZE, PRODUCT_STATES } from "@/lib/constants";
import { parseMajorToMinor } from "@/lib/money";
import { humanize } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Fish & seafood marketplace",
  description: "Browse fresh fish, frozen seafood, aquaculture and processed marine products from sellers across Nigeria.",
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "relevance", label: "Best match" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
] as const;

export default async function PublicMarketPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const params = {
    q: one(sp.q)?.slice(0, 100),
    category: one(sp.category),
    state: one(sp.state),
    product_state: one(sp.product_state),
    min: one(sp.min),
    max: one(sp.max),
    verified: one(sp.verified),
    sort: one(sp.sort),
  };
  const page = Math.max(1, Math.min(500, Number(one(sp.page)) || 1));
  const sort = SORTS.some((s) => s.value === params.sort) ? (params.sort as SearchFilters["sort"]) : undefined;

  const filters: SearchFilters = {
    q: params.q,
    category: params.category && /^[a-z0-9-]{1,80}$/.test(params.category) ? params.category : undefined,
    state: NIGERIAN_STATES.some((s) => s.code === params.state) ? params.state : undefined,
    productState: (PRODUCT_STATES as readonly string[]).includes(params.product_state ?? "") ? params.product_state : undefined,
    minPrice: params.min ? (parseMajorToMinor(params.min) ?? undefined) : undefined,
    maxPrice: params.max ? (parseMajorToMinor(params.max) ?? undefined) : undefined,
    verifiedOnly: params.verified === "1",
    sort,
    page,
  };

  const [categories, { results, total, error }] = await Promise.all([listCategories(), searchProducts(filters)]);
  const activeCategory = categories.find((c) => c.slug === filters.category);

  return (
    <>
      <section className="bg-ocean-900 text-white">
        <div className="container-page py-8 sm:py-10">
          <h1 className="text-2xl font-bold sm:text-3xl">{activeCategory ? activeCategory.name : "Fish & seafood from across Nigeria"}</h1>
          <p className="mt-2 max-w-2xl text-sm text-ocean-100">
            Browse what sellers have available today. No account needed — open a listing to contact the seller directly.
          </p>
          <form action="/market" role="search" className="mt-5 flex max-w-xl gap-2">
            {filters.category ? <input type="hidden" name="category" value={filters.category} /> : null}
            <label htmlFor="m-q" className="sr-only">
              Search listings
            </label>
            <input
              id="m-q"
              name="q"
              defaultValue={params.q}
              placeholder="Search catfish, croaker, prawns…"
              className="h-12 flex-1 rounded-md border-0 px-4 text-base text-ocean-950"
            />
            <Button type="submit" size="lg" variant="coral">
              Search
            </Button>
          </form>
        </div>
      </section>

      <div className="container-page py-6">
        <nav aria-label="Categories" className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1 text-sm">
          <Link
            href="/market"
            className={`shrink-0 rounded-full border px-3 py-1.5 ${!filters.category ? "border-ocean-700 bg-ocean-50 font-semibold" : "border-border bg-white"}`}
          >
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/market?category=${c.slug}`}
              className={`shrink-0 rounded-full border px-3 py-1.5 ${filters.category === c.slug ? "border-ocean-700 bg-ocean-50 font-semibold" : "border-border bg-white"}`}
            >
              {c.name}
            </Link>
          ))}
        </nav>

        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          <details className="rounded-lg border border-border bg-white p-4 lg:sticky lg:top-20 lg:self-start" open>
            <summary className="cursor-pointer text-sm font-semibold text-ocean-900">Filters</summary>
            <form action="/market" className="mt-3 space-y-4">
              {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
              {filters.category ? <input type="hidden" name="category" value={filters.category} /> : null}
              <div>
                <Label htmlFor="mf-state">State</Label>
                <Select id="mf-state" name="state" defaultValue={filters.state ?? ""}>
                  <option value="">Anywhere in Nigeria</option>
                  {NIGERIAN_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="mf-ps">Product state</Label>
                <Select id="mf-ps" name="product_state" defaultValue={filters.productState ?? ""}>
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
                  <Input name="min" inputMode="decimal" aria-label="Minimum price" placeholder="Min" defaultValue={params.min} />
                  <Input name="max" inputMode="decimal" aria-label="Maximum price" placeholder="Max" defaultValue={params.max} />
                </div>
              </fieldset>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="verified" value="1" defaultChecked={filters.verifiedOnly} className="h-4 w-4" />
                Verified businesses only
              </label>
              <div>
                <Label htmlFor="mf-sort">Sort by</Label>
                <Select id="mf-sort" name="sort" defaultValue={sort ?? (params.q ? "relevance" : "newest")}>
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
                  <Link href="/market">Clear</Link>
                </Button>
              </div>
            </form>
          </details>

          <section aria-live="polite">
            {error ? (
              <Alert tone="danger" title="Listings are unavailable right now">
                Please try again in a moment.
              </Alert>
            ) : results.length === 0 ? (
              <EmptyState
                title="No listings match"
                description="Try a broader search, another state or category."
                action={
                  <Button asChild variant="outline">
                    <Link href="/market">Show all listings</Link>
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
                    <ProductCard key={p.id} product={p} hrefBase="/market/p" />
                  ))}
                </div>
                <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/market" params={params} />
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
