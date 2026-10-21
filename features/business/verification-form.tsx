"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { VERIFICATION_DOCUMENT_TYPES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { submitVerificationAction } from "./actions";

const ACCEPT = ["application/pdf", "image/jpeg", "image/png"];
const EXT: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

/** Uploads the document privately, then files the verification request. */
export function VerificationForm({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("document");
    fd.delete("document");
    setPending(true);
    setMessage(null);
    try {
      if (file instanceof File && file.size > 0) {
        if (!ACCEPT.includes(file.type)) return setMessage({ ok: false, text: "Upload a PDF, JPG or PNG." });
        if (file.size > 10 * 1024 * 1024) return setMessage({ ok: false, text: "The file must be 10 MB or smaller." });
        const path = `${businessId}/${crypto.randomUUID()}.${EXT[file.type]}`;
        const { error } = await createClient().storage.from("verification-documents").upload(path, file, { contentType: file.type });
        if (error) return setMessage({ ok: false, text: "Upload was refused. Only owners and managers can submit documents." });
        fd.set("documentPath", path);
      }
      fd.set("businessId", businessId);
      const result = await submitVerificationAction({ ok: true }, fd);
      setMessage(result.ok ? { ok: true, text: result.message ?? "Submitted." } : { ok: false, text: result.error });
      if (result.ok) {
        form.reset();
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {message ? <Alert tone={message.ok ? "success" : "danger"}>{message.text}</Alert> : null}
      <div>
        <Label htmlFor="v-type">Document type</Label>
        <Select id="v-type" name="documentType" required defaultValue="cac_certificate">
          {VERIFICATION_DOCUMENT_TYPES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="v-file">Document (PDF, JPG or PNG, max 10 MB)</Label>
        <Input id="v-file" type="file" name="document" accept={ACCEPT.join(",")} className="h-auto py-2" />
        <p className="mt-1 text-xs text-muted-foreground">Stored privately. Only your business and authorised reviewers can open it.</p>
      </div>
      <div>
        <Label htmlFor="v-exp">Expiry date (if any)</Label>
        <Input id="v-exp" type="date" name="documentExpiry" />
      </div>
      <div>
        <Label htmlFor="v-note">Note for the reviewer</Label>
        <Textarea id="v-note" name="applicantNote" rows={2} maxLength={2000} />
      </div>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Submitting…" : "Submit for verification"}
      </Button>
    </form>
  );
}
