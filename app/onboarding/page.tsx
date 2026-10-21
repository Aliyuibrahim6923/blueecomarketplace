import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/form/action-form";
import { CheckboxField, SubmitButton, TextField } from "@/components/form/fields";
import { Logo } from "@/components/layout/logo";
import { completeOnboardingAction } from "@/features/auth/actions";
import { requireViewer } from "@/lib/auth";
import { SELF_SERVICE_ROLES } from "@/lib/constants";

export const metadata: Metadata = { title: "Set up your account" };

export default async function OnboardingPage() {
  const viewer = await requireViewer("/onboarding");
  if (viewer.profile.onboarding_completed) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-ocean-50">
      <header className="container-page py-6">
        <Logo />
      </header>
      <main id="main" className="container-page pb-16">
        <div className="mx-auto max-w-xl rounded-lg border border-border bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-ocean-950">Welcome to BlueMarket</h1>
          <p className="mt-1 text-sm text-muted-foreground">A few details so buyers and suppliers know who they are dealing with.</p>
          <ActionForm action={completeOnboardingAction} className="mt-6" refreshOnSuccess={false}>
            <TextField name="fullName" label="Full name" defaultValue={viewer.profile.full_name} autoComplete="name" required />
            <TextField
              name="phone"
              label="Phone number"
              type="tel"
              autoComplete="tel"
              defaultValue={viewer.profile.phone ?? ""}
              hint="Nigerian numbers like +2348012345678. Shared only with people you trade with."
            />
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-ocean-900">How will you use BlueMarket?</legend>
              {SELF_SERVICE_ROLES.map((r) => (
                <CheckboxField
                  key={r.value}
                  name="roles"
                  value={r.value}
                  label={r.label}
                  hint={r.description}
                  defaultChecked={viewer.roles.includes(r.value)}
                />
              ))}
            </fieldset>
            <CheckboxField name="acceptTerms" label="I accept the terms of use and privacy notice" />
            <CheckboxField
              name="marketingConsent"
              label="Send me occasional marketplace news (optional)"
              hint="You can change this any time in Account settings."
            />
            <SubmitButton className="w-full" variant="teal">
              Continue
            </SubmitButton>
          </ActionForm>
        </div>
      </main>
    </div>
  );
}
