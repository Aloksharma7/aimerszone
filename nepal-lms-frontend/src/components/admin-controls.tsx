"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  CloudCog,
  ImageUp,
  LoaderCircle,
  Megaphone,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Unplug,
} from "lucide-react";
import { AlertBox, Badge, Button, Panel, StatusBadge, fieldClass } from "@/components/ui";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { browserRequest, createIdempotencyKey, type NormalizedApiError } from "@/lib/api/browser-client";
import { refreshPublicCatalogue } from "@/lib/catalogue-cache";
import { useToast } from "@/providers/toast-provider";
import type { ApiResponse } from "@/lib/api/contracts";
import { cn } from "@/lib/utils";
import type { AdminBatch, Course, RoleDefinition, Teacher } from "@/types/lms";
import type { AdminSettingsData } from "@/lib/data/admin";

// Shared token; see fieldClass in components/ui.
const inputClass = fieldClass;
const textareaClass = "min-h-28 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm leading-6 text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100 disabled:bg-slate-100";
const mockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

function Field({ label, required, hint, error, children }: { label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-1 text-sm font-semibold text-slate-800">{label}{required ? <span className="text-red-600">*</span> : null}</span>
      {children}
      {hint ? <span className="mt-2 block text-xs leading-5 text-slate-500">{hint}</span> : null}
      {error ? <span className="mt-2 block text-xs font-semibold text-red-700">{error}</span> : null}
    </label>
  );
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (value: boolean) => void; label: string; description?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-start justify-between gap-5 rounded-xl border border-slate-200 p-4 text-left transition hover:bg-slate-50" aria-pressed={checked}>
      <span><span className="block text-sm font-semibold text-slate-900">{label}</span>{description ? <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span> : null}</span>
      <span className={cn("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-brand-700" : "bg-slate-300")}><span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition", checked ? "left-[22px]" : "left-0.5")} /></span>
    </button>
  );
}

function RequestNotice({ notice }: { notice: { tone: "success" | "danger"; title: string; message: string } | null }) {
  if (!notice) return null;
  return <AlertBox title={notice.title} tone={notice.tone}>{notice.message}</AlertBox>;
}

