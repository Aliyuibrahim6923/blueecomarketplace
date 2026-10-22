import type { Metadata, Viewport } from "next";
import { publicEnvIssues } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "BlueMarket Nigeria — Digital Blue Economy Marketplace",
    template: "%s · BlueMarket Nigeria",
  },
  description:
    "Find and trade fresh fish, frozen seafood, aquaculture and processed marine products in Nigeria, and book delivery and cold-chain services.",
  applicationName: "BlueMarket Nigeria",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0b3654",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const issues = publicEnvIssues();
  return (
    <html lang="en-NG">
      <body className="min-h-screen">{issues.length ? <SetupRequired issues={issues} /> : children}</body>
    </html>
  );
}

/** Shown instead of the app when required environment variables are missing (names only, never values). */
function SetupRequired({ issues }: { issues: string[] }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-2xl font-bold text-ocean-950">BlueMarket needs to be configured</h1>
      <p className="mt-2 text-muted-foreground">This deployment is missing required settings:</p>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-red-800">
        {issues.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted-foreground">
        On Vercel: Project → Settings → Environment Variables. Add the values from Supabase → Project Settings → API, for
        Production and Preview, then redeploy (variables starting with NEXT_PUBLIC_ are built into the app, so a redeploy is
        required).
      </p>
    </main>
  );
}
