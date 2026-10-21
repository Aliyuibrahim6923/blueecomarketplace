import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/form/action-form";
import { SubmitButton, TextField } from "@/components/form/fields";
import { Alert } from "@/components/ui/primitives";
import { resetPasswordAction } from "@/features/auth/actions";
import { getViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <>
        <h1 className="text-2xl font-bold text-ocean-950">Link expired</h1>
        <Alert tone="warning" className="mt-4">
          This password reset link has expired or was already used.
        </Alert>
        <p className="mt-4 text-sm">
          <Link href="/auth/forgot-password" className="font-semibold text-ocean-700 underline">
            Request a new link
          </Link>
        </p>
      </>
    );
  }
  return (
    <>
      <h1 className="text-2xl font-bold text-ocean-950">Choose a new password</h1>
      <ActionForm action={resetPasswordAction} className="mt-6" refreshOnSuccess={false}>
        <TextField name="password" label="New password" type="password" autoComplete="new-password" hint="At least 10 characters with letters and numbers." required />
        <TextField name="confirm" label="Confirm new password" type="password" autoComplete="new-password" required />
        <SubmitButton className="w-full">Update password</SubmitButton>
      </ActionForm>
    </>
  );
}
