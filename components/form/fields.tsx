"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Alert, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import type { ActionResult } from "@/lib/errors";
import { cn } from "@/lib/utils";

/** Provided by <ActionForm>: latest action result + pending flag. */
export const ActionFormContext = React.createContext<{ state: ActionResult<unknown> | null; pending: boolean }>({
  state: null,
  pending: false,
});

function useContextErrors(name: string, explicit?: string[]) {
  const { state } = React.useContext(ActionFormContext);
  if (explicit) return explicit;
  return state && !state.ok ? state.fieldErrors?.[name] : undefined;
}

type BaseProps = {
  name: string;
  label: string;
  hint?: string;
  errors?: string[];
  required?: boolean;
  className?: string;
};

function useIds(name: string) {
  const id = React.useId();
  return { inputId: `${id}-${name}`, hintId: `${id}-${name}-hint`, errorId: `${id}-${name}-error` };
}

function FieldShell({
  label,
  hint,
  errors,
  required,
  className,
  ids,
  children,
}: Omit<BaseProps, "name"> & { ids: ReturnType<typeof useIds>; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={ids.inputId}>
        {label}
        {required ? <span className="text-coral-600"> *</span> : null}
      </Label>
      {children}
      {hint ? (
        <p id={ids.hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {errors?.length ? (
        <p id={ids.errorId} className="text-xs font-medium text-red-700">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(ids: ReturnType<typeof useIds>, hint?: string, errors?: string[]) {
  return [hint ? ids.hintId : null, errors?.length ? ids.errorId : null].filter(Boolean).join(" ") || undefined;
}

export function TextField({
  name,
  label,
  hint,
  errors,
  required,
  className,
  ...props
}: BaseProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name">) {
  const ids = useIds(name);
  errors = useContextErrors(name, errors);
  return (
    <FieldShell label={label} hint={hint} errors={errors} required={required} className={className} ids={ids}>
      <Input
        id={ids.inputId}
        name={name}
        required={required}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy(ids, hint, errors)}
        {...props}
      />
    </FieldShell>
  );
}

export function TextAreaField({
  name,
  label,
  hint,
  errors,
  required,
  className,
  ...props
}: BaseProps & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name">) {
  const ids = useIds(name);
  errors = useContextErrors(name, errors);
  return (
    <FieldShell label={label} hint={hint} errors={errors} required={required} className={className} ids={ids}>
      <Textarea
        id={ids.inputId}
        name={name}
        required={required}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy(ids, hint, errors)}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({
  name,
  label,
  hint,
  errors,
  required,
  className,
  options,
  placeholder,
  ...props
}: BaseProps &
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "name"> & {
    options: readonly { value: string; label: string }[];
    placeholder?: string;
  }) {
  const ids = useIds(name);
  errors = useContextErrors(name, errors);
  return (
    <FieldShell label={label} hint={hint} errors={errors} required={required} className={className} ids={ids}>
      <Select
        id={ids.inputId}
        name={name}
        required={required}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy(ids, hint, errors)}
        {...props}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </FieldShell>
  );
}

export function CheckboxField({
  name,
  label,
  hint,
  errors,
  value = "on",
  defaultChecked,
  className,
}: Omit<BaseProps, "required"> & { value?: string; defaultChecked?: boolean }) {
  const ids = useIds(`${name}-${value}`);
  errors = useContextErrors(name, errors);
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        id={ids.inputId}
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-5 w-5 rounded border-border text-ocean-700"
        aria-describedby={describedBy(ids, hint, errors)}
      />
      <div>
        <label htmlFor={ids.inputId} className="text-sm font-medium text-ocean-900">
          {label}
        </label>
        {hint ? (
          <p id={ids.hintId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}
        {errors?.length ? (
          <p id={ids.errorId} className="text-xs font-medium text-red-700">
            {errors.join(" ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function CheckboxGroup({
  name,
  legend,
  options,
  defaultValues = [],
  errors,
  columns = 2,
}: {
  name: string;
  legend: string;
  options: readonly { value: string; label: string }[];
  defaultValues?: readonly string[];
  errors?: string[];
  columns?: 1 | 2 | 3;
}) {
  errors = useContextErrors(name, errors);
  return (
    <fieldset>
      <legend className="text-sm font-medium text-ocean-900">{legend}</legend>
      <div className={cn("mt-2 grid gap-2", columns === 1 ? "" : columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={name} value={o.value} defaultChecked={defaultValues.includes(o.value)} className="h-4 w-4" />
            {o.label}
          </label>
        ))}
      </div>
      {errors?.length ? <p className="mt-1 text-xs font-medium text-red-700">{errors.join(" ")}</p> : null}
    </fieldset>
  );
}

export function SubmitButton({ children, pendingText = "Saving…", ...props }: ButtonProps & { pendingText?: string }) {
  const status = useFormStatus();
  const ctx = React.useContext(ActionFormContext);
  const pending = status.pending || ctx.pending;
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}

export function FormMessage({ state }: { state: ActionResult<unknown> | null | undefined }) {
  if (!state) return null;
  if (!state.ok) return <Alert tone="danger">{state.error}</Alert>;
  if (state.message) return <Alert tone="success">{state.message}</Alert>;
  return null;
}

/** Field errors from an ActionResult. */
export function errs(state: ActionResult<unknown> | null | undefined, field: string): string[] | undefined {
  return state && !state.ok ? state.fieldErrors?.[field] : undefined;
}
