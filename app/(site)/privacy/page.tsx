import type { Metadata } from "next";
import { ContentPage, DraftNotice } from "@/components/layout/content-page";

export const metadata: Metadata = { title: "Privacy notice" };

export default function PrivacyPage() {
  return (
    <ContentPage title="Privacy notice" intro="How BlueMarket Nigeria collects, uses and protects personal data.">
      <DraftNotice />
      <p>
        This notice is written with the Nigeria Data Protection Act 2023 (NDPA) and guidance from the Nigeria Data
        Protection Commission in mind. The data controller is the platform operator, to be named before launch.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Account data: name, email, phone number (optional), chosen roles, and consent choices.</li>
        <li>Business data: trading name, category, location, service areas, and — privately — address, registration number and contact details.</li>
        <li>Verification documents you upload (stored privately, visible only to your business and authorised reviewers).</li>
        <li>Marketplace records: listings, enquiries, messages, quotations, orders, status history, reviews, disputes and evidence.</li>
        <li>Payment records: references, amounts and status from the payment provider. We never collect or store card numbers.</li>
        <li>Basic technical data needed to keep the service secure (for example to apply rate limits).</li>
      </ul>
      <h2>Why we use it (lawful bases)</h2>
      <ul>
        <li>To provide the marketplace you signed up for (contract).</li>
        <li>To prevent fraud, keep the platform safe and keep audit records (legitimate interests and legal obligations).</li>
        <li>To send optional marketing messages (consent — you can withdraw any time).</li>
      </ul>
      <h2>Who can see it</h2>
      <ul>
        <li>The people you trade with see the contact and delivery details needed to complete an order.</li>
        <li>Public business profiles show only the details the business chooses to make public.</li>
        <li>Authorised BlueMarket staff can access records to provide support, moderation and dispute resolution. Their actions are logged.</li>
        <li>Programme or agency partners receive only aggregated statistics. Small groups that could identify a person or business are suppressed.</li>
        <li>Service providers who host or deliver the service (hosting, database, email/SMS, payments) under contract.</li>
      </ul>
      <h2>Your rights</h2>
      <p>
        You can access, correct and download your data (Account & privacy → Download my data), object to or restrict some
        processing, withdraw consent, and request deletion. Some records — such as completed transactions and audit logs —
        may have to be kept for a period required by law. You can complain to the Nigeria Data Protection Commission.
      </p>
      <h2>Retention</h2>
      <p>Retention periods for each record type will be set during legal review and published here.</p>
      <h2>Security</h2>
      <p>
        Data is encrypted in transit, access is restricted by role and enforced in the database, private files are served
        through short-lived links, and privileged actions are recorded in an audit log.
      </p>
    </ContentPage>
  );
}
