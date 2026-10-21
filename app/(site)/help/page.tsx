import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/form/action-form";
import { SelectField, SubmitButton, TextAreaField, TextField } from "@/components/form/fields";
import { ContentPage } from "@/components/layout/content-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { supportRequestAction } from "@/features/marketplace/actions";
import { getViewer } from "@/lib/auth";
import { SUPPORT_TOPICS } from "@/lib/constants";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Help & contact" };

export default async function HelpPage() {
  const viewer = await getViewer();
  const { supportEmail, supportPhone } = publicEnv();
  return (
    <ContentPage title="Help & contact" intro="Answers to common questions, and how to reach the BlueMarket team.">
      <h2>Common questions</h2>
      <ul>
        <li>
          <strong>I didn&apos;t get the confirmation email.</strong> Check spam, then try signing up again with the same address — a new link is sent.
        </li>
        <li>
          <strong>How do I get verified?</strong> Open Dashboard → Business profile & verification and upload a supporting document.
        </li>
        <li>
          <strong>Something went wrong with an order.</strong> Open the order and choose &ldquo;Open a dispute&rdquo;. Attach photos or receipts.
        </li>
        <li>
          <strong>I want a copy of my data, or to delete my account.</strong> Go to Dashboard → Account & privacy.
        </li>
        <li>
          <strong>A listing looks fake or unsafe.</strong> Use &ldquo;Report this listing&rdquo; on the listing page. Reports are reviewed by our team.
        </li>
      </ul>
      <p>
        See also the{" "}
        <Link href="/marketplace-rules" className="underline">
          marketplace rules and dispute process
        </Link>
        .
      </p>
      {supportEmail || supportPhone ? (
        <p>
          You can also reach support at {supportEmail ? <a className="underline" href={`mailto:${supportEmail}`}>{supportEmail}</a> : null}
          {supportEmail && supportPhone ? " or " : null}
          {supportPhone ? <a className="underline" href={`tel:${supportPhone}`}>{supportPhone}</a> : null}.
        </p>
      ) : null}

      <Card className="mt-8 not-prose">
        <CardHeader>
          <CardTitle>Send us a message</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={supportRequestAction} resetOnSuccess refreshOnSuccess={false}>
            <TextField name="name" label="Your name" defaultValue={viewer?.profile.full_name ?? ""} required />
            <TextField name="email" label="Email for our reply" type="email" defaultValue={viewer?.email ?? ""} required />
            <SelectField name="topic" label="Topic" options={SUPPORT_TOPICS} required />
            <TextAreaField name="message" label="Message" rows={5} required hint="Do not include passwords or card details." />
            <SubmitButton pendingText="Sending…">Send message</SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>
    </ContentPage>
  );
}
