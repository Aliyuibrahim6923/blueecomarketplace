import "server-only";
import { serverEnv } from "@/lib/env.server";

/**
 * Optional external channels for notifications. In-app notifications are written
 * by the database and always work; these adapters only deliver copies.
 * When a provider is not configured, delivery returns "skipped" — never an error.
 */

export type DeliveryResult = { status: "sent" | "skipped" | "failed"; error?: string };

export interface EmailSender {
  send(to: string, subject: string, text: string): Promise<DeliveryResult>;
}
export interface SmsSender {
  send(to: string, message: string): Promise<DeliveryResult>;
}

class ResendEmailSender implements EmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}
  async send(to: string, subject: string, text: string): Promise<DeliveryResult> {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: this.from, to: [to], subject, text }),
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok ? { status: "sent" } : { status: "failed", error: `Email provider returned ${res.status}` };
    } catch {
      return { status: "failed", error: "Email provider unreachable" };
    }
  }
}

/** POSTs {to, message} to an HTTPS bridge for the approved SMS provider. */
class WebhookSmsSender implements SmsSender {
  constructor(
    private readonly url: string,
    private readonly token?: string,
  ) {}
  async send(to: string, message: string): Promise<DeliveryResult> {
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
        body: JSON.stringify({ to, message }),
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok ? { status: "sent" } : { status: "failed", error: `SMS bridge returned ${res.status}` };
    } catch {
      return { status: "failed", error: "SMS bridge unreachable" };
    }
  }
}

const skipped: DeliveryResult = { status: "skipped", error: "Provider not configured" };

export function getEmailSender(): EmailSender {
  const env = serverEnv();
  if (env.resendApiKey) return new ResendEmailSender(env.resendApiKey, env.emailFrom);
  return { send: async () => skipped };
}

export function getSmsSender(): SmsSender {
  const env = serverEnv();
  if (env.smsWebhookUrl) return new WebhookSmsSender(env.smsWebhookUrl, env.smsWebhookToken);
  return { send: async () => skipped };
}

/**
 * Lock-screen-safe message text: titles from the database already avoid amounts
 * and personal details; we add only a generic pointer back to the app.
 */
export function externalMessage(title: string, link: string | null, siteUrl: string) {
  const url = link ? new URL(link, siteUrl).toString() : siteUrl;
  return {
    subject: `BlueMarket: ${title}`,
    text: `${title}\n\nSign in to BlueMarket Nigeria to see the details:\n${url}\n\nYou can change notification preferences in Account settings.`,
    sms: `BlueMarket: ${title}. Open the app for details.`,
  };
}
