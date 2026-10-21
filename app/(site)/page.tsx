import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/marketplace/product-card";
import { EmptyState } from "@/components/ui/primitives";
import { SearchIcon, ShieldIcon, SnowIcon, TruckIcon } from "@/components/icons";
import { listCategories, searchProducts } from "@/features/products/queries";


export default async function HomePage() {
  const [categories, latest] = await Promise.all([listCategories(), searchProducts({ sort: "newest", pageSize: 8 })]);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ocean-900 text-white">
        <svg className="absolute inset-x-0 bottom-0 w-full text-ocean-800" viewBox="0 0 1440 160" preserveAspectRatio="none" aria-hidden>
          <path fill="currentColor" d="M0 96c120-32 240-32 360 0s240 32 360 0 240-32 360 0 240 32 360 0v64H0z" />
        </svg>
        <div className="container-page relative grid gap-10 py-14 md:grid-cols-2 md:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-teal-100">Pilot · Digital Blue Economy Marketplace</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
              Trade fish and seafood with buyers and suppliers you can check.
            </h1>
            <p className="mt-4 max-w-xl text-ocean-100">
              BlueMarket Nigeria connects fishers, fish farmers, processors, restaurants, wholesalers and cold-chain
              providers. List what you have, find what you need, and track every order from request to delivery.
            </p>
            <form action="/marketplace" className="mt-6 flex max-w-xl gap-2" role="search">
              <label htmlFor="hero-q" className="sr-only">
                Search the marketplace
              </label>
              <input
                id="hero-q"
                name="q"
                placeholder="Search catfish, croaker, prawns…"
                className="h-12 flex-1 rounded-md border-0 px-4 text-base text-ocean-950"
              />
              <Button type="submit" size="lg" variant="coral" aria-label="Search">
                <SearchIcon />
                <span className="hidden sm:inline">Search</span>
              </Button>
            </form>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild variant="teal" size="lg">
                <Link href="/auth/sign-up?role=supplier">Start selling</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-white/40 bg-transparent text-white hover:bg-white/10">
                <Link href="/marketplace">Browse listings</Link>
              </Button>
            </div>
          </div>
          <ul className="grid content-center gap-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
            {[
              { icon: <ShieldIcon />, title: "Clear verification", text: "See which businesses were reviewed and which details are self-declared." },
              { icon: <SearchIcon />, title: "Fixed price or quote", text: "Order fixed-price listings directly or ask for a quotation for bulk volumes." },
              { icon: <TruckIcon />, title: "Delivery coordination", text: "Book delivery with listed providers and see terms before you confirm." },
              { icon: <SnowIcon />, title: "Cold-chain services", text: "Find refrigerated transport, cold rooms and ice near your market." },
            ].map((f) => (
              <li key={f.title} className="rounded-lg bg-white/5 p-4 ring-1 ring-white/10">
                <span className="text-teal-100">{f.icon}</span>
                <p className="mt-2 font-semibold">{f.title}</p>
                <p className="mt-1 text-sm text-ocean-100">{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Categories */}
      <section className="container-page py-12" aria-labelledby="cat-h">
        <div className="flex items-end justify-between">
          <h2 id="cat-h" className="text-2xl font-bold text-ocean-950">
            Product categories
          </h2>
          <Link href="/categories" className="text-sm font-semibold text-ocean-700 hover:underline">
            All categories
          </Link>
        </div>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={`/marketplace?category=${c.slug}`}
                className="block h-full rounded-lg border border-border bg-white p-4 hover:border-ocean-300 hover:shadow-sm"
              >
                <span className="font-semibold text-ocean-900">{c.name}</span>
                {c.description ? <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{c.description}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Latest listings: real data only */}
      <section className="container-page pb-12" aria-labelledby="latest-h">
        <div className="flex items-end justify-between">
          <h2 id="latest-h" className="text-2xl font-bold text-ocean-950">
            Recently listed
          </h2>
          <Link href="/marketplace?sort=newest" className="text-sm font-semibold text-ocean-700 hover:underline">
            See all
          </Link>
        </div>
        {latest.results.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              title="No listings yet"
              description="The pilot marketplace is opening. Suppliers can create the first listings now."
              action={
                <Button asChild variant="teal">
                  <Link href="/auth/sign-up?role=supplier">List your products</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {latest.results.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-white py-12" aria-labelledby="how-h">
        <div className="container-page">
          <h2 id="how-h" className="text-2xl font-bold text-ocean-950">
            How it works
          </h2>
          <ol className="mt-6 grid gap-6 md:grid-cols-4">
            {[
              ["Create an account", "Choose buyer, supplier or logistics provider. You can do more than one."],
              ["List or search", "Suppliers publish what is available; buyers filter by product, state and price."],
              ["Agree terms", "Send an order request or ask for a quote. The seller confirms quantity, price and delivery."],
              ["Track to delivery", "Every status change is recorded. Raise a dispute if something goes wrong."],
            ].map(([title, text], i) => (
              <li key={title} className="rounded-lg bg-ocean-50 p-5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ocean-700 text-sm font-bold text-white">{i + 1}</span>
                <p className="mt-3 font-semibold text-ocean-900">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-6">
            <Link href="/how-it-works" className="text-sm font-semibold text-ocean-700 hover:underline">
              Read the full guide
            </Link>
          </div>
        </div>
      </section>

      <section className="container-page grid gap-4 py-12 md:grid-cols-2">
        <div className="rounded-lg bg-teal-600 p-6 text-white">
          <h2 className="text-xl font-bold">Selling fish or seafood?</h2>
          <p className="mt-2 text-teal-50">
            Publish listings from your phone, receive enquiries and orders, and get verified to build trust with new buyers.
          </p>
          <Button asChild variant="outline" className="mt-4 border-white bg-white text-teal-700 hover:bg-teal-50">
            <Link href="/for-suppliers">For suppliers</Link>
          </Button>
        </div>
        <div className="rounded-lg bg-ocean-800 p-6 text-white">
          <h2 className="text-xl font-bold">Run a cold room, reefer truck or ice plant?</h2>
          <p className="mt-2 text-ocean-100">List your service areas and capacity, and receive booking requests from buyers and sellers.</p>
          <Button asChild variant="outline" className="mt-4 border-white bg-white text-ocean-800 hover:bg-ocean-50">
            <Link href="/logistics">Logistics & cold chain</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