export function BatchEditor({ mode = "new", courses, teachers, batch }: { mode?: "new" | "edit"; courses: Course[]; teachers: Teacher[]; batch?: AdminBatch | null }) {
  const router = useRouter();
  const { toast } = useToast();
  /*
   * Identifiers come from the API, not from matching display names back
   * against the option lists — a renamed course or two teachers with the same
   * name silently produced an empty selector. The date fields take the raw
   * YYYY-MM-DD values; the formatted "17 Aug 2026" strings that used to be fed
   * here are not a value <input type="date"> accepts, so the pickers always
   * rendered blank and the dates could never round-trip.
   */
  const [values, setValues] = useState({
    title: batch?.name || "",
    courseId: batch?.courseId || "",
    teacherIds: batch?.teacherIds ?? [],
    schedule: batch?.schedule && !batch.schedule.includes("required") ? batch.schedule : "",
    startDate: batch?.startAt || (mode === "new" ? new Date().toISOString().slice(0, 10) : ""),
    endDate: batch?.endAt || "",
    accessUntil: batch?.accessUntil || "",
    priceNpr: batch?.priceNpr ?? 0,
    capacity: batch?.capacity || 60,
    // New batches default to Open rather than Draft: a Draft batch silently
    // refuses every enrollment attempt ("batch_closed"), which is exactly
    // the error a staff member hit trying to enrol a student into a batch
    // they had just created. Draft stays available in the dropdown below
    // for batches genuinely still being set up.
    status: batch?.status?.toLowerCase() || "open",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; title: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const editing = mode === "edit" && Boolean(batch?.id);

  function update<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => { const next = { ...current }; delete next[key]; return next; });
  }

  async function save() {
    const nextErrors: Record<string, string> = {};
    if (values.title.trim().length < 4) nextErrors.title = "Enter a clear batch title.";
    if (!values.courseId) nextErrors.courseId = "Choose a course.";
    if (values.teacherIds.length === 0) nextErrors.teacherIds = "Choose at least one teacher.";
    if (!values.schedule.trim()) nextErrors.schedule = "Enter the class schedule.";
    if (values.capacity < 1 || values.capacity > 2000) nextErrors.capacity = "Capacity must be between 1 and 2,000.";
    if (values.startDate && values.endDate && values.endDate < values.startDate) nextErrors.endDate = "End date must be after the start date.";
    if (values.accessUntil && values.endDate && values.accessUntil < values.endDate) nextErrors.accessUntil = "Access must run to at least the end date.";
    if (values.priceNpr < 0 || values.priceNpr > 10000000) nextErrors.priceNpr = "Enter a price between 0 and 10,000,000.";
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); setNotice({ tone: "danger", title: "Batch not saved", message: "Please correct the highlighted fields." }); return; }
    setBusy(true); setNotice(null);
    try {
      if (!mockMode) {
        await browserRequest<ApiResponse<{ id: string }>>({
          url: editing ? `/api/v1/admin/batches/${encodeURIComponent(batch!.id)}` : "/api/v1/admin/batches",
          method: editing ? "PATCH" : "POST",
          /*
           * Field names are the API's.
           *
           * This previously sent start_date/end_date (expected: start_at/end_at)
           * and teacher_id (expected: teacher_ids, an array). All three are
           * "sometimes" rules, so they were accepted and dropped without an
           * error: dates never saved, and no batch ever got a teacher — which
           * in turn left every teacher with an empty portal, because their
           * screens scope on the batches they are assigned to.
           *
           * enrollment_open and live_enabled had no rule and no column at all,
           * so those two toggles are gone rather than pretending to persist.
           */
          data: {
            title: values.title.trim(),
            course_id: values.courseId,
            teacher_ids: values.teacherIds,
            schedule_summary: values.schedule.trim(),
            start_at: values.startDate || null,
            end_at: values.endDate || null,
            access_until: values.accessUntil || null,
            price_npr: values.priceNpr,
            capacity: values.capacity,
            status: values.status,
          },
          headers: { "Idempotency-Key": createIdempotencyKey(editing ? "admin-update-batch" : "admin-create-batch") },
        });
      } else await new Promise((resolve) => window.setTimeout(resolve, 350));
      setNotice({ tone: "success", title: mockMode ? "Preview validated" : "Batch saved", message: mockMode ? "The batch payload passed client validation. Preview mode does not persist records." : "The batch and its operational settings were saved." });
      toast({ tone: "success", title: editing ? "Batch updated" : "Batch created", message: values.title });
      if (!editing) router.replace("/admin/batches");
      const courseSlug = courses.find((course) => (course.id || course.slug) === values.courseId)?.slug;
      await refreshPublicCatalogue({ slug: courseSlug });
      router.refresh();
    } catch (caught) {
      const error = caught as Partial<NormalizedApiError>;
      setNotice({ tone: "danger", title: "Batch not saved", message: error.message || "The request could not be completed." });
      toast({ tone: "danger", title: "Batch not saved", message: error.message || "The request could not be completed." });
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <RequestNotice notice={notice} />
      <Panel>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Batch title" required error={errors.title}><input className={inputClass} value={values.title} onChange={(event) => update("title", event.target.value)} placeholder="Physics · Evening Batch 2083" /></Field>
          <Field label="Course" required error={errors.courseId}><select className={inputClass} value={values.courseId} onChange={(event) => update("courseId", event.target.value)}><option value="">Select course</option>{courses.map((course) => <option key={course.id || course.slug} value={course.id || course.slug}>{course.title}</option>)}</select></Field>
          {/*
            * More than one teacher per batch.
            *
            * The API has always taken a list and the pivot has always held
            * many, but the form sent a single id — so a batch shared between a
            * theory and a practical teacher could not be described, and there
            * was no way to see who was already assigned, or to change them
            * without guessing.
            */}
          <Field label="Teachers" required error={errors.teacherIds} hint="Tick everyone who teaches this batch. They each see it in their own portal.">
            <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-300 p-2">
              {teachers.length ? teachers.map((teacher) => {
                const id = teacher.userId || "";
                const checked = values.teacherIds.includes(id);
                return (
                  <label key={id || teacher.slug} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-700"
                      checked={checked}
                      disabled={!id}
                      onChange={() => update("teacherIds", checked ? values.teacherIds.filter((item) => item !== id) : [...values.teacherIds, id])}
                    />
                    <span className="text-sm text-slate-800">{teacher.name}</span>
                    {checked ? <span className="ml-auto text-xs font-semibold text-green-700">Assigned</span> : null}
                  </label>
                );
              }) : <p className="px-2 py-3 text-sm text-slate-500">No teacher accounts yet. Create one under Users first.</p>}
            </div>
          </Field>
          <Field label="Capacity" required error={errors.capacity}><input className={inputClass} type="number" min="1" max="2000" value={values.capacity} onChange={(event) => update("capacity", Number(event.target.value) || 0)} /></Field>
          <Field label="Start date"><input className={inputClass} type="date" value={values.startDate} onChange={(event) => update("startDate", event.target.value)} /></Field>
          <Field label="End date" error={errors.endDate}><input className={inputClass} type="date" value={values.endDate} onChange={(event) => update("endDate", event.target.value)} /></Field>
          <Field label="Access until" error={errors.accessUntil} hint="Content stays available to enrolled students until this date. Leave blank to use the institution default."><input className={inputClass} type="date" value={values.accessUntil} onChange={(event) => update("accessUntil", event.target.value)} /></Field>
          <Field label="Price (NPR)" error={errors.priceNpr} hint="The fee students are asked for. 0 makes the batch free."><input className={inputClass} type="number" min="0" max="10000000" value={values.priceNpr} onChange={(event) => update("priceNpr", Number(event.target.value) || 0)} /></Field>
          <div className="sm:col-span-2"><Field label="Schedule summary" required error={errors.schedule} hint="Use Nepal time and keep the public schedule concise."><input className={inputClass} value={values.schedule} onChange={(event) => update("schedule", event.target.value)} placeholder="Sun–Fri · 7:00–8:00 PM NPT" /></Field></div>
          <Field label="Operational status"><select className={inputClass} value={values.status} onChange={(event) => update("status", event.target.value)}><option value="draft">Draft</option><option value="open">Open</option><option value="ongoing">Ongoing</option><option value="closed">Closed</option><option value="cancelled">Cancelled</option></select></Field>
        </div>
        {/*
          * "Enrollment open" and "Live classes enabled" used to sit here as
          * toggles. Neither had a column or a validation rule behind it, so
          * both were discarded on every save while appearing to work.
          * Enrollment is governed by the operational status above.
          */}
        <p className="mt-6 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
          Enrollment follows the operational status: a batch accepts new students while it is <strong>Open</strong>. Capacity, dates, payment and eligibility are all re-checked by the API on every enrolment.
        </p>
        <div className="mt-6 flex justify-end"><Button onClick={save} disabled={busy}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? "Saving…" : editing ? "Save batch" : "Create batch"}</Button></div>
      </Panel>
    </div>
  );
}

