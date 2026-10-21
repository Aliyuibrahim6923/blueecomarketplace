import { z } from "zod";

/**
 * Public configuration. NEXT_PUBLIC_* values must be referenced literally so
 * Next.js can inline them into client bundles.
 */
const publicSchema = z.object({
  supabaseUrl: z.url({ message: "NEXT_PUBLIC_SUPABASE_URL must be a URL" }),
  supabaseKey: z.string().min(20, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or _ANON_KEY) is missing"),
  siteUrl: z.url().default("http://localhost:3000"),
  supportEmail: z.string().optional(),
  supportPhone: z.string().optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;

let cached: PublicEnv | undefined;

export function publicEnv(): PublicEnv {
  if (cached) return cached;
  const parsed = publicSchema.safeParse({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || undefined,
    supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || undefined,
    supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || undefined,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `- ${i.message}`).join("\n");
    throw new Error(`BlueMarket is missing required configuration:\n${issues}\nSee .env.example.`);
  }
  cached = parsed.data;
  return cached;
}

/** Absolute URL on this site, e.g. absoluteUrl("/auth/confirm"). */
export function absoluteUrl(path: string): string {
  return new URL(path, publicEnv().siteUrl).toString();
}
