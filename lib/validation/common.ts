import { z } from "zod";
import { parseMajorToMinor } from "@/lib/money";
import { STATE_CODES } from "@/lib/constants";

/** Turn FormData into a plain object; repeated keys become arrays. */
export function formDataToObject(formData: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    const existing = out[key];
    if (existing === undefined) out[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else out[key] = [existing, value];
  }
  return out;
}

export const trimmed = (min: number, max: number, label: string) =>
  z
    .string({ message: `${label} is required` })
    .trim()
    .min(min, min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

export const optionalTrimmed = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .optional()
    .transform((v) => (v ? v : undefined));

export const uuid = z.uuid({ message: "Invalid reference" });

export const stateCode = z.enum(STATE_CODES, { message: "Choose a state" });

export const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => v === "" || /^\+?[0-9]{7,15}$/.test(v), "Enter a valid phone number, e.g. +2348012345678")
  .transform((v) => (v === "" ? undefined : v));

/** Naira amount typed by a person → kobo integer. */
export const nairaAmount = (label: string, { allowZero = false } = {}) =>
  z
    .string({ message: `${label} is required` })
    .trim()
    .transform((v, ctx) => {
      const minor = parseMajorToMinor(v);
      if (minor === null) {
        ctx.addIssue({ code: "custom", message: `${label} must be an amount like 2800 or 2,800.50` });
        return z.NEVER;
      }
      if (!allowZero && minor <= 0) {
        ctx.addIssue({ code: "custom", message: `${label} must be greater than zero` });
        return z.NEVER;
      }
      return minor;
    });

export const optionalNairaAmount = (label: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      const minor = parseMajorToMinor(v);
      if (minor === null || minor <= 0) {
        ctx.addIssue({ code: "custom", message: `${label} must be an amount greater than zero` });
        return z.NEVER;
      }
      return minor;
    });

/** Decimal quantity with up to 3 decimals, kept as a string for exact SQL numeric. */
export const quantity = (label: string) =>
  z
    .string({ message: `${label} is required` })
    .trim()
    .regex(/^\d{1,10}(\.\d{1,3})?$/, `${label} must be a number with at most 3 decimals`)
    .refine((v) => Number(v) > 0, `${label} must be greater than zero`);

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");
export const optionalIsoDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date");

export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal(""), z.undefined()])
  .transform((v) => v === "on" || v === "true");

export function toArray(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
