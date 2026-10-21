"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Alert, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { DELIVERY_OPTIONS, NIGERIAN_STATES, PRODUCT_STATES, UNITS } from "@/lib/constants";
import type { ActionResult } from "@/lib/errors";
import { parseMajorToMinor } from "@/lib/money";
import { humanize } from "@/lib/utils";
import { saveListingAction } from "./actions";

/** Client-side mirror of the server schema, for instant feedback. The server re-validates. */
const clientSchema = z
  .object({
    businessId: z.string().min(1, "Choose a business"),
    categoryId: z.string().min(1, "Choose a category"),
    name: z.string().trim().min(3, "At least 3 characters").max(120),
    description: z.string().trim().min(10, "Describe the product in at least 10 characters").max(4000),
    productState: z.enum(PRODUCT_STATES),
    pricingType: z.enum(["fixed", "quote_required"]),
    price: z.string().optional(),
    unit: z.enum(UNITS),
    availableQuantity: z.string().regex(/^\d{1,10}(\.\d{1,3})?$/, "Number, up to 3 decimals"),
    minOrderQuantity: z
      .string()
      .regex(/^\d{1,10}(\.\d{1,3})?$/, "Number, up to 3 decimals")
      .refine((v) => Number(v) > 0, "Must be greater than zero"),
    sizeGrade: z.string().max(80).optional(),
    packaging: z.string().max(120).optional(),
    locationState: z.string().min(2, "Choose a state"),
    locationCity: z.string().max(80).optional(),
    availableFrom: z.string().min(10, "Choose a date"),
    harvestDate: z.string().optional(),
    handlingInfo: z.string().max(1000).optional(),
    deliveryOptions: z.array(z.string()).min(1, "Choose at least one"),
    certificationInfo: z.string().max(1000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.pricingType === "fixed") {
      const minor = parseMajorToMinor(v.price ?? "");
      if (minor === null || minor <= 0) ctx.addIssue({ code: "custom", path: ["price"], message: "Enter a price like 2800 or 2,800.50" });
    }
    if (Number(v.minOrderQuantity) > Number(v.availableQuantity) && Number(v.availableQuantity) > 0) {
      ctx.addIssue({ code: "custom", path: ["minOrderQuantity"], message: "Minimum order is more than the available quantity" });
    }
  });

type FormValues = z.infer<typeof clientSchema>;

