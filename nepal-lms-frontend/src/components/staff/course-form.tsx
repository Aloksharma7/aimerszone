"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ImageUp, LoaderCircle, Save, Send, Trash2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { AlertBox, Button, ButtonLink, Panel } from "@/components/ui";
import { browserRequest, createIdempotencyKey, type NormalizedApiError } from "@/lib/api/browser-client";
import { refreshPublicCatalogue } from "@/lib/catalogue-cache";
import { useToast } from "@/providers/toast-provider";
import type { ApiResponse } from "@/lib/api/contracts";
import { cn } from "@/lib/utils";
import type { CourseCategory, CourseFeature, CourseInput, StaffCourse } from "@/types/lms";

const features: CourseFeature[] = ["Live", "Recordings", "Tests", "Notes"];
const fieldClass = "mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100";
const textareaClass = "mt-2 min-h-32 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100";

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 100);
}

function initialValues(course?: StaffCourse | null): CourseInput {
  return {
    title: course?.title || "",
    slug: course?.slug || "",
    code: course?.code || "",
    categoryId: course?.categoryId || null,
    shortDescription: course?.shortDescription || "",
    description: course?.description || "",
    accessType: course?.isFree ? "free" : "paid",
    priceNpr: course?.price || 0,
    originalPriceNpr: course?.originalPrice ?? null,
    thumbnailUrl: course?.image?.startsWith("http") ? course.image : null,
    features: course?.features || ["Live", "Recordings", "Tests", "Notes"],
    published: Boolean(course?.published),
  };
}

function validate(values: CourseInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (values.title.trim().length < 4) errors.title = "Enter a clear course title.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug)) errors.slug = "Use lowercase letters, numbers and hyphens only.";
  if (!/^[A-Za-z0-9_-]{3,30}$/.test(values.code)) errors.code = "Use 3–30 letters, numbers, hyphens or underscores.";
  if (!values.categoryId) errors.categoryId = "Choose a category.";
  if (values.shortDescription.trim().length < 20) errors.shortDescription = "Add a short description of at least 20 characters.";
  if (values.description.trim().length < 50) errors.description = "Add a full description of at least 50 characters.";
  if (values.accessType === "paid" && values.priceNpr < 1) errors.priceNpr = "Paid courses require a positive price.";
  if (values.originalPriceNpr != null && values.originalPriceNpr < values.priceNpr) errors.originalPriceNpr = "Original price cannot be below the current price.";
  if (values.thumbnailUrl) { try { const url = new URL(values.thumbnailUrl); if (url.protocol !== "https:") errors.thumbnailUrl = "Use an HTTPS image URL."; } catch { errors.thumbnailUrl = "Enter a valid image URL."; } }
  if (!values.features.length) errors.features = "Select at least one learning feature.";
  return errors;
}

