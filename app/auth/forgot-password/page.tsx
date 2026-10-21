import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/form/action-form";
import { SubmitButton, TextField } from "@/components/form/fields";
import { forgotPasswordAction } from "@/features/auth/actions";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-ocean-950">Reset your password</h1>
      <p className="mt-1 text-sm text-muted-foreground">We&apos;ll email you a link to choose a new password.</p>
      <ActionForm action={forgotPasswordAction} className="mt-6" resetOnSuccess refreshOnSuccess={false}>
        <TextField name="email" label="Email" type="email" autoComplete="email" required />
        <SubmitButton className="w-full" pendingText="Sending…">
          Send reset link
        </SubmitButton>
      </ActionForm>
      <p className="mt-4 text-center text-sm">
        <Link href="/auth/sign-in" className="text-ocean-700 underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
