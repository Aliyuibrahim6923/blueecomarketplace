"use server";

import { redirect } from "next/navigation";
import { absoluteUrl } from "@/lib/env";
import { authed, fromDbError, notSignedIn, parseForm } from "@/lib/actions";
import type { ActionResult } from "@/lib/errors";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  onboardingSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/schemas";

export async function signInAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(signInSchema, formData);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    // Same message for unknown email and wrong password (no account enumeration).
    if (/confirm/i.test(error.message)) {
      return { ok: false, error: "Please confirm your email address first. Check your inbox for the link." };
    }
    return { ok: false, error: "Email or password is incorrect." };
  }
  redirect(safeRedirectPath(parsed.data.next, "/dashboard"));
}

export async function signUpAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(signUpSchema, formData);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: absoluteUrl("/auth/callback?next=/onboarding"),
      // Only self-service roles are honoured by the database trigger.
      data: { full_name: parsed.data.fullName, intended_role: parsed.data.intendedRole },
    },
  });
  if (error) {
    if (/password/i.test(error.message)) return { ok: false, error: "Choose a stronger password." };
    if (/rate|too many/i.test(error.message)) return { ok: false, error: "Too many attempts. Please wait and try again." };
    return { ok: false, error: "We could not create the account. Please try again." };
  }
  if (data.session) redirect("/onboarding");
  return {
    ok: true,
    message: `Check ${parsed.data.email} for a confirmation link. After confirming you can finish setting up your account.`,
  };
}

export async function forgotPasswordAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(forgotPasswordSchema, formData);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: absoluteUrl("/auth/callback?next=/auth/reset-password"),
  });
  // Always the same response, whether or not the email exists.
  return { ok: true, message: "If an account uses that email, we have sent a link to reset the password." };
}

export async function resetPasswordAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(resetPasswordSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return { ok: false, error: "This reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: "Could not update the password. Try a different one." };
  redirect("/dashboard?password=updated");
}

export async function completeOnboardingAction(_prev: ActionResult<unknown>, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(onboardingSchema, formData, ["roles"]);
  if (!parsed.ok) return parsed.result;
  const { supabase, user } = await authed();
  if (!user) return notSignedIn;
  const { error } = await supabase.rpc("complete_onboarding", {
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone ?? null,
    p_roles: parsed.data.roles,
    p_accept_terms: parsed.data.acceptTerms,
    p_marketing_consent: parsed.data.marketingConsent,
  });
  if (error) return fromDbError(error);
  const sells = parsed.data.roles.includes("supplier") || parsed.data.roles.includes("logistics_provider");
  redirect(sells ? "/dashboard/business?welcome=1" : "/marketplace");
}
