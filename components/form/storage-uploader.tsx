"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert, Label } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";
import type { ActionResult } from "@/lib/errors";

type Bucket = "product-images" | "verification-documents" | "dispute-evidence";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Downscale photos to ≤1600px JPEG so uploads stay small on mobile data. */
async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/**
 * Uploads a file straight to Supabase Storage under `<folderId>/<random uuid>.<ext>`
 * (Storage RLS checks the folder), then records it via a Server Action.
 */
export function StorageUploader({
  bucket,
  folderId,
  accept,
  maxBytes,
  label,
  hint,
  onUploaded,
  fields = {},
  compress = false,
  multiple = false,
}: {
  bucket: Bucket;
  folderId: string;
  accept: string[];
  maxBytes: number;
  label: string;
  hint?: string;
  onUploaded: (prev: ActionResult<unknown>, formData: FormData) => Promise<ActionResult<unknown>>;
  fields?: Record<string, string>;
  compress?: boolean;
  multiple?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState<{ tone: "danger" | "success" | "info"; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const inputId = React.useId();

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setStatus({ tone: "info", text: "Uploading…" });
    const supabase = createClient();
    try {
      for (const original of Array.from(files)) {
        if (!accept.includes(original.type)) {
          setStatus({ tone: "danger", text: `${original.name}: file type not allowed.` });
          continue;
        }
        const blob = compress ? await compressImage(original) : original;
        const type = blob.type || original.type;
        if (blob.size > maxBytes) {
          setStatus({ tone: "danger", text: `${original.name} is larger than ${Math.round(maxBytes / 1048576)} MB.` });
          continue;
        }
        const path = `${folderId}/${crypto.randomUUID()}.${EXT[type] ?? "bin"}`;
        const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: type, upsert: false });
        if (error) {
          setStatus({ tone: "danger", text: "Upload was refused. Check you have permission and try again." });
          continue;
        }
        const fd = new FormData();
        for (const [k, v] of Object.entries(fields)) fd.set(k, v);
        fd.set("storagePath", path);
        fd.set("fileName", original.name.slice(0, 200));
        fd.set("mimeType", type);
        fd.set("sizeBytes", String(blob.size));
        const result = await onUploaded({ ok: true }, fd);
        setStatus(result.ok ? { tone: "success", text: result.message ?? "Uploaded." } : { tone: "danger", text: result.error });
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <input
        id={inputId}
        type="file"
        accept={accept.join(",")}
        multiple={multiple}
        disabled={busy}
        onChange={(e) => {
          void handle(e.target.files);
          e.target.value = "";
        }}
        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-ocean-700 file:px-3 file:py-2 file:font-semibold file:text-white"
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {status ? <Alert tone={status.tone === "danger" ? "danger" : status.tone === "success" ? "success" : "info"}>{status.text}</Alert> : null}
    </div>
  );
}
