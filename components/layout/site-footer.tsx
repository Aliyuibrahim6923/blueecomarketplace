import Link from "next/link";
import { Logo } from "./logo";

const COLUMNS = [
  {
    title: "Marketplace",
    links: [
      { href: "/marketplace", label: "Browse listings" },
      { href: "/categories", label: "Product categories" },
      { href: "/logistics", label: "Logistics & cold chain" },
    ],
  },
  {
    title: "Get started",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/for-suppliers", label: "For suppliers" },
      { href: "/for-buyers", label: "For buyers" },
      { href: "/auth/sign-up", label: "Create an account" },
    ],
  },
  {
    title: "Trust & help",
    links: [
      { href: "/help", label: "Help & contact" },
      { href: "/marketplace-rules", label: "Marketplace rules & disputes" },
      { href: "/privacy", label: "Privacy notice" },
      { href: "/terms", label: "Terms of use" },
      { href: "/about", label: "About" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-white">
      <div className="container-page grid gap-8 py-10 md:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-muted-foreground">
            A digital marketplace connecting Nigeria&apos;s fishers, fish farmers, processors, buyers and cold-chain
            providers. Pilot release.
          </p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="text-sm font-semibold text-ocean-900">{c.title}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted-foreground hover:text-ocean-900 hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border py-4">
        <p className="container-page text-xs text-muted-foreground">
          Verification badges mean a business was reviewed by the BlueMarket operations team. They are not a
          government endorsement, licence or guarantee of product safety. Prices are in Nigerian Naira (₦).
        </p>
      </div>
    </footer>
  );
}
