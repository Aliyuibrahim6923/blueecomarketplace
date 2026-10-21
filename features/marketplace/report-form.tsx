import { ActionForm } from "@/components/form/action-form";
import { SelectField, SubmitButton, TextAreaField } from "@/components/form/fields";
import { REPORT_REASONS } from "@/lib/constants";
import { reportContentAction } from "./actions";

/** Collapsible "Report this" form (works without JS via <details>). */
export function ReportForm({ targetType, targetId, label = "Report this listing" }: { targetType: string; targetId: string; label?: string }) {
  return (
    <details className="rounded-md border border-border bg-white p-3 text-sm">
      <summary className="cursor-pointer font-medium text-muted-foreground">{label}</summary>
      <ActionForm action={reportContentAction} hidden={{ targetType, targetId }} className="mt-3" resetOnSuccess refreshOnSuccess={false}>
        <SelectField name="reason" label="Reason" options={REPORT_REASONS} required />
        <TextAreaField name="details" label="What did you notice?" rows={3} maxLength={2000} />
        <SubmitButton variant="outline" size="sm" pendingText="Sending…">
          Send report
        </SubmitButton>
      </ActionForm>
    </details>
  );
}
