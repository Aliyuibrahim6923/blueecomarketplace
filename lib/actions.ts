import "server-only";
import type { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { fieldErrors, formDataToObject } from "@/lib/validation/common";

type Parsed<T> = { ok: true; data: T } | { ok: false; result: ActionResult<never> };

/**
 * Validate FormData with a Zod schema. `arrays` lists keys that may repeat
 * (checkbox groups) so they always arrive as arrays.
 */
export function parseForm<S extends z.ZodType>(schema: S, formData: FormData, arrays: string[] = []): Parsed<z.output<S>> {
  const raw: Record<string, unknown> = formDataToObject(formData);
  for (const key of arrays) {
    const v = raw[key];
    raw[key] = v === undefined ? [] : Array.isArray(v) ? v : [v];
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      result: { ok: false, error: "Please correct the highlighted fields.", fieldErrors: fieldErrors(parsed.error) },
    };
  }
  return { ok: true, data: parsed.data };
}

/** Supabase client + signed-in user, or an error result. */
export async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export const notSignedIn: ActionResult<never> = { ok: false, error: "Your session has ended. Please sign in again." };

export function fromDbError(error: { code?: string; message?: string } | null, fallback?: string): ActionResult<never> {
  if (error && !["22023", "P0002", "P0429", "42501", "23505"].includes(error.code ?? "")) {
    // Unexpected error: log the code only (no payloads, no personal data).
    console.error("Database error", error.code);
  }
  return { ok: false, error: friendlyError(error, fallback) };
}
