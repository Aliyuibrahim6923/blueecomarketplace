import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/layout/content-page";

export const metadata: Metadata = { title: "How it works" };

export default function HowItWorksPage() {
  return (
    <ContentPage title="How BlueMarket works" intro="A simple, recorded process from listing to delivery, built for phones and patchy connections.">
      <h2>1. Create an account</h2>
      <p>
        Sign up with your email and confirm it. Choose how you will use BlueMarket — buying, selling, offering logistics, or
        more than one. Sellers and logistics providers then create a business profile.
      </p>
      <h2>2. Verification (optional, recommended)</h2>
      <p>
        Businesses can submit documents such as a CAC certificate, cooperative registration or fisheries licence. The
        BlueMarket operations team reviews them and records a decision. A &ldquo;Verified business&rdquo; badge means our team
        reviewed the business; it is <strong>not</strong> a government endorsement or a guarantee of product safety.
        Everything else a seller writes is labelled as self-declared.
      </p>
      <h2>3. List or search</h2>
      <p>
        Suppliers publish listings with price (or &ldquo;price on request&rdquo;), quantity, location, product state and delivery
        options. Listings expire after a set number of days unless the supplier confirms they are still available, so
        buyers see recent stock.
      </p>
      <h2>4. Order or ask for a quote</h2>
      <ul>
        <li>Fixed-price listings can go straight into your cart. Each supplier receives a separate order request.</li>
        <li>For bulk or recurring orders, send an enquiry. The supplier can reply with a quotation you accept or decline.</li>
        <li>The supplier accepts the order and confirms the delivery fee and expected date. Acceptance does not reserve stock until then.</li>
      </ul>
      <h2>5. Pay and fulfil</h2>
      <p>
        You see the item subtotal, delivery fee, marketplace fee, any tax and the total before paying. During the pilot,
        payment may be made outside the platform and recorded by the seller. Online payments will use a licensed payment
        provider; BlueMarket never stores card details or holds funds.
      </p>
      <h2>6. Track, confirm, review</h2>
      <p>
        Every status change — preparing, dispatched, delivered — is recorded with a timestamp. Confirm receipt to complete
        the order, then leave a rating. If something goes wrong, open a dispute from the order page.
      </p>
      <p>
        <Link href="/marketplace-rules" className="font-semibold text-ocean-700 underline">
          Read the marketplace rules and dispute process
        </Link>
      </p>
    </ContentPage>
  );
}
