"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, LoaderCircle, Save, Trash2 } from "lucide-react";
import { AlertBox, Button, Panel, fieldClass } from "@/components/ui";
import { browserRequest, createIdempotencyKey, type NormalizedApiError } from "@/lib/api/browser-client";
import { refreshPublicCatalogue } from "@/lib/catalogue-cache";
import { isMockDataEnabled } from "@/lib/data/config";
import { useToast } from "@/providers/toast-provider";
import { cn } from "@/lib/utils";
import type { Teacher } from "@/types/lms";

const inputClass = fieldClass;
const textareaClass = "min-h-32 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm leading-6 text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

/**
 * What the public /teachers page shows for one teacher — separate from the
 * account's own profile (Account\ProfileController), so an administrator can
 * curate the public bio and photo independently of whatever a teacher
 * personally sets for themselves.
 */
export function TeacherProfileForm({ teacher }: { teacher: Teacher }) {
  const router = useRouter();
  const { toast } = useToast();
  const mockMode = isMockDataEnabled();
  const userId = teacher.userId as string;

  const [values, setValues] = useState({
    headline: teacher.role === "Faculty" ? "" : teacher.role,
    subjects: teacher.subjects.join(", "),
    experienceSummary: teacher.experience === "Experienced faculty member" ? "" : teacher.experience,
    bio: teacher.bio === "Faculty profile details will be available soon." ? "" : teacher.bio,
    isPublic: teacher.isPublic,
  });
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(teacher.avatarUrl);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; title: string; message: string } | null>(null);

  function update<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setNotice(null);
    try {
      if (!mockMode) {
        await browserRequest({
          url: `/api/v1/admin/teachers/${encodeURIComponent(userId)}/profile`,
          method: "PUT",
          data: {
            headline: values.headline.trim() || null,
            subjects: values.subjects.split(",").map((item) => item.trim()).filter(Boolean),
            experience_summary: values.experienceSummary.trim() || null,
            bio: values.bio.trim() || null,
            is_public: values.isPublic,
          },
          headers: { "Idempotency-Key": createIdempotencyKey("teacher-profile-save") },
        });
        await refreshPublicCatalogue({ tags: ["public-teachers"] });
      }
      toast({ tone: "success", title: mockMode ? "Preview validated" : "Public profile saved" });
      setNotice({ tone: "success", title: mockMode ? "Preview validated" : "Public profile saved", message: mockMode ? "Preview mode does not persist changes." : "The public /teachers page reflects this immediately." });
      router.refresh();
    } catch (caught) {
      const error = caught as Partial<NormalizedApiError>;
      const message = error.message || "The profile could not be saved.";
      setNotice({ tone: "danger", title: "Not saved", message });
      toast({ tone: "danger", title: "Not saved", message });
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhoto(file: File) {
    setPhotoBusy(true);
    setNotice(null);
    try {
      if (mockMode) {
        setPreviewUrl(URL.createObjectURL(file));
        toast({ tone: "success", title: "Preview validated", message: "Preview mode does not persist the upload." });
        return;
      }
      const data = new FormData();
      data.append("photo", file);
      const response = await browserRequest<{ data: { avatar_url: string } }>({
        url: `/api/v1/admin/teachers/${encodeURIComponent(userId)}/photo`,
        method: "POST",
        data,
        headers: { "Idempotency-Key": createIdempotencyKey("teacher-photo") },
      });
      setPreviewUrl(response.data.avatar_url);
      await refreshPublicCatalogue({ tags: ["public-teachers"] });
      toast({ tone: "success", title: "Photo updated" });
      router.refresh();
    } catch (caught) {
      const error = caught as Partial<NormalizedApiError>;
      toast({ tone: "danger", title: "Photo not uploaded", message: error.message || "The request could not be completed." });
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    setNotice(null);
    try {
      if (!mockMode) {
        await browserRequest({ url: `/api/v1/admin/teachers/${encodeURIComponent(userId)}/photo`, method: "DELETE" });
        await refreshPublicCatalogue({ tags: ["public-teachers"] });
      }
      setPreviewUrl(null);
      toast({ tone: "success", title: mockMode ? "Preview validated" : "Photo removed" });
      router.refresh();
    } catch (caught) {
      const error = caught as Partial<NormalizedApiError>;
      toast({ tone: "danger", title: "Photo not removed", message: error.message || "The request could not be completed." });
    } finally {
      setPhotoBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {notice ? <AlertBox title={notice.title} tone={notice.tone}>{notice.message}</AlertBox> : null}
      <Panel>
        <h2 className="text-xl font-bold text-slate-950">Public photo</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">Shown on the /teachers page and this teacher&apos;s own profile there. Falls back to their account photo until one is set here.</p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded asset, not a Next-optimized asset
              <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="px-2 text-center text-[10px] text-slate-400">No photo</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <label className={cn("inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50", photoBusy && "pointer-events-none opacity-50")}>
              {photoBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
              {previewUrl ? "Replace photo" : "Upload photo"}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={photoBusy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadPhoto(file); event.target.value = ""; }} />
            </label>
            {previewUrl ? (
              <button type="button" onClick={() => void removePhoto()} disabled={photoBusy} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                <Trash2 className="h-4 w-4" />Remove
              </button>
            ) : null}
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-400">JPG, PNG or WebP · maximum 2 MB</p>
      </Panel>

      <Panel>
        <h2 className="text-xl font-bold text-slate-950">Public bio</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Headline<input className={inputClass} value={values.headline} onChange={(event) => update("headline", event.target.value)} placeholder="Physics Faculty" maxLength={120} /></label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Subjects <span className="font-normal text-slate-400">(comma separated)</span><input className={inputClass} value={values.subjects} onChange={(event) => update("subjects", event.target.value)} placeholder="Physics, Mechanics" /></label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Experience summary<input className={inputClass} value={values.experienceSummary} onChange={(event) => update("experienceSummary", event.target.value)} placeholder="8 years teaching experience" maxLength={255} /></label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Bio<textarea className={textareaClass} value={values.bio} onChange={(event) => update("bio", event.target.value)} maxLength={5000} /></label>
        </div>
        <button type="button" onClick={() => update("isPublic", !values.isPublic)} className="mt-5 flex w-full items-start justify-between gap-5 rounded-xl border border-slate-200 p-4 text-left transition hover:bg-slate-50" aria-pressed={values.isPublic}>
          <span><span className="block text-sm font-semibold text-slate-900">Show on the public /teachers page</span><span className="mt-1 block text-xs leading-5 text-slate-500">Turned off, this teacher stays hidden from the public site while everything here is kept.</span></span>
          <span className={cn("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition", values.isPublic ? "bg-brand-700" : "bg-slate-300")}><span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition", values.isPublic ? "left-[22px]" : "left-0.5")} /></span>
        </button>
        <div className="mt-6 flex justify-end"><Button onClick={save} disabled={busy}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? "Saving…" : "Save public profile"}</Button></div>
      </Panel>
    </div>
  );
}
