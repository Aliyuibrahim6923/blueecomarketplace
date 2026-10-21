import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { CartIcon, MenuIcon } from "@/components/icons";
import { Logo } from "./logo";
import { CartCount } from "@/features/cart/cart-count";

const NAV = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/categories", label: "Categories" },
  { href: "/logistics", label: "Logistics & cold chain" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/for-suppliers", label: "For suppliers" },
  { href: "/for-buyers", label: "For buyers" },
];

export async function SiteHeader() {
  const viewer = await getViewer();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-5 text-sm font-medium text-ocean-800">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="hover:text-ocean-950 hover:underline">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/cart" className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-ocean-800 hover:bg-ocean-50" aria-label="Cart">
            <CartIcon />
            <CartCount />
          </Link>
          {viewer ? (
            <Button asChild size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/auth/sign-in">Sign in</Link>
              </Button>
              <Button asChild size="sm" variant="teal">
                <Link href="/auth/sign-up">Join</Link>
              </Button>
            </>
          )}
          {/* Mobile menu without client JS */}
          <details className="relative lg:hidden">
            <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-md text-ocean-800 hover:bg-ocean-50" aria-label="Menu">
              <MenuIcon />
            </summary>
            <nav aria-label="Mobile" className="absolute right-0 mt-2 w-64 rounded-lg border border-border bg-white p-2 shadow-lg">
              <ul className="text-sm font-medium text-ocean-900">
                {NAV.map((n) => (
                  <li key={n.href}>
                    <Link href={n.href} className="block rounded-md px-3 py-2.5 hover:bg-ocean-50">
                      {n.label}
                    </Link>
                  </li>
                ))}
                {!viewer ? (
                  <li>
                    <Link href="/auth/sign-in" className="block rounded-md px-3 py-2.5 hover:bg-ocean-50">
                      Sign in
                    </Link>
                  </li>
                ) : null}
              </ul>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
