import { ActionForm } from "@/components/form/action-form";
import { CheckboxGroup, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/form/fields";
import { LOGISTICS_SERVICE_TYPES, NIGERIAN_STATES } from "@/lib/constants";
import { minorToMajorString } from "@/lib/money";
import type { LogisticsService } from "@/types/domain";
import { saveServiceAction } from "./actions";

export function ServiceForm({ service, businesses }: { service?: LogisticsService; businesses: { id: string; name: string }[] }) {
  return (
    <ActionForm action={saveServiceAction} hidden={{ serviceId: service?.id }}>
      <SelectField
        name="businessId"
        label="Business"
        defaultValue={service?.business_id ?? businesses[0]?.id}
        options={businesses.map((b) => ({ value: b.id, label: b.name }))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="serviceType" label="Service type" defaultValue={service?.service_type ?? "refrigerated_transport"} options={LOGISTICS_SERVICE_TYPES} />
        <TextField name="title" label="Title" defaultValue={service?.title} required placeholder="e.g. 3-tonne reefer van, Lagos–Ogun" />
      </div>
      <TextAreaField name="description" label="Description" rows={4} defaultValue={service?.description} required />
      <CheckboxGroup
        name="coverageStates"
        legend="States covered"
        options={NIGERIAN_STATES.map((s) => ({ value: s.code, label: s.name }))}
        defaultValues={service?.coverage_states ?? []}
        columns={3}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="capacityDescription" label="Capacity" defaultValue={service?.capacity_description ?? ""} placeholder="e.g. 3 tonnes per trip, 40 pallets" />
        <TextField name="temperatureRange" label="Temperature range" defaultValue={service?.temperature_range ?? ""} placeholder="e.g. 0°C to 4°C" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="basePrice" label="Indicative price from (₦, optional)" inputMode="decimal" defaultValue={minorToMajorString(service?.base_price_minor)} />
        <TextField name="pricingUnit" label="Per" defaultValue={service?.pricing_unit ?? ""} placeholder="trip, km, pallet per week…" />
      </div>
      <TextAreaField name="pricingNotes" label="Pricing notes" rows={2} defaultValue={service?.pricing_notes ?? ""} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="intent" value="draft" variant="outline">
          Save draft
        </SubmitButton>
        <SubmitButton name="intent" value="publish" variant="teal">
          Save and publish
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