export function RoleMatrix({ roles }: { roles: RoleDefinition[] }) {
  const permissions = useMemo(() => [...new Set(roles.flatMap((role) => role.permissions))].sort(), [roles]);
  return (
    <Panel>
      <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-950">Protected role matrix</h2><p className="mt-1 text-sm leading-6 text-slate-500">This page is an operational view — the underlying permission rules remain the actual source of truth.</p></div><ShieldCheck className="h-6 w-6 text-brand-700" /></div>
      <div className="mt-6 overflow-x-auto"><table className="min-w-full border-separate border-spacing-0 text-sm"><thead><tr><th className="sticky left-0 z-10 border-b border-slate-200 bg-white px-4 py-3 text-left font-bold text-slate-700">Permission</th>{roles.map((role) => <th key={role.id} className="border-b border-slate-200 px-4 py-3 text-center font-bold text-slate-700"><span className="block whitespace-nowrap">{role.name}</span><span className="mt-1 block text-xs font-normal text-slate-400">{role.users} users</span></th>)}</tr></thead><tbody>{permissions.map((permission) => <tr key={permission}><td className="sticky left-0 border-b border-slate-100 bg-white px-4 py-3 font-medium text-slate-700">{permission}</td>{roles.map((role) => <td key={`${role.id}-${permission}`} className="border-b border-slate-100 px-4 py-3 text-center">{role.permissions.includes(permission) ? <CheckCircle2 className="mx-auto h-5 w-5 text-green-600" /> : <span className="text-slate-300">—</span>}</td>)}</tr>)}</tbody></table></div>
      <div className="mt-5 flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><p>Permission changes should be reviewed, migrated, tested and audited on the backend—not toggled casually in a browser table.</p></div>
    </Panel>
  );
}

export function AnnouncementComposer({ batches, roles }: { batches: AdminBatch[]; roles: RoleDefinition[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState({ title: "", body: "", audience: "all", targetId: "", schedule: "" });
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; title: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(status: "draft" | "published") {
    if (values.title.trim().length < 4 || values.body.trim().length < 10) { setNotice({ tone: "danger", title: "Announcement not saved", message: "Add a clear title and message." }); return; }
    if (values.audience !== "all" && !values.targetId) { setNotice({ tone: "danger", title: "Announcement not saved", message: "Choose which batch or role this is for." }); return; }
    setBusy(true); setNotice(null);
    try {
      if (!mockMode) {
        // Field names here must match what AnnouncementController::store()
        // actually validates (audience, course_id/batch_id/role_key,
        // channel as a real portal/email/sms/whatsapp value, publish_at) —
        // this previously sent audience_type/audience_id/scheduled_at and a
        // channel value the backend didn't recognize, so every submission
        // 422'd and no admin announcement had ever actually been created.
        await browserRequest<ApiResponse<{ id: string }>>({
          url: "/api/v1/admin/announcements",
          method: "POST",
          data: {
            title: values.title.trim(),
            body: values.body.trim(),
            audience: values.audience,
            batch_id: values.audience === "batch" ? values.targetId : null,
            role_key: values.audience === "role" ? values.targetId : null,
            channel: "portal",
            publish_at: values.schedule || null,
            status,
          },
          headers: { "Idempotency-Key": createIdempotencyKey(`admin-announcement-${status}`) },
        });
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 300));
      }
      toast({ tone: "success", title: mockMode ? "Preview validated" : status === "published" ? "Announcement published" : "Draft saved" });
      setNotice({ tone: "success", title: mockMode ? "Preview validated" : status === "published" ? "Announcement published" : "Draft saved", message: mockMode ? "The form passed validation. Preview mode does not publish anything." : "The audience and delivery request were recorded." });
      if (status === "published") setValues({ title: "", body: "", audience: "all", targetId: "", schedule: "" });
      if (!mockMode) router.refresh();
    } catch (caught) { const error = caught as Partial<NormalizedApiError>; setNotice({ tone: "danger", title: "Announcement not saved", message: error.message || "The request could not be completed." }); }
    finally { setBusy(false); }
  }
  const targets = values.audience === "batch" ? batches.map((batch) => ({ id: batch.id, label: batch.name })) : values.audience === "role" ? roles.map((role) => ({ id: role.key, label: role.name })) : [];
  return (
    <div className="space-y-4"><RequestNotice notice={notice} /><Panel><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-950">Create announcement</h2><p className="mt-1 text-sm leading-6 text-slate-500">Target a role or batch. Private meeting and file links must never be pasted into the message.</p></div><Megaphone className="h-6 w-6 text-brand-700" /></div><div className="mt-6 grid gap-5 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="Title" required><input className={inputClass} value={values.title} maxLength={120} onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))} /></Field></div><Field label="Audience"><select className={inputClass} value={values.audience} onChange={(event) => setValues((current) => ({ ...current, audience: event.target.value, targetId: "" }))}><option value="all">All active users</option><option value="role">One role</option><option value="batch">One batch</option></select></Field><Field label="Audience target"><select className={inputClass} value={values.targetId} onChange={(event) => setValues((current) => ({ ...current, targetId: event.target.value }))} disabled={!targets.length}><option value="">{targets.length ? "Select target" : "Not required"}</option>{targets.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field><Field label="Schedule (optional)"><input className={inputClass} type="datetime-local" value={values.schedule} onChange={(event) => setValues((current) => ({ ...current, schedule: event.target.value }))} /></Field><div className="sm:col-span-2"><Field label="Message" required><textarea className={textareaClass} value={values.body} maxLength={5000} onChange={(event) => setValues((current) => ({ ...current, body: event.target.value }))} /></Field></div></div><div className="mt-6 flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => submit("draft")} disabled={busy}><Save className="h-4 w-4" />Save draft</Button><Button onClick={() => submit("published")} disabled={busy}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Publish / schedule</Button></div></Panel></div>
  );
}

