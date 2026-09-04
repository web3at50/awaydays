"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  deletePlanDocument,
  finalizePlanDocumentUpload,
  registerPlanDocumentUpload,
} from "@/lib/plan-actions";
import { documentSizeLabel } from "@/lib/plan";
import type { ItineraryDocument } from "@/lib/types";

// PDFs attached to one booking — the confirmation email, tickets. Uploads
// go straight from the browser to storage (register → upload → finalize),
// so a big scan never has to squeeze through a server action.
export function PlanDocuments({
  itemId,
  adventureSlug,
  documents,
}: {
  itemId: string;
  adventureSlug: string;
  documents: ItineraryDocument[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const registered = await registerPlanDocumentUpload({
        itineraryItemId: itemId,
        filename: file.name,
        mimeType: file.type,
        byteSize: file.size,
      });
      if (!registered.ok) {
        setError(registered.error);
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(registered.bucketName)
        .upload(registered.objectName, file, { contentType: "application/pdf" });
      if (uploadError) {
        setError("The upload didn't finish — please check your signal and try again");
        return;
      }

      const finalized = await finalizePlanDocumentUpload({
        itineraryItemId: itemId,
        documentId: registered.documentId,
        adventureSlug,
        filename: file.name,
        byteSize: file.size,
      });
      if (!finalized.ok) {
        setError(finalized.error ?? "Something went wrong — please try again");
        return;
      }

      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove(doc: ItineraryDocument) {
    if (!window.confirm(`Remove "${doc.original_filename}" from this booking?`)) {
      return;
    }
    await deletePlanDocument(doc.id, itemId, adventureSlug);
    startTransition(() => router.refresh());
  }

  return (
    <section className="mt-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold">Documents</h2>
      <p className="mt-1 text-sm text-stone-500">
        Keep the confirmation email or tickets with this booking — PDFs up to
        20 MB.
      </p>

      {documents.length > 0 && (
        <ul className="mt-3 space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2.5"
            >
              <a
                href={`/api/plan-doc/${doc.id}`}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 break-words text-sm font-medium text-amber-800 hover:underline"
              >
                📄 {doc.original_filename}
                <span className="ml-1.5 font-normal text-stone-400">
                  {documentSizeLabel(doc.byte_size)}
                </span>
              </a>
              <button
                type="button"
                onClick={() => handleRemove(doc)}
                aria-label={`Remove ${doc.original_filename}`}
                className="shrink-0 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-400 hover:border-red-300 hover:text-red-600"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="mt-3 w-full rounded-lg border border-amber-600 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
      >
        {busy ? "Uploading…" : "＋ Add a PDF"}
      </button>
    </section>
  );
}
