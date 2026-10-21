import "server-only";
import { z } from "zod";

/** Server-only configuration. Optional integrations stay disabled when unset. */
const serverSchema = z.object({
  supabaseSecretKey: z.string().min(20).optional(),
  cronSecret: z.string().min(16).optional(),
  paymentProvider: z.enum(["paystack"]).optional(),
  paystackSecretKey: z.string().min(10).optional(),
  resendApiKey: z.string().min(10).optional(),
  emailFrom: z.string().default("BlueMarket Nigeria <no-reply@example.com>"),
  smsWebhookUrl: z.url().optional(),
  smsWebhookToken: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

const empty = (v: string | undefined) => (v && v.trim() !== "" ? v.trim() : undefined);

export function serverEnv(): ServerEnv {
  const parsed = serverSchema.safeParse({
    supabaseSecretKey: empty(process.env.SUPABASE_SECRET_KEY) ?? empty(process.env.SUPABASE_SERVICE_ROLE_KEY),
    cronSecret: empty(process.env.CRON_SECRET),
    paymentProvider: empty(process.env.PAYMENT_PROVIDER),
    paystackSecretKey: empty(process.env.PAYSTACK_SECRET_KEY),
    resendApiKey: empty(process.env.RESEND_API_KEY),
    emailFrom: empty(process.env.EMAIL_FROM),
    smsWebhookUrl: empty(process.env.SMS_WEBHOOK_URL),
    smsWebhookToken: empty(process.env.SMS_WEBHOOK_TOKEN),
  });
  if (!parsed.success) {
    // Never echo values — only which settings are malformed.
    const keys = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid server configuration for: ${keys}`);
  }
  return parsed.data;
}
