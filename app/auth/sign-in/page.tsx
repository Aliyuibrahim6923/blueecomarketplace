import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/form/action-form";
import { SubmitButton, TextField } from "@/components/form/fields";
import { Alert } from "@/components/ui/primitives";
import { signInAction } from "@/features/auth/actions";
import { safeRedirectPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = safeRedirectPath(sp.next, "/dashboard");
  return (
    <>
      <h1 className="text-2xl font-bold text-ocean-950">Sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        New to BlueMarket?{" "}
        <Link href="/auth/sign-up" className="font-semibold text-ocean-700 underline">
          Create an account
        </Link>
      </p>
      {sp.error === "link" ? (
        <Alert tone="warning" className="mt-4">
          That link has expired or was already used. Sign in, or request a new link.
        </Alert>
      ) : null}
      <ActionForm action={signInAction} hidden={{ next }} className="mt-6" refreshOnSuccess={false}>
        <TextField name="email" label="Email" type="email" autoComplete="email" required />
        <TextField name="password" label="Password" type="password" autoComplete="current-password" required />
        <SubmitButton className="w-full" pendingText="Signing in…">
          Sign in
        </SubmitButton>
      </ActionForm>
      <p className="mt-4 text-center text-sm">
        <Link href="/auth/forgot-password" className="text-ocean-700 underline">
          Forgot your password?
        </Link>
      </p>
    </>
  );
}
