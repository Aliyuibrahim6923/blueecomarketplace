import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/layout/content-page";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "For suppliers" };

export default function ForSuppliersPage() {
  return (
    <ContentPage
      title="Sell on BlueMarket"
      intro="For artisanal fishers, cooperatives, fish farmers, processors and wholesalers who want more buyers without losing control of price and terms."
    >
      <h2>What you can do</h2>
      <ul>
        <li>Publish listings from your phone with photos, quantity, price or &ldquo;price on request&rdquo;.</li>
        <li>Receive enquiries and order requests, and reply with quotations for bulk buyers.</li>
        <li>Accept or decline each order with a reason, and set the delivery fee and date.</li>
        <li>Update status as you prepare, dispatch and deliver — buyers are notified automatically.</li>
        <li>See which listings get views, saves, enquiries and orders.</li>
        <li>Add team members to help manage your business.</li>
      </ul>
      <h2>Getting verified</h2>
      <p>
        Upload a supporting document (for example CAC registration, cooperative registration or a fisheries licence) from
        your business profile. Our team reviews it and tells you the outcome or what is missing. Documents are stored
        privately and only visible to your business and authorised reviewers.
      </p>
      <h2>Fees</h2>
      <p>
        Any marketplace fee is shown separately on every order before the buyer pays. The fee level is set by the platform
        operator and published in the order breakdown.
      </p>
      <h2>Need help getting started?</h2>
      <p>
        Cooperatives and associations can ask our support team for assisted onboarding. See{" "}
        <Link href="/help" className="underline">
          Help & contact
        </Link>
        .
      </p>
      <div className="mt-6">
        <Button asChild variant="teal" size="lg">
          <Link href="/auth/sign-up?role=supplier">Create a supplier account</Link>
        </Button>
      </div>
    </ContentPage>
  );
}
