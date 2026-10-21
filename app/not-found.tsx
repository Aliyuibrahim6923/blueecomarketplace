import Link from "next/link";
import { Logo } from "@/components/layout/logo";

export default function NotFound() {
  return (
    <main id="main" className="container-page flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <Logo />
      <h1 className="text-2xl font-bold text-ocean-950">Page not found</h1>
      <p className="text-muted-foreground">The page may have moved, or you may not have access to it.</p>
      <Link href="/" className="font-semibold text-ocean-700 underline">
        Go to the home page
      </Link>
    </main>
  );
}
