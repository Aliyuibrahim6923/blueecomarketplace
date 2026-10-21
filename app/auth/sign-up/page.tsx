import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/form/action-form";
import { CheckboxField, SelectField, SubmitButton, TextField } from "@/components/form/fields";
import { signUpAction } from "@/features/auth/actions";
import { SELF_SERVICE_ROLES } from "@/lib/constants";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const role = SELF_SERVICE_ROLES.some((r) => r.value === sp.role) ? sp.role : "buyer";
  return (
    <>
      <h1 className="text-2xl font-bold text-ocean-950">Create your account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Already registered?{" "}
        <Link href="/auth/sign-in" className="font-semibold text-ocean-700 underline">
          Sign in
        </Link>
      </p>
      <ActionForm action={signUpAction} className="mt-6" resetOnSuccess refreshOnSuccess={false}>
        <TextField name="fullName" label="Full name" autoComplete="name" required />
        <TextField name="email" label="Email" type="email" autoComplete="email" required />
        <TextField
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 10 characters with letters and numbers."
          required
        />
        <SelectField
          name="intendedRole"
          label="I mainly want to"
          defaultValue={role}
          options={SELF_SERVICE_ROLES.map((r) => ({ value: r.value, label: r.label }))}
          hint="You can add more roles later."
        />
        <CheckboxField
          name="acceptTerms"
          label="I accept the terms of use and privacy notice"
          hint="Read the terms and privacy notice from the links in the footer."
        />
        <SubmitButton className="w-full" variant="teal" pendingText="Creating account…">
          Create account
        </SubmitButton>
      </ActionForm>
      <p className="mt-4 text-xs text-muted-foreground">
        <Link href="/terms" className="underline">
          Terms of use
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="underline">
          Privacy notice
        </Link>
      </p>
    </>
  );
}