export function CourseForm({
  course,
  categories,
  canPublish,
  readOnly = false,
  endpointBase = "/api/v1/staff/courses",
  returnBase = "/staff/courses",
}: {
  course?: StaffCourse | null;
  categories: CourseCategory[];
  canPublish: boolean;
  readOnly?: boolean;
  endpointBase?: string;
  returnBase?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const original = useMemo(() => initialValues(course), [course]);
  const [values, setValues] = useState<CourseInput>(original);
  const [slugTouched, setSlugTouched] = useState(Boolean(course));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [thumbnailBusy, setThumbnailBusy] = useState(false);
  const mockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
  const dirty = JSON.stringify(values) !== JSON.stringify(original);
  const editing = Boolean(course?.id);

  async function uploadThumbnail(file: File) {
    if (!course?.id || readOnly) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setServerError("Use a JPG, PNG or WebP image under 2 MB.");
      return;
    }
    setThumbnailBusy(true);
    setServerError(null);
    try {
      if (mockMode) {
        update("thumbnailUrl", URL.createObjectURL(file));
        toast({ tone: "success", title: "Preview validated", message: "Preview mode does not persist the upload." });
        return;
      }
      const data = new FormData();
      data.append("thumbnail", file);
      const response = await browserRequest<ApiResponse<{ thumbnail_url: string }>>({
        url: `${endpointBase}/${encodeURIComponent(course.id)}/thumbnail`,
        method: "POST",
        data,
        headers: { "Idempotency-Key": createIdempotencyKey("course-thumbnail-upload") },
      });
      update("thumbnailUrl", response.data.thumbnail_url);
      await refreshPublicCatalogue({ slug: values.slug });
      toast({ tone: "success", title: "Thumbnail updated" });
    } catch (caught) {
      const error = caught as Partial<NormalizedApiError>;
      setServerError(error.message || "The thumbnail could not be uploaded.");
      toast({ tone: "danger", title: "Thumbnail not uploaded", message: error.message || "The thumbnail could not be uploaded." });
    } finally {
      setThumbnailBusy(false);
    }
  }

  async function removeThumbnail() {
    if (!course?.id || readOnly) return;
    setThumbnailBusy(true);
    setServerError(null);
    try {
      if (!mockMode) {
        await browserRequest({ url: `${endpointBase}/${encodeURIComponent(course.id)}/thumbnail`, method: "DELETE" });
        await refreshPublicCatalogue({ slug: values.slug });
      }
      update("thumbnailUrl", null);
      toast({ tone: "success", title: "Thumbnail removed" });
    } catch (caught) {
      const error = caught as Partial<NormalizedApiError>;
      setServerError(error.message || "The thumbnail could not be removed.");
      toast({ tone: "danger", title: "Thumbnail not removed", message: error.message || "The thumbnail could not be removed." });
    } finally {
      setThumbnailBusy(false);
    }
  }

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (dirty && !saved) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty, saved]);

  function update<K extends keyof CourseInput>(key: K, value: CourseInput[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => { const next = { ...current }; delete next[key]; return next; });
  }

  function updateTitle(title: string) {
    setValues((current) => ({ ...current, title, slug: slugTouched ? current.slug : slugify(title) }));
    setErrors((current) => { const next = { ...current }; delete next.title; if (!slugTouched) delete next.slug; return next; });
  }

  async function submit(publish: boolean) {
    if (readOnly || busy) return;
    const payload = { ...values, published: publish && canPublish ? true : values.published && canPublish };
    const validation = validate(payload);
    if (Object.keys(validation).length) { setErrors(validation); setServerError("Please correct the highlighted fields."); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setBusy(true); setSaved(false); setServerError(null);
    try {
      if (mockMode) {
        await new Promise((resolve) => window.setTimeout(resolve, 450));
        setValues(payload); setSaved(true);
        return;
      }
      const body = {
        title: payload.title.trim(),
        slug: payload.slug,
        code: payload.code.trim().toUpperCase(),
        category_id: payload.categoryId,
        short_description: payload.shortDescription.trim(),
        description: payload.description.trim(),
        access_type: payload.accessType,
        price_npr: payload.accessType === "free" ? 0 : payload.priceNpr,
        original_price_npr: payload.accessType === "free" ? null : payload.originalPriceNpr,
        thumbnail_url: payload.thumbnailUrl || null,
        features: payload.features,
        published: payload.published,
      };
      const response = await browserRequest<ApiResponse<{ id: string; slug: string }>>({
        url: editing ? `${endpointBase}/${encodeURIComponent(course!.id!)}` : endpointBase,
        method: editing ? "PATCH" : "POST",
        data: body,
        headers: { "Idempotency-Key": createIdempotencyKey(editing ? "update-course" : "create-course") },
      });
      setValues(payload); setSaved(true);
      toast({ tone: "success", title: editing ? "Course updated" : "Course created", message: payload.title });
      router.replace(editing ? `${returnBase}/${encodeURIComponent(response.data.id)}` : returnBase);
      await refreshPublicCatalogue({ slug: response.data.slug });
      router.refresh();
    } catch (caught) {
      const error = caught as Partial<NormalizedApiError>;
      setServerError(error.message || "The course could not be saved.");
      toast({ tone: "danger", title: "Course not saved", message: error.message || "The course could not be saved." });
      if (error.validation) {
        const mapped: Record<string, string> = {};
        Object.entries(error.validation).forEach(([key, messages]) => { mapped[key.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase())] = messages[0] || "Invalid value"; });
        setErrors(mapped);
      }
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      {serverError ? <AlertBox title="Course not saved" tone="danger">{serverError}</AlertBox> : null}
      {saved ? <AlertBox title={mockMode ? "Preview validated" : "Course saved"} tone="success">{mockMode ? "The form and API payload passed validation. Preview mode does not persist records." : "The latest course data has been saved."}</AlertBox> : null}
      <Panel>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Course title" error={errors.title} required><input value={values.title} onChange={(event) => updateTitle(event.target.value)} className={fieldClass} disabled={readOnly} autoComplete="off" /></Field>
          <Field label="Course code" error={errors.code} required><input value={values.code} onChange={(event) => update("code", event.target.value)} className={fieldClass} disabled={readOnly} placeholder="BBS-MICRO-01" autoCapitalize="characters" /></Field>
          <Field label="URL slug" error={errors.slug} required><input value={values.slug} onChange={(event) => { setSlugTouched(true); update("slug", slugify(event.target.value)); }} className={fieldClass} disabled={readOnly || editing} /><p className="mt-1 text-xs text-slate-500">The slug is locked after creation to avoid broken links.</p></Field>
          <Field label="Category" error={errors.categoryId} required><select value={values.categoryId || ""} onChange={(event) => update("categoryId", event.target.value || null)} className={fieldClass} disabled={readOnly}><option value="">Select a category</option>{categories.map((category) => <option key={category.id || category.name} value={category.id || category.slug || category.name}>{category.name}</option>)}</select></Field>
          <div className="sm:col-span-2"><Field label="Short description" error={errors.shortDescription} required><textarea value={values.shortDescription} onChange={(event) => update("shortDescription", event.target.value)} className={cn(textareaClass, "min-h-24")} disabled={readOnly} maxLength={240} /><p className="mt-1 text-right text-xs text-slate-400">{values.shortDescription.length}/240</p></Field></div>
          <div className="sm:col-span-2"><Field label="Full description" error={errors.description} required><textarea value={values.description} onChange={(event) => update("description", event.target.value)} className={textareaClass} disabled={readOnly} maxLength={5000} /></Field></div>
        </div>
      </Panel>

      <Panel>
        <h2 className="text-xl font-bold text-slate-950">Access and pricing</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Access type" required><select value={values.accessType} onChange={(event) => update("accessType", event.target.value as CourseInput["accessType"])} className={fieldClass} disabled={readOnly}><option value="paid">Paid course</option><option value="free">Free course</option></select></Field>
          <Field label="Current price (NPR)" error={errors.priceNpr} required={values.accessType === "paid"}><input value={values.accessType === "free" ? 0 : values.priceNpr} onChange={(event) => update("priceNpr", Number(event.target.value) || 0)} type="number" min="0" step="1" className={fieldClass} disabled={readOnly || values.accessType === "free"} /></Field>
          <Field label="Original price (NPR)" error={errors.originalPriceNpr}><input value={values.originalPriceNpr ?? ""} onChange={(event) => update("originalPriceNpr", event.target.value ? Number(event.target.value) : null)} type="number" min="0" step="1" className={fieldClass} disabled={readOnly || values.accessType === "free"} /></Field>
          <div className="sm:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Course thumbnail</span>
            <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex h-28 w-44 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                {values.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded or externally-hosted image, not a Next-optimized asset
                  <img src={values.thumbnailUrl} alt="Course thumbnail" className="h-full w-full object-cover" />
                ) : (
                  <span className="px-3 text-center text-xs text-slate-400">No thumbnail yet</span>
                )}
              </div>
              <div className="flex-1 space-y-3">
                {editing ? (
                  <div className="flex flex-wrap gap-2">
                    <label className={cn("inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50", (readOnly || thumbnailBusy) && "pointer-events-none opacity-50")}>
                      {thumbnailBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
                      {thumbnailBusy ? "Uploading…" : values.thumbnailUrl ? "Replace image" : "Upload image"}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={readOnly || thumbnailBusy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadThumbnail(file); event.target.value = ""; }} />
                    </label>
                    {values.thumbnailUrl ? (
                      <button type="button" onClick={() => void removeThumbnail()} disabled={readOnly || thumbnailBusy} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                        <Trash2 className="h-4 w-4" />Remove
                      </button>
                    ) : null}
                    <p className="w-full text-xs text-slate-500">JPG, PNG or WebP · maximum 2 MB</p>
                  </div>
                ) : (
                  <AlertBox title="Save the course first to upload an image" tone="info">
                    <p>Image upload needs a saved course to attach the file to. Save a draft below, then reopen it here — or paste a URL now instead.</p>
                  </AlertBox>
                )}
                <Field label="Or paste an image URL" error={errors.thumbnailUrl}><input value={values.thumbnailUrl && !values.thumbnailUrl.startsWith("blob:") ? values.thumbnailUrl : ""} onChange={(event) => update("thumbnailUrl", event.target.value || null)} type="url" className={fieldClass} disabled={readOnly || thumbnailBusy} placeholder="https://cdn.example.com/course.jpg" /></Field>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel>
        <h2 className="text-xl font-bold text-slate-950">Learning features</h2>
        <p className="mt-1 text-sm text-slate-500">Choose what this course can include. Actual access is still controlled by published batches and enrollments.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{features.map((feature) => { const selected = values.features.includes(feature); return <label key={feature} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm font-semibold", selected ? "border-brand-500 bg-brand-50 text-brand-900" : "border-slate-200 text-slate-700", readOnly && "cursor-default opacity-70")}><input type="checkbox" checked={selected} onChange={(event) => update("features", event.target.checked ? [...values.features, feature] : values.features.filter((item) => item !== feature))} disabled={readOnly} className="h-4 w-4 accent-brand-700" />{feature}</label>; })}</div>
        {errors.features ? <p className="mt-2 text-sm text-red-700">{errors.features}</p> : null}
      </Panel>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <ButtonLink href={returnBase} variant="outline">Cancel</ButtonLink>
        {!readOnly ? <Button type="button" variant="outline" onClick={() => submit(false)} disabled={busy}><Save className="h-4 w-4" />{busy ? "Saving…" : "Save draft"}</Button> : null}
        {!readOnly && canPublish ? <Button type="button" onClick={() => submit(true)} disabled={busy}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : values.published ? <CheckCircle2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}{busy ? "Saving…" : values.published ? "Save published course" : "Save and publish"}</Button> : null}
      </div>
      {dirty && !saved ? <p className="flex items-center justify-end gap-2 text-xs font-semibold text-amber-700"><XCircle className="h-4 w-4" />Unsaved changes</p> : null}
    </div>
  );
}

function Field({ label, children, required, error }: { label: string; children: React.ReactNode; required?: boolean; error?: string }) {
  return <label className="block text-sm font-semibold text-slate-700">{label}{required ? <span className="ml-1 text-red-600">*</span> : null}{children}{error ? <span className="mt-1 block text-xs font-medium text-red-700">{error}</span> : null}</label>;
}
