import type { Metadata } from "next";
import { ContentPage } from "@/components/layout/content-page";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <ContentPage
      title="About BlueMarket Nigeria"
      intro="A mobile-first digital marketplace for Nigeria's marine and coastal value chains, launching as a focused pilot."
    >
      <p>
        Many fishers, fish farmers and seafood businesses depend on informal networks to find buyers, compare prices and
        arrange transport and cold storage. BlueMarket aims to make that easier and more trustworthy by giving everyone a
        common channel for listings, orders, delivery coordination and dispute handling.
      </p>
      <h2>What BlueMarket is — and is not</h2>
      <ul>
        <li>It helps people find each other, agree terms and keep records. It does not own inventory, boats, cold rooms or vehicles.</li>
        <li>It is not a bank, wallet, escrow service or lender, and it does not hold buyers&apos; money.</li>
        <li>It does not replace government licensing, customs, export certification or food-safety systems.</li>
        <li>Verification badges reflect a review by the marketplace operations team, not a government endorsement.</li>
      </ul>
      <h2>Pilot</h2>
      <p>
        The first release is a controlled pilot in selected coastal markets. Features, fees and supported areas may change
        as we learn from participants. Aggregated, privacy-protecting statistics may be shared with authorised programme
        partners to inform planning.
      </p>
      <h2>Operator</h2>
      <p>
        The legal operator of the pilot will be named here once appointed. Until then, contact us through the Help page.
      </p>
    </ContentPage>
  );
}
