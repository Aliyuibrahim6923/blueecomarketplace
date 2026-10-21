import type { Metadata, Viewport } from "next";
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
  return (
    <html lang="en-NG">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