export function SettingsManager({ initialData }: { initialData: AdminSettingsData }) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState(initialData);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; title: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [qrBusyId, setQrBusyId] = useState<string | null>(null);
  const [brandAssetBusy, setBrandAssetBusy] = useState<"logo" | "favicon" | null>(null);

  async function uploadBrandAsset(asset: "logo" | "favicon", file: File) {
    setBrandAssetBusy(asset);
    try {
      if (mockMode) {
        await new Promise((resolve) => window.setTimeout(resolve, 300));
        const previewUrl = URL.createObjectURL(file);
        setValues((current) => ({ ...current, institution: { ...current.institution, [asset === "logo" ? "logoUrl" : "faviconUrl"]: previewUrl } }));
        toast({ tone: "success", title: "Preview validated", message: "Preview mode does not persist the upload." });
        return;
      }
      const data = new FormData();
      data.append(asset, file);
      const response = await browserRequest<ApiResponse<{ logo_url?: string; favicon_url?: string }>>({
        url: `/api/v1/admin/settings/institution/${asset}`,
        method: "POST",
        data,
        headers: { "Idempotency-Key": createIdempotencyKey(`institution-${asset}-upload`) },
      });
      const url = asset === "logo" ? response.data.logo_url : response.data.favicon_url;
      setValues((current) => ({ ...current, institution: { ...current.institution, [asset === "logo" ? "logoUrl" : "faviconUrl"]: url ?? null } }));
      toast({ tone: "success", title: asset === "logo" ? "Logo updated" : "Favicon updated" });
      if (asset === "logo") router.refresh();
    } catch (caught) {
      const error = caught as Partial<NormalizedApiError>;
      toast({ tone: "danger", title: asset === "logo" ? "Logo not uploaded" : "Favicon not uploaded", message: error.message || "The request could not be completed." });
    } finally {
      setBrandAssetBusy(null);
    }
  }

  async function removeBrandAsset(asset: "logo" | "favicon") {
    setBrandAssetBusy(asset);
    try {
      if (!mockMode) await browserRequest({ url: `/api/v1/admin/settings/institution/${asset}`, method: "DELETE" });
      else await new Promise((resolve) => window.setTimeout(resolve, 250));
      setValues((current) => ({ ...current, institution: { ...current.institution, [asset === "logo" ? "logoUrl" : "faviconUrl"]: null } }));
      toast({ tone: "success", title: asset === "logo" ? "Logo removed" : "Favicon removed" });
      if (asset === "logo") router.refresh();
    } catch (caught) {
      const error = caught as Partial<NormalizedApiError>;
      toast({ tone: "danger", title: asset === "logo" ? "Logo not removed" : "Favicon not removed", message: error.message || "The request could not be completed." });
    } finally {
      setBrandAssetBusy(null);
    }
  }

  // Secrets are write-only: the API never returns the stored value, only
  // whether one is configured. A blank field on save means "leave it alone".
  const [smsToken, setSmsToken] = useState("");
  const [esewaSecretKey, setEsewaSecretKey] = useState("");

  function updateMethod<K extends keyof AdminSettingsData["paymentMethods"][number]>(id: string, key: K, value: AdminSettingsData["paymentMethods"][number][K]) {
    setValues((current) => ({ ...current, paymentMethods: current.paymentMethods.map((method) => (method.id === id ? { ...method, [key]: value } : method)) }));
  }

  async function uploadQr(id: string, file: File) {
    setQrBusyId(id); setNotice(null);
    try {
      if (mockMode) {
        await new Promise((resolve) => window.setTimeout(resolve, 300));
        updateMethod(id, "qrImageUrl", URL.createObjectURL(file));
      } else {
        const data = new FormData();
        data.append("qr_image", file);
        const response = await browserRequest<ApiResponse<{ qr_image_url: string }>>({ url: `/api/v1/admin/payment-methods/${encodeURIComponent(id)}/qr`, method: "POST", data });
        updateMethod(id, "qrImageUrl", response.data.qr_image_url);
      }
      setNotice({ tone: "success", title: "QR image updated", message: "Students see this the next time they open the payment wizard." });
    } catch (caught) { const error = caught as Partial<NormalizedApiError>; setNotice({ tone: "danger", title: "QR image not saved", message: error.message || "The request could not be completed." }); }
    finally { setQrBusyId(null); }
  }

  async function removeQr(id: string) {
    setQrBusyId(id); setNotice(null);
    try {
      if (!mockMode) await browserRequest<ApiResponse<null>>({ url: `/api/v1/admin/payment-methods/${encodeURIComponent(id)}/qr`, method: "DELETE" });
      else await new Promise((resolve) => window.setTimeout(resolve, 250));
      updateMethod(id, "qrImageUrl", null);
      setNotice({ tone: "success", title: "QR image removed", message: "The payment wizard now shows account details only." });
    } catch (caught) { const error = caught as Partial<NormalizedApiError>; setNotice({ tone: "danger", title: "QR image not removed", message: error.message || "The request could not be completed." }); }
    finally { setQrBusyId(null); }
  }

  async function save() {
    setBusy(true); setNotice(null);
    try {
      if (!mockMode) await browserRequest<ApiResponse<AdminSettingsData>>({ url: "/api/v1/admin/settings", method: "PATCH", data: { institution: { name: values.institution.name, short_name: values.institution.shortName, tagline: values.institution.tagline, primary_phone: values.institution.primaryPhone, support_email: values.institution.supportEmail, whatsapp: values.institution.whatsapp, website: values.institution.website, address: values.institution.address, facebook_url: values.institution.facebookUrl || undefined, instagram_url: values.institution.instagramUrl || undefined, youtube_url: values.institution.youtubeUrl || undefined }, payment_methods: values.paymentMethods.map((item) => ({ id: item.id, name: item.name, account_name: item.accountName, account_reference: item.accountReference, bank_name: item.bankName, branch: item.branch, status: item.status.toLowerCase(), sort_order: item.sort })), security: { public_registration: values.security.publicRegistration, email_verification: values.security.emailVerification, privileged_mfa: values.security.privilegedMfa, force_password_change: values.security.forcePasswordChange, session_timeout_hours: values.security.sessionTimeoutHours, failed_login_attempts: values.security.failedLoginAttempts, lockout_minutes: values.security.lockoutMinutes }, operations: { maintenance_notice: values.operations.maintenanceNotice, automatic_receipts: values.operations.automaticReceipts, daily_integration_health_check: values.operations.dailyIntegrationHealthCheck }, sms: { provider: values.sms.provider, endpoint: values.sms.endpoint, sender_id: values.sms.senderId, token: smsToken || undefined, notify_class_starting: values.sms.notifyClassStarting, notify_payment_decision: values.sms.notifyPaymentDecision, notify_enrollment_activated: values.sms.notifyEnrollmentActivated }, esewa: { environment: values.esewa.environment, merchant_code: values.esewa.merchantCode, secret_key: esewaSecretKey || undefined } }, headers: { "Idempotency-Key": createIdempotencyKey("admin-settings") } });
      else await new Promise((resolve) => window.setTimeout(resolve, 350));
      if (smsToken) setValues((current) => ({ ...current, sms: { ...current.sms, tokenConfigured: true } }));
      if (esewaSecretKey) setValues((current) => ({ ...current, esewa: { ...current.esewa, secretKeyConfigured: true } }));
      setSmsToken(""); setEsewaSecretKey("");
      setNotice({ tone: "success", title: mockMode ? "Preview validated" : "Settings saved", message: mockMode ? "The form passed validation. Preview mode does not save changes." : "Configuration was saved and the change should appear in the audit log." });
      if (!mockMode) router.refresh();
    } catch (caught) { const error = caught as Partial<NormalizedApiError>; setNotice({ tone: "danger", title: "Settings not saved", message: error.message || "The request could not be completed." }); }
    finally { setBusy(false); }
  }
  return (
    <div className="space-y-6"><RequestNotice notice={notice} /><Panel><h2 className="text-xl font-bold text-slate-950">Institution identity</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><Field label="Institution name"><input className={inputClass} value={values.institution.name} onChange={(event) => setValues((current) => ({ ...current, institution: { ...current.institution, name: event.target.value } }))} /></Field><Field label="Short name"><input className={inputClass} value={values.institution.shortName} onChange={(event) => setValues((current) => ({ ...current, institution: { ...current.institution, shortName: event.target.value } }))} /></Field><div className="sm:col-span-2"><Field label="Tagline" hint="Shown under the logo on the login screen and used as the site description."><input className={inputClass} maxLength={160} value={values.institution.tagline} onChange={(event) => setValues((current) => ({ ...current, institution: { ...current.institution, tagline: event.target.value } }))} /></Field></div><Field label="Support email"><input className={inputClass} type="email" value={values.institution.supportEmail} onChange={(event) => setValues((current) => ({ ...current, institution: { ...current.institution, supportEmail: event.target.value } }))} /></Field><Field label="Primary phone"><input className={inputClass} value={values.institution.primaryPhone} onChange={(event) => setValues((current) => ({ ...current, institution: { ...current.institution, primaryPhone: event.target.value } }))} /></Field><Field label="WhatsApp"><input className={inputClass} value={values.institution.whatsapp} onChange={(event) => setValues((current) => ({ ...current, institution: { ...current.institution, whatsapp: event.target.value } }))} /></Field><Field label="Public website"><input className={inputClass} type="url" value={values.institution.website} onChange={(event) => setValues((current) => ({ ...current, institution: { ...current.institution, website: event.target.value } }))} /></Field><div className="sm:col-span-2"><Field label="Address"><textarea className={textareaClass} value={values.institution.address} onChange={(event) => setValues((current) => ({ ...current, institution: { ...current.institution, address: event.target.value } }))} /></Field></div><Field label="Facebook page"><input className={inputClass} type="url" placeholder="https://www.facebook.com/..." value={values.institution.facebookUrl} onChange={(event) => setValues((current) => ({ ...current, institution: { ...current.institution, facebookUrl: event.target.value } }))} /></Field><Field label="Instagram profile"><input className={inputClass} type="url" placeholder="https://www.instagram.com/..." value={values.institution.instagramUrl} onChange={(event) => setValues((current) => ({ ...current, institution: { ...current.institution, instagramUrl: event.target.value } }))} /></Field><Field label="YouTube channel"><input className={inputClass} type="url" placeholder="https://www.youtube.com/@..." value={values.institution.youtubeUrl} onChange={(event) => setValues((current) => ({ ...current, institution: { ...current.institution, youtubeUrl: event.target.value } }))} /></Field></div>
      <div className="mt-6 grid gap-6 border-t border-slate-100 pt-6 sm:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">Logo</p>
          <p className="mt-1 text-xs text-slate-500">Shown in the header, footer and portal sidebar in place of the default mark.</p>
          <div className="mt-3 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              {values.institution.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded asset, not a Next-optimized asset
                <img src={values.institution.logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="px-2 text-center text-[10px] text-slate-400">No logo</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className={cn("inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50", brandAssetBusy === "logo" && "pointer-events-none opacity-50")}>
                {brandAssetBusy === "logo" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ImageUp className="h-3.5 w-3.5" />}
                {values.institution.logoUrl ? "Replace" : "Upload"}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="sr-only" disabled={brandAssetBusy === "logo"} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadBrandAsset("logo", file); event.target.value = ""; }} />
              </label>
              {values.institution.logoUrl ? (
                <button type="button" onClick={() => void removeBrandAsset("logo")} disabled={brandAssetBusy === "logo"} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                  <Trash2 className="h-3.5 w-3.5" />Remove
                </button>
              ) : null}
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">JPG, PNG, WebP or SVG · maximum 2 MB</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Favicon</p>
          <p className="mt-1 text-xs text-slate-500">The browser tab icon. Falls back to the default mark until one is set.</p>
          <div className="mt-3 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              {values.institution.faviconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded asset, not a Next-optimized asset
                <img src={values.institution.faviconUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="px-2 text-center text-[10px] text-slate-400">Default</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className={cn("inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50", brandAssetBusy === "favicon" && "pointer-events-none opacity-50")}>
                {brandAssetBusy === "favicon" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ImageUp className="h-3.5 w-3.5" />}
                {values.institution.faviconUrl ? "Replace" : "Upload"}
                <input type="file" accept="image/png,image/svg+xml,image/webp,image/x-icon,.ico" className="sr-only" disabled={brandAssetBusy === "favicon"} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadBrandAsset("favicon", file); event.target.value = ""; }} />
              </label>
              {values.institution.faviconUrl ? (
                <button type="button" onClick={() => void removeBrandAsset("favicon")} disabled={brandAssetBusy === "favicon"} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                  <Trash2 className="h-3.5 w-3.5" />Remove
                </button>
              ) : null}
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">PNG, SVG, WebP or ICO · maximum 512 KB</p>
        </div>
      </div>
    </Panel>

    <Panel>
      <h2 className="text-xl font-bold text-slate-950">Payment methods</h2>
      <p className="mt-1 text-sm leading-6 text-slate-500">Account details and QR images shown to students on the payment page and in the payment wizard. QR changes save immediately; the rest saves with the button below.</p>
      <div className="mt-5 space-y-5">
        {values.paymentMethods.map((method) => (
          <div key={method.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold text-slate-950">{method.name}</h3>
              <Toggle checked={method.status.toLowerCase() === "active"} onChange={(value) => updateMethod(method.id, "status", value ? "Active" : "Disabled")} label={method.status.toLowerCase() === "active" ? "Active" : "Disabled"} />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              <Field label="Account name"><input className={inputClass} value={method.accountName} onChange={(event) => updateMethod(method.id, "accountName", event.target.value)} /></Field>
              <Field label="Account / wallet number"><input className={inputClass} value={method.accountReference} onChange={(event) => updateMethod(method.id, "accountReference", event.target.value)} /></Field>
              <Field label="Bank name"><input className={inputClass} value={method.bankName} onChange={(event) => updateMethod(method.id, "bankName", event.target.value)} placeholder="Not applicable for wallets" /></Field>
              <Field label="Branch"><input className={inputClass} value={method.branch} onChange={(event) => updateMethod(method.id, "branch", event.target.value)} placeholder="Not applicable for wallets" /></Field>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-800">Scan-to-pay QR</span>
                <div className="flex items-center gap-3">
                  {method.qrImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded image from Laravel storage, not a Next-optimized asset
                    <img src={method.qrImageUrl} alt={`${method.name} QR code`} className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-slate-300 text-[10px] text-slate-400">No QR</div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <label className="cursor-pointer text-xs font-bold text-brand-700 hover:text-brand-900">
                      {qrBusyId === method.id ? "Uploading…" : method.qrImageUrl ? "Replace" : "Upload"}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={qrBusyId === method.id} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadQr(method.id, file); event.target.value = ""; }} />
                    </label>
                    {method.qrImageUrl ? <button type="button" className="text-xs font-semibold text-red-700 hover:text-red-900 disabled:opacity-50" disabled={qrBusyId === method.id} onClick={() => void removeQr(method.id)}>Remove</button> : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>

    <Panel><h2 className="text-xl font-bold text-slate-950">Security defaults</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Toggle checked={values.security.publicRegistration} onChange={(value) => setValues((current) => ({ ...current, security: { ...current.security, publicRegistration: value } }))} label="Public registration" /><Toggle checked={values.security.emailVerification} onChange={(value) => setValues((current) => ({ ...current, security: { ...current.security, emailVerification: value } }))} label="Require email verification" /><Toggle checked={values.security.privilegedMfa} onChange={(value) => setValues((current) => ({ ...current, security: { ...current.security, privilegedMfa: value } }))} label="Require MFA for privileged roles" /><Toggle checked={values.security.forcePasswordChange} onChange={(value) => setValues((current) => ({ ...current, security: { ...current.security, forcePasswordChange: value } }))} label="Force temporary-password change" /></div><div className="mt-5 grid gap-5 sm:grid-cols-3"><Field label="Session timeout (hours)"><input className={inputClass} type="number" min="1" max="24" value={values.security.sessionTimeoutHours} onChange={(event) => setValues((current) => ({ ...current, security: { ...current.security, sessionTimeoutHours: Number(event.target.value) || 1 } }))} /></Field><Field label="Failed attempts"><input className={inputClass} type="number" min="3" max="20" value={values.security.failedLoginAttempts} onChange={(event) => setValues((current) => ({ ...current, security: { ...current.security, failedLoginAttempts: Number(event.target.value) || 3 } }))} /></Field><Field label="Lockout minutes"><input className={inputClass} type="number" min="5" max="1440" value={values.security.lockoutMinutes} onChange={(event) => setValues((current) => ({ ...current, security: { ...current.security, lockoutMinutes: Number(event.target.value) || 5 } }))} /></Field></div></Panel><Panel><h2 className="text-xl font-bold text-slate-950">Operational controls</h2><div className="mt-5 grid gap-4 sm:grid-cols-3"><Toggle checked={values.operations.maintenanceNotice} onChange={(value) => setValues((current) => ({ ...current, operations: { ...current.operations, maintenanceNotice: value } }))} label="Maintenance notice" /><Toggle checked={values.operations.automaticReceipts} onChange={(value) => setValues((current) => ({ ...current, operations: { ...current.operations, automaticReceipts: value } }))} label="Automatic receipts" /><Toggle checked={values.operations.dailyIntegrationHealthCheck} onChange={(value) => setValues((current) => ({ ...current, operations: { ...current.operations, dailyIntegrationHealthCheck: value } }))} label="Daily integration check" /></div></Panel>

    <Panel>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-950">SMS notifications</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">Used for class reminders, payment decisions and enrollment activation. The API token is write-only — it is never sent back to the browser once saved.</p>
        </div>
        <Badge tone={values.sms.tokenConfigured ? "green" : "amber"}>{values.sms.tokenConfigured ? "Token configured" : "Token not set"}</Badge>
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field label="Provider">
          <select className={inputClass} value={values.sms.provider} onChange={(event) => setValues((current) => ({ ...current, sms: { ...current.sms, provider: event.target.value } }))}>
            <option value="sparrow">Sparrow SMS</option>
            <option value="generic">Generic HTTP</option>
          </select>
        </Field>
        <Field label="Sender ID"><input className={inputClass} value={values.sms.senderId} onChange={(event) => setValues((current) => ({ ...current, sms: { ...current.sms, senderId: event.target.value } }))} /></Field>
        <div className="sm:col-span-2"><Field label="API endpoint"><input className={inputClass} type="url" value={values.sms.endpoint} onChange={(event) => setValues((current) => ({ ...current, sms: { ...current.sms, endpoint: event.target.value } }))} /></Field></div>
        <div className="sm:col-span-2"><Field label="API token" hint="Leave blank to keep the currently stored token."><input className={inputClass} type="password" autoComplete="off" placeholder={values.sms.tokenConfigured ? "••••••••••••" : "Not set"} value={smsToken} onChange={(event) => setSmsToken(event.target.value)} /></Field></div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Toggle checked={values.sms.notifyClassStarting} onChange={(value) => setValues((current) => ({ ...current, sms: { ...current.sms, notifyClassStarting: value } }))} label="Class starting" />
        <Toggle checked={values.sms.notifyPaymentDecision} onChange={(value) => setValues((current) => ({ ...current, sms: { ...current.sms, notifyPaymentDecision: value } }))} label="Payment decision" />
        <Toggle checked={values.sms.notifyEnrollmentActivated} onChange={(value) => setValues((current) => ({ ...current, sms: { ...current.sms, notifyEnrollmentActivated: value } }))} label="Enrollment activated" />
      </div>
    </Panel>

    <Panel>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-950">eSewa checkout</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">Merchant credentials for the eSewa online checkout flow. The secret key is write-only.</p>
        </div>
        <Badge tone={values.esewa.secretKeyConfigured ? "green" : "amber"}>{values.esewa.secretKeyConfigured ? "Secret configured" : "Secret not set"}</Badge>
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field label="Environment">
          <select className={inputClass} value={values.esewa.environment} onChange={(event) => setValues((current) => ({ ...current, esewa: { ...current.esewa, environment: event.target.value as "sandbox" | "live" } }))}>
            <option value="sandbox">Sandbox</option>
            <option value="live">Live</option>
          </select>
        </Field>
        <Field label="Merchant code"><input className={inputClass} value={values.esewa.merchantCode} onChange={(event) => setValues((current) => ({ ...current, esewa: { ...current.esewa, merchantCode: event.target.value } }))} /></Field>
        <div className="sm:col-span-2"><Field label="Secret key" hint="Leave blank to keep the currently stored secret."><input className={inputClass} type="password" autoComplete="off" placeholder={values.esewa.secretKeyConfigured ? "••••••••••••" : "Not set"} value={esewaSecretKey} onChange={(event) => setEsewaSecretKey(event.target.value)} /></Field></div>
      </div>
    </Panel>

    <div className="flex justify-end"><Button onClick={save} disabled={busy}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? "Saving…" : "Save settings"}</Button></div>
    </div>
  );
}

export function IntegrationConnection({ provider, initialConnected }: { provider: "zoom" | "youtube"; initialConnected: boolean }) {
  const label = provider === "zoom" ? "Zoom" : "YouTube";
  const [connected, setConnected] = useState(initialConnected);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; title: string; message: string } | null>(null);
  async function action(name: "connect" | "disconnect" | "health-check") {
    setBusy(true); setNotice(null);
    try {
      if (!mockMode) await browserRequest<ApiResponse<{ connected: boolean; status: string }>>({ url: `/api/v1/admin/integrations/${provider}/${name}`, method: "POST", headers: { "Idempotency-Key": createIdempotencyKey(`admin-${provider}-${name}`) } });
      else await new Promise((resolve) => window.setTimeout(resolve, 300));
      if (name === "connect") setConnected(true); if (name === "disconnect") setConnected(false);
      setNotice({ tone: "success", title: `${label} request completed`, message: mockMode ? "Preview mode validated the provider action." : name === "health-check" ? "The health check result was recorded." : `${label} connection state was updated.` });
    } catch (caught) { const error = caught as Partial<NormalizedApiError>; setNotice({ tone: "danger", title: `${label} request failed`, message: error.message || "The request could not be completed." }); }
    finally { setBusy(false); }
  }
  return (
    <div className="space-y-4"><RequestNotice notice={notice} /><Panel><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-4"><div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", connected ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500")}><CloudCog className="h-6 w-6" /></div><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold text-slate-950">{label} connection</h2><StatusBadge status={connected ? "Active" : "Disconnected"} /></div><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">OAuth credentials and provider secrets stay on the server. The browser only ever requests a connect or health-check action.</p></div></div><div className="flex flex-wrap items-start gap-2"><Button variant="outline" onClick={() => action("health-check")} disabled={busy}><ShieldCheck className="h-4 w-4" />Health check</Button>{connected ? <ConfirmAction label="Disconnect" icon={<Unplug className="h-4 w-4" />} title={`Disconnect ${label}?`} description="Existing local records will remain but provider actions may stop." confirmLabel="Disconnect" disabled={busy} onConfirm={() => action("disconnect")} /> : <Button onClick={() => action("connect")} disabled={busy}><CloudCog className="h-4 w-4" />Connect</Button>}</div></div><div className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><p>Provider links, access tokens and webhook secrets must never be returned in page data or embedded in the frontend bundle.</p></div></Panel></div>
  );
}
