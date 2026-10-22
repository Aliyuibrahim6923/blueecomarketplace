import { z } from "zod";

/**
 * Public configuration. NEXT_PUBLIC_* values must be referenced literally so
 * Next.js can inline them into client bundles.
 */
const publicSchema = z.object({
  supabaseUrl: z.url({ message: "NEXT_PUBLIC_SUPABASE_URL is missing or is not a full https:// URL" }),
  supabaseKey: z.string().min(20, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) is missing"),
  siteUrl: z.url(),
  supportEmail: z.string().optional(),
  supportPhone: z.string().optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;

const clean = (v: string | undefined) => {
  const t = v?.trim().replace(/^["']|["']$/g, "");
  return t ? t : undefined;
};

/** Site URL: explicit setting if valid, else the Vercel deployment URL, else localhost. Never fatal. */
function resolveSiteUrl(): string {
  const candidates = [
    clean(process.env.NEXT_PUBLIC_SITE_URL),
    clean(process.env.VERCEL_PROJECT_PRODUCTION_URL),
    clean(process.env.VERCEL_URL),
  ];
  for (const c of candidates) {
    if (!c) continue;
    const withScheme = /^https?:\/\//.test(c) ? c : `https://${c}`;
    try {
      return new URL(withScheme).origin;
    } catch {
      // try the next candidate
    }
  }
  return "http://localhost:3000";
}

function parsePublicEnv() {
  return publicSchema.safeParse({
    supabaseUrl: clean(process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/+$/, ""),
    supabaseKey: clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ?? clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    siteUrl: resolveSiteUrl(),
    supportEmail: clean(process.env.NEXT_PUBLIC_SUPPORT_EMAIL),
    supportPhone: clean(process.env.NEXT_PUBLIC_SUPPORT_PHONE),
  });
}

let cached: PublicEnv | undefined;

/** Human-readable configuration problems (variable names only, never values). Empty when OK. */
export function publicEnvIssues(): string[] {
  const parsed = parsePublicEnv();
  return parsed.success ? [] : parsed.error.issues.map((i) => i.message);
}

export function publicEnv(): PublicEnv {
  if (cached) return cached;
  const parsed = parsePublicEnv();
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
