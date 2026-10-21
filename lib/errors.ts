/**
 * Turn database / Supabase errors into messages that are safe to show.
 * Our SQL functions raise friendly messages with specific SQLSTATEs; anything
 * else is replaced with a generic message so internals never leak.
 */

type PgLikeError = { code?: string; message?: string } | null | undefined;

const FRIENDLY_CODES = new Set([
  "22023", // invalid_parameter_value — business rule messages
  "P0002", // no_data_found
  "P0429", // rate limit
]);

export function friendlyError(error: PgLikeError, fallback = "Something went wrong. Please try again."): string {
  if (!error) return fallback;
  const code = error.code ?? "";
  const message = error.message ?? "";

  if (code === "42501") {
    // Our own permission messages are written for users; RLS/grant errors are not.
    if (/row-level security|permission denied/i.test(message)) {
      return "You don't have permission to do that.";
    }
    return message || "You don't have permission to do that.";
  }
  if (code === "23505") return "That already exists.";
  if (code === "23514") return "Some of the values are not allowed. Check the form and try again.";
  if (code === "23503") return "A linked record no longer exists. Refresh the page and try again.";
  if (FRIENDLY_CODES.has(code) && message) return message;
  return fallback;
}

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export const initialActionState: ActionResult = { ok: true };
