import Link from "next/link";

/**
 * Public, login-free marketplace. No account links, no cart, no session reads:
 * every visitor sees the same public listings (anonymous RLS applies).
 */
export default function PublicMarketLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Link href="/market" className="inline-flex items-center gap-2 font-bold text-ocean-900" aria-label="BlueMarket Nigeria marketplace">
            <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden>
              <rect width="32" height="32" rx="8" fill="#0b3654" />
              <path d="M5 19c3.2-2.6 6.4-2.6 9.6 0s6.4 2.6 9.6 0" stroke="#0e9488" strokeWidth="2.6" fill="none" strokeLinecap="round" />
              <path d="M5 13c3.2-2.6 6.4-2.6 9.6 0s6.4 2.6 9.6 0" stroke="#a9d0e7" strokeWidth="2.6" fill="none" strokeLinecap="round" />
              <circle cx="25" cy="8" r="2" fill="#e8603f" />
            </svg>
            <span className="text-lg leading-none">
              BlueMarket <span className="font-medium text-teal-600">Marketplace</span>
            </span>
          </Link>
          <nav aria-label="Market" className="flex items-center gap-4 text-sm font-medium text-ocean-800">
            <Link href="/market" className="hover:underline">
              All listings
            </Link>
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="mt-12 border-t border-border bg-white py-6">
        <div className="container-page space-y-2 text-xs text-muted-foreground">
          <p>
            Listings are published by independent sellers. Contact sellers directly to agree price, quantity and delivery.
            &ldquo;Verified business&rdquo; means the BlueMarket team reviewed the business; it is not a government endorsement or a
            product-safety guarantee. Prices in Nigerian Naira (₦).
          </p>
          <p className="flex flex-wrap gap-4">
            <Link href="/privacy" className="underline">
              Privacy
            </Link>
            <Link href="/terms" className="underline">
              Terms
            </Link>
            <Link href="/marketplace-rules" className="underline">
              Marketplace rules
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
