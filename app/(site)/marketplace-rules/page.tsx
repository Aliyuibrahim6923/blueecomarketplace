import type { Metadata } from "next";
import { ContentPage, DraftNotice } from "@/components/layout/content-page";

export const metadata: Metadata = { title: "Marketplace rules & disputes" };

export default function MarketplaceRulesPage() {
  return (
    <ContentPage title="Marketplace rules, moderation & disputes">
      <DraftNotice />
      <h2>Listing rules</h2>
      <ul>
        <li>List only products you can supply, at the quantity and quality described.</li>
        <li>Use your own photos. Mark origin, handling and certification details honestly — they are shown as self-declared.</li>
        <li>Listings expire after a set period unless you confirm availability. Pause listings you cannot fulfil.</li>
      </ul>
      <h2>Moderation</h2>
      <p>
        Anyone can report a listing, business, user or service. Moderators may hide a listing, suspend a business or account,
        and must record a reason. You are notified with the reason and can appeal by contacting support. Every moderation
        action is recorded in an audit log.
      </p>
      <h2>Cancellations</h2>
      <ul>
        <li>Before payment, the buyer can cancel, and the seller can decline or cancel with a reason.</li>
        <li>After payment, open a dispute with the category &ldquo;Request to cancel&rdquo;. Our team decides whether to refund.</li>
      </ul>
      <h2>Dispute process</h2>
      <ol className="list-decimal pl-5">
        <li>Open a dispute from the order page (non-delivery, quality, quantity, not as described, payment, cancellation request).</li>
        <li>Both parties can add messages and upload evidence (photos, receipts). Evidence is private to the parties and our team.</li>
        <li>An administrator reviews the case, may request more evidence, and records a decision: refund, partial refund, complete the order, or no action.</li>
        <li>Both parties are notified. Where a licensed payment provider&apos;s own dispute or chargeback process applies, it takes precedence for the money movement.</li>
      </ol>
      <p>Target response times and escalation routes will be confirmed before public launch.</p>
    </ContentPage>
  );
}