export function ListingForm({
  productId,
  businesses,
  categories,
  defaults,
}: {
  productId?: string;
  businesses: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  defaults?: Partial<FormValues>;
}) {
  const [result, setResult] = React.useState<ActionResult<unknown> | null>(null);
  const [pending, startTransition] = React.useTransition();
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      businessId: businesses[0]?.id ?? "",
      categoryId: "",
      productState: "fresh",
      pricingType: "fixed",
      unit: "kg",
      availableQuantity: "",
      minOrderQuantity: "1",
      locationState: "",
      availableFrom: new Date().toISOString().slice(0, 10),
      deliveryOptions: ["pickup"],
      ...defaults,
    },
  });
  const pricingType = useWatch({ control, name: "pricingType" });

  const submit = (intent: "draft" | "publish") =>
    handleSubmit((values) => {
      const fd = new FormData();
      if (productId) fd.set("productId", productId);
      for (const [k, v] of Object.entries(values)) {
        if (Array.isArray(v)) v.forEach((x) => fd.append(k, x));
        else if (v !== undefined && v !== null) fd.set(k, String(v));
      }
      fd.set("intent", intent);
      startTransition(async () => {
        const res = await saveListingAction({ ok: true }, fd);
        setResult(res);
        if (!res.ok && res.fieldErrors) {
          for (const [field, messages] of Object.entries(res.fieldErrors)) {
            if (messages?.length) setError(field as keyof FormValues, { message: messages.join(" ") });
          }
        }
      });
    });

  const err = (k: keyof FormValues) =>
    errors[k]?.message ? (
      <p className="mt-1 text-xs font-medium text-red-700" role="alert">
        {String(errors[k]?.message)}
      </p>
    ) : null;

  return (
    <form className="space-y-5" onSubmit={(e) => e.preventDefault()} noValidate>
      {result && !result.ok ? <Alert tone="danger">{result.error}</Alert> : null}
      {result && result.ok && result.message ? <Alert tone="success">{result.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="businessId">Business</Label>
          <Select id="businessId" {...register("businessId")}>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          {err("businessId")}
        </div>
        <div>
          <Label htmlFor="categoryId">Category</Label>
          <Select id="categoryId" {...register("categoryId")} aria-invalid={!!errors.categoryId}>
            <option value="">Choose…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          {err("categoryId")}
        </div>
      </div>

      <div>
        <Label htmlFor="name">Product name</Label>
        <Input id="name" {...register("name")} placeholder="e.g. Fresh croaker, medium" aria-invalid={!!errors.name} />
        {err("name")}
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={4} {...register("description")} aria-invalid={!!errors.description} />
        {err("description")}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="productState">Product state</Label>
          <Select id="productState" {...register("productState")}>
            {PRODUCT_STATES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="pricingType">Pricing</Label>
          <Select id="pricingType" {...register("pricingType")}>
            <option value="fixed">Fixed price</option>
            <option value="quote_required">Price on request (quotation)</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="unit">Unit</Label>
          <Select id="unit" {...register("unit")}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {pricingType === "fixed" ? (
          <div>
            <Label htmlFor="price">Price per unit (₦)</Label>
            <Input id="price" inputMode="decimal" {...register("price")} aria-invalid={!!errors.price} />
            {err("price")}
          </div>
        ) : null}
        <div>
          <Label htmlFor="availableQuantity">Available quantity</Label>
          <Input id="availableQuantity" inputMode="decimal" {...register("availableQuantity")} aria-invalid={!!errors.availableQuantity} />
          {err("availableQuantity")}
        </div>
        <div>
          <Label htmlFor="minOrderQuantity">Minimum order</Label>
          <Input id="minOrderQuantity" inputMode="decimal" {...register("minOrderQuantity")} aria-invalid={!!errors.minOrderQuantity} />
          {err("minOrderQuantity")}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="locationState">State</Label>
          <Select id="locationState" {...register("locationState")} aria-invalid={!!errors.locationState}>
            <option value="">Choose…</option>
            {NIGERIAN_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </Select>
          {err("locationState")}
        </div>
        <div>
          <Label htmlFor="locationCity">Town / landing site</Label>
          <Input id="locationCity" {...register("locationCity")} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="availableFrom">Available from</Label>
          <Input id="availableFrom" type="date" {...register("availableFrom")} />
          {err("availableFrom")}
        </div>
        <div>
          <Label htmlFor="harvestDate">Harvest / landing date (optional)</Label>
          <Input id="harvestDate" type="date" {...register("harvestDate")} />
          {err("harvestDate")}
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-ocean-900">Delivery options</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {DELIVERY_OPTIONS.map((d) => (
            <label key={d.value} className="flex items-center gap-2 text-sm">
              <input type="checkbox" value={d.value} {...register("deliveryOptions")} className="h-4 w-4" />
              {d.label}
            </label>
          ))}
        </div>
        {err("deliveryOptions")}
      </fieldset>

      <details className="rounded-md border border-border p-3" open={!!(defaults?.sizeGrade || defaults?.handlingInfo || defaults?.certificationInfo)}>
        <summary className="cursor-pointer text-sm font-medium">More details (optional)</summary>
        <div className="mt-3 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="sizeGrade">Size / grade</Label>
              <Input id="sizeGrade" {...register("sizeGrade")} />
            </div>
            <div>
              <Label htmlFor="packaging">Packaging</Label>
              <Input id="packaging" {...register("packaging")} />
            </div>
          </div>
          <div>
            <Label htmlFor="handlingInfo">Origin & handling</Label>
            <Textarea id="handlingInfo" rows={2} {...register("handlingInfo")} placeholder="Where it was caught or farmed, how it has been kept…" />
          </div>
          <div>
            <Label htmlFor="certificationInfo">Certificates (optional)</Label>
            <Textarea id="certificationInfo" rows={2} {...register("certificationInfo")} />
            <p className="mt-1 text-xs text-muted-foreground">Shown to buyers as self-declared. Do not claim certifications you cannot show.</p>
          </div>
        </div>
      </details>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={pending} onClick={submit("draft")}>
          {pending ? "Saving…" : "Save draft"}
        </Button>
        <Button type="button" variant="teal" disabled={pending} onClick={submit("publish")}>
          {pending ? "Saving…" : "Save and publish"}
        </Button>
      </div>
    </form>
  );
}
