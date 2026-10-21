import type { Metadata } from "next";
import { ContentPage, DraftNotice } from "@/components/layout/content-page";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <ContentPage title="Terms of use" intro="The rules for using BlueMarket Nigeria during the pilot.">
      <DraftNotice />
      <h2>The service</h2>
      <p>
        BlueMarket is a marketplace that helps buyers, suppliers and logistics providers find each other, agree terms and
        keep records. Contracts for goods and services are between the buyer and the seller or provider. BlueMarket does not
        own the goods listed and is not a party to those contracts unless stated otherwise.
      </p>
      <h2>Accounts</h2>
      <ul>
        <li>Give accurate information and keep your password secure. You are responsible for activity on your account.</li>
        <li>Business accounts must be operated by people authorised to act for that business.</li>
        <li>We may suspend accounts that break these terms or the marketplace rules, and we record the reason.</li>
      </ul>
      <h2>Listings and orders</h2>
      <ul>
        <li>Sellers must describe products honestly, keep availability up to date, and comply with applicable law, including fisheries and food-safety rules.</li>
        <li>An order is agreed when the seller accepts it. Prices, fees and delivery terms shown at acceptance apply.</li>
        <li>Do not claim certifications, origin or sustainability you cannot evidence.</li>
      </ul>
      <h2>Payments and fees</h2>
      <p>
        Online payments are processed by a licensed payment provider. BlueMarket does not store card details, operate
        wallets or hold funds. Any marketplace fee is shown separately before payment.
      </p>
      <h2>Verification and ratings</h2>
      <p>
        A verification badge means the BlueMarket operations team reviewed the business&apos;s documents. It is not a
        government licence, endorsement or guarantee. Ratings reflect buyers&apos; experiences of completed orders only.
      </p>
      <h2>Prohibited conduct</h2>
      <ul>
        <li>Fraud, impersonation, fake reviews, counterfeit documents, or listing illegal or unsafe products.</li>
        <li>Harassment, spam, scraping, or attempts to access data you are not authorised to see.</li>
      </ul>
      <h2>Liability</h2>
      <p>To be finalised during legal review, consistent with Nigerian consumer-protection law.</p>
    </ContentPage>
  );
}
