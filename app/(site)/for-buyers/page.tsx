import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/layout/content-page";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "For buyers" };

export default function ForBuyersPage() {
  return (
    <ContentPage
      title="Buy on BlueMarket"
      intro="For restaurants, hotels, retailers, wholesalers, exporters and households sourcing fish and seafood."
    >
      <h2>Find supply</h2>
      <ul>
        <li>Search by product, supplier, category and state; filter by price, product state, delivery option and verification.</li>
        <li>See how recently each listing was updated, the minimum order and what is available.</li>
        <li>Save listings and come back to them, and reorder from past orders.</li>
      </ul>
      <h2>Agree clear terms</h2>
      <ul>
        <li>Order fixed-price listings directly, or request a quotation for larger or recurring volumes.</li>
        <li>The supplier confirms quantity, delivery fee and expected date before you pay.</li>
        <li>You always see the subtotal, delivery fee, marketplace fee, any tax and the total — separately.</li>
      </ul>
      <h2>Stay protected</h2>
      <ul>
        <li>Every status change is recorded with a time. Confirm receipt when the goods arrive.</li>
        <li>Open a dispute from the order page for non-delivery, quality or quantity problems, and upload evidence.</li>
        <li>Report suspicious listings or businesses at any time.</li>
      </ul>
      <p>
        Check the verification badge and the &ldquo;self-declared&rdquo; labels. Ratings come from completed orders only and are
        not proof of regulatory compliance or product safety.
      </p>
      <div className="mt-6">
        <Button asChild size="lg">
          <Link href="/marketplace">Browse the marketplace</Link>
        </Button>
      </div>
    </ContentPage>
  );
}
