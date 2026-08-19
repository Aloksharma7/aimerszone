"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { browserRequest, createIdempotencyKey, type NormalizedApiError } from "@/lib/api/browser-client";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { isMockDataEnabled } from "@/lib/data/config";

export type TeacherResource = {
  id: string;
  title: string;
  moduleTitle: string | null;
  fileType: string | null;
  sizeBytes: number | null;
  released: boolean;
  releasedAt: string | null;
  downloadCount: number;
};

function humanSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Uploads notes and PDFs for a batch.
 *
 * Students could always download resources; nothing could create one, so the
 * "Notes" every course card advertises was empty by construction.
 *
 * Release is separate from upload on purpose: a teacher can stage a whole
 * module ahead of time and make it visible when the class reaches that point.
 */
export function ResourceManager({ batchId, resources }: { batchId: string; resources: TeacherResource[] }) {
  const router = useRouter();
  const mockMode = isMockDataEnabled();
  const fileInput = useRef<HTMLInputElement>(null);

  const [values, setValues] = useState({ title: "", moduleTitle: "", releaseNow: true });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function upload() {
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }

    if (values.title.trim().length < 2) {
      setError("Give the resource a title students will recognise.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (mockMode) {
        setNotice("Preview mode: nothing was uploaded.");
        return;
      }

      // multipart: the file goes as-is, and the browser sets the boundary.
      const form = new FormData();
      form.append("title", values.title.trim());
      if (values.moduleTitle.trim()) form.append("module_title", values.moduleTitle.trim());
      form.append("release_now", values.releaseNow ? "1" : "0");
      form.append("file", file);

      await browserRequest({
        url: `/api/v1/teacher/batches/${encodeURIComponent(batchId)}/resources`,
        method: "POST",
        data: form,
        headers: { "Idempotency-Key": createIdempotencyKey("resource-upload") },
      });

      setNotice(values.releaseNow ? "Uploaded and released to students." : "Uploaded. Release it when you are ready.");
      setValues({ title: "", moduleTitle: "", releaseNow: true });
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      router.refresh();
    } catch (caught) {
      const apiError = caught as Partial<NormalizedApiError>;
      setError(apiError.message || "The file could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleRelease(resource: TeacherResource) {
    setBusy(true);
    setError(null);

    try {
      if (mockMode) {
        setNotice("Preview mode: nothing changed.");
        return;
      }

      await browserRequest({
        url: `/api/v1/teacher/batches/${encodeURIComponent(batchId)}/resources/${encodeURIComponent(resource.id)}`,
        method: "PATCH",
        data: { release_at: resource.released ? null : new Date().toISOString() },
        headers: { "Idempotency-Key": createIdempotencyKey("resource-release") },
      });

      router.refresh();
    } catch (caught) {
      const apiError = caught as Partial<NormalizedApiError>;
      setError(apiError.message || "The resource could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(resource: TeacherResource) {
    if (mockMode) {
      setNotice("Preview mode: nothing was removed.");
      return;
    }

    try {
      await browserRequest({
        url: `/api/v1/teacher/batches/${encodeURIComponent(batchId)}/resources/${encodeURIComponent(resource.id)}`,
        method: "DELETE",
      });

      router.refresh();
    } catch (caught) {
      const apiError = caught as Partial<NormalizedApiError>;
      setError(apiError.message || "The resource could not be removed.");
      throw caught;
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Resource</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Downloads</th>
              <th className="px-4 py-3">Visible</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {resources.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  No notes uploaded yet. Students see an empty Notes tab until you add one.
                </td>
              </tr>
            ) : (
              resources.map((resource) => (
                <tr key={resource.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{resource.title}</p>
                        <p className="text-xs text-slate-500">
                          {resource.moduleTitle || "No module"} · {resource.fileType || "FILE"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{humanSize(resource.sizeBytes)}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <span className="inline-flex items-center gap-1">
                      <Download className="h-3.5 w-3.5 text-slate-400" />
                      {resource.downloadCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${resource.released ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {resource.released ? "Released" : "Staged"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => toggleRelease(resource)}
                        disabled={busy}
                        className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {resource.released ? "Withdraw" : "Release"}
                      </button>
                      <ConfirmAction
                        label=""
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        title={`Remove "${resource.title}"?`}
                        description="Students will lose access immediately."
                        confirmLabel="Remove resource"
                        disabled={busy}
                        ariaLabel={`Remove ${resource.title}`}
                        triggerClassName="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        onConfirm={() => remove(resource)}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <form
        className="h-fit rounded-2xl border border-slate-200 bg-white p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void upload();
        }}
      >
        <h2 className="text-base font-bold text-slate-950">Upload a note</h2>
        <p className="mt-1 text-sm text-slate-600">PDF, Word, PowerPoint, Excel, images or a zip.</p>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Title</span>
            <input
              value={values.title}
              onChange={(event) => setValues((c) => ({ ...c, title: event.target.value }))}
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
              placeholder="Chapter 3 — Elasticity notes"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Module <span className="font-normal text-slate-500">(optional)</span></span>
            <input
              value={values.moduleTitle}
              onChange={(event) => setValues((c) => ({ ...c, moduleTitle: event.target.value }))}
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
              placeholder="Elasticity"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">File</span>
            <input
              ref={fileInput}
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold"
            />
            {file ? <span className="text-xs text-slate-500">{file.name} · {humanSize(file.size)}</span> : null}
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={values.releaseNow}
              onChange={(event) => setValues((c) => ({ ...c, releaseNow: event.target.checked }))}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">Release to students now</span>
          </label>

          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          {notice ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p> : null}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload
          </button>
        </div>
      </form>
    </div>
  );
}
