"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, FileUp, Loader2, Search, UserPlus, X } from "lucide-react";
import { AlertBox, Button, Panel, labelledFieldClass } from "@/components/ui";
import { browserRequest, createIdempotencyKey, type NormalizedApiError } from "@/lib/api/browser-client";
import type { ApiResponse, PaginatedResponse } from "@/lib/api/contracts";
import { useToast } from "@/providers/toast-provider";
import { isMockDataEnabled } from "@/lib/data/config";
import type { StaffCourse } from "@/types/lms";

const inputClass = labelledFieldClass;
const textareaClass = "mt-2 min-h-24 w-full rounded-lg border border-slate-300 p-3 text-sm font-normal outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100";

export type FoundStudent = { id: string; name: string; mobile: string; email: string | null; studentCode: string | null };
type ApiStudentRow = { id: string; name: string; mobile: string; email: string | null; student_code: string | null };

function getError(error: unknown, fallback: string): string {
  return (error as Partial<NormalizedApiError>)?.message || fallback;
}

/**
 * Search-as-you-type over the same student list the Students screen uses,
 * so staff find someone by name or mobile instead of needing an exact id.
 */
function StudentPicker({ onSelect, onCreateNew }: { onSelect: (student: FoundStudent) => void; onCreateNew: () => void }) {
  const mockMode = isMockDataEnabled();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoundStudent[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchable = query.trim().length >= 2;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!searchable) return;

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        if (mockMode) {
          setResults([]);
          return;
        }
        const response = await browserRequest<ApiResponse<ApiStudentRow[]> | PaginatedResponse<ApiStudentRow>>({
          url: `/api/v1/staff/students?q=${encodeURIComponent(query.trim())}&per_page=8`,
          method: "GET",
        });
        setResults(response.data.map((row) => ({ id: row.id, name: row.name, mobile: row.mobile, email: row.email, studentCode: row.student_code })));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, mockMode, searchable]);

  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">
        Find the student
        <span className="relative mt-2 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className={`${inputClass} pl-9`}
            placeholder="Search by name or mobile number"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
        </span>
      </label>
      {searchable && searching ? <p className="mt-2 text-xs text-slate-500">Searching…</p> : null}
      {searchable && results.length ? (
        <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {results.map((student) => (
            <button
              key={student.id}
              type="button"
              onClick={() => { onSelect(student); setQuery(""); setResults([]); }}
              className="flex w-full items-center justify-between gap-3 p-3 text-left text-sm hover:bg-slate-50"
            >
              <span>
                <span className="block font-semibold text-slate-900">{student.name}</span>
                <span className="block text-xs text-slate-500">{student.mobile}{student.studentCode ? ` · ${student.studentCode}` : ""}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {searchable && !searching && results.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">No match. Check the spelling, or create a new account below.</p>
      ) : null}
      <button type="button" onClick={onCreateNew} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-900">
        <UserPlus className="h-4 w-4" />
        This person doesn&apos;t have an account yet
      </button>
    </div>
  );
}

/** Inline account creation, without leaving the enrollment flow. */
function NewStudentPanel({ onCreated, onCancel }: { onCreated: (student: FoundStudent, temporaryPassword: string | null) => void; onCancel: () => void }) {
  const mockMode = isMockDataEnabled();
  const [values, setValues] = useState({ name: "", mobile: "", email: "", setupMethod: "link" as "link" | "temporary" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (values.name.trim().length < 3 || !/^\+?[0-9\s-]{8,18}$/.test(values.mobile)) {
      setError("Enter a full name and a valid mobile number.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mockMode) {
        onCreated({ id: "preview-student", name: values.name.trim(), mobile: values.mobile.trim(), email: values.email.trim() || null, studentCode: "STD-PREVIEW" }, values.setupMethod === "temporary" ? "Preview-Pass-1" : null);
        return;
      }
      const response = await browserRequest<ApiResponse<{ id: string; student_code?: string; temporary_password?: string }>>({
        url: "/api/v1/staff/students",
        method: "POST",
        data: {
          name: values.name.trim(),
          mobile: values.mobile.trim(),
          email: values.email.trim() || null,
          preferred_language: "en",
          password_setup_method: values.setupMethod,
        },
        headers: { "Idempotency-Key": createIdempotencyKey("enroll-create-student") },
      });
      onCreated(
        { id: response.data.id, name: values.name.trim(), mobile: values.mobile.trim(), email: values.email.trim() || null, studentCode: response.data.student_code ?? null },
        response.data.temporary_password ?? null,
      );
    } catch (caught) {
      setError(getError(caught, "The account could not be created."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-brand-200 bg-brand-50 p-4">
      <p className="text-sm font-bold text-slate-900">New student account</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Full name<input className={inputClass} value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} /></label>
        <label className="text-sm font-semibold text-slate-700">Mobile number<input className={inputClass} value={values.mobile} onChange={(event) => setValues((current) => ({ ...current, mobile: event.target.value }))} inputMode="tel" /></label>
        <label className="text-sm font-semibold text-slate-700">Email <span className="font-normal text-slate-400">(optional)</span><input className={inputClass} type="email" value={values.email} onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))} /></label>
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Password setup
          <select className={inputClass} value={values.setupMethod} onChange={(event) => setValues((current) => ({ ...current, setupMethod: event.target.value as "link" | "temporary" }))}>
            <option value="link">Send setup link / code</option>
            <option value="temporary">Generate temporary password</option>
          </select>
        </label>
      </div>
      {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="mt-4 flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}{busy ? "Creating…" : "Create and continue"}</Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </form>
  );
}

/**
 * One guided flow: find or create the student, then record their payment
 * with proof, in a single screen — matching what the student would have
 * done themselves at checkout, just entered by staff on their behalf.
 *
 * Replaces the old two-screen reality (create an account, then separately
 * remember to go submit a payment for them) with one continuous path that
 * activates the seat immediately, since the staff member submitting it has
 * already verified the same evidence a second reviewer would look at. Falls
 * back to the normal review queue only when the submission itself is flagged
 * (duplicate evidence, or an amount mismatch) — see PaymentDecisionService.
 */
export function EnrollStudentForm({
  courses,
  redirectTo = "/staff/payment-submissions",
  initialStudent = null,
}: {
  courses: StaffCourse[];
  redirectTo?: string;
  /** Pre-selects the student when arriving from their own record, e.g. "Create payment submission" on a student's profile. */
  initialStudent?: FoundStudent | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const mockMode = isMockDataEnabled();

  const [student, setStudent] = useState<FoundStudent | null>(initialStudent);
  const [creatingNew, setCreatingNew] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [values, setValues] = useState({ courseId: "", batchId: "", method: "esewa", amount: "", payer: "", reference: "", date: new Date().toISOString().slice(0, 10), note: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCourse = courses.find((course) => (course.id || course.slug) === values.courseId);
  const courseBatches = selectedCourse?.batches ?? [];

  /*
   * A course with more than one open batch used to silently enroll into
   * "whichever the backend picks first" — this always resolves a real
   * batch selection into the request instead. Auto-picks the only batch
   * when there is just one, so staff aren't forced through an extra click
   * for the common case.
   */
  function selectCourse(courseId: string) {
    const nextCourse = courses.find((course) => (course.id || course.slug) === courseId);
    const batches = nextCourse?.batches ?? [];
    setValues((current) => ({ ...current, courseId, batchId: batches.length === 1 ? batches[0].id : "" }));
  }

  function studentCreated(created: FoundStudent, tempPassword: string | null) {
    setStudent(created);
    setCreatingNew(false);
    setTemporaryPassword(tempPassword);
    setValues((current) => ({ ...current, payer: current.payer || created.name }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!student) {
      setError("Find or create the student first.");
      return;
    }
    if (!values.courseId || values.amount.trim() === "" || Number(values.amount) < 0 || !file) {
      setError("Select the course, enter the amount paid (0 for a full scholarship or waiver), and attach proof.");
      return;
    }
    if (courseBatches.length > 1 && !values.batchId) {
      setError("This course has more than one open batch — choose which one the student is joining.");
      return;
    }
    if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setError("Use JPG, PNG or PDF under 8 MB.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let approvedNow = true;

      if (!mockMode) {
        const data = new FormData();
        Object.entries({
          student_id: student.id,
          course_id: values.courseId,
          ...(values.batchId ? { batch_id: values.batchId } : {}),
          payment_method: values.method,
          amount_npr: values.amount,
          payer_name: values.payer || student.name,
          transaction_reference: values.reference,
          payment_date: values.date || new Date().toISOString().slice(0, 10),
          internal_note: values.note,
          status: "submitted",
        }).forEach(([key, value]) => data.append(key, value));
        data.append("proof", file);

        const response = await browserRequest<ApiResponse<{ id: string; status: string }>>({
          url: "/api/v1/staff/payment-submissions",
          method: "POST",
          data,
          headers: { "Idempotency-Key": createIdempotencyKey("enroll-payment-submit") },
        });
        approvedNow = response.data.status === "approved";
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 400));
      }

      toast(approvedNow
        ? { tone: "success", title: "Student enrolled", message: `${student.name}'s seat is active now.` }
        : { tone: "success", title: "Sent for review", message: `${student.name}'s payment needs a second look (a scholarship/waiver, a duplicate, or an amount that doesn't match was detected) — a different staff member or admin can review it from the payments list.` });
      router.push(redirectTo);
      router.refresh();
    } catch (caught) {
      const message = getError(caught, "The submission could not be completed.");
      setError(message);
      toast({ tone: "danger", title: "Not submitted", message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <Panel>
        <div className="flex items-center gap-3"><UserPlus className="h-6 w-6 text-brand-700" /><h2 className="text-xl font-bold text-slate-950">1. Student</h2></div>

        <div className="mt-5">
          {student ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 p-3">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-700"><Check className="h-3.5 w-3.5" />Selected</p>
                <p className="mt-1 font-semibold text-slate-900">{student.name}</p>
                <p className="mt-1 text-xs text-slate-500">{student.mobile}{student.studentCode ? ` · ${student.studentCode}` : ""}</p>
              </div>
              <button type="button" onClick={() => { setStudent(null); setTemporaryPassword(null); }} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <X className="h-3.5 w-3.5" />Change
              </button>
            </div>
          ) : creatingNew ? (
            <NewStudentPanel onCreated={studentCreated} onCancel={() => setCreatingNew(false)} />
          ) : (
            <StudentPicker onSelect={setStudent} onCreateNew={() => setCreatingNew(true)} />
          )}

          {temporaryPassword ? (
            <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Temporary password — shown once</p>
              <div className="mt-2 flex items-center gap-3">
                <code className="flex-1 rounded-lg bg-slate-900 px-3 py-2 font-mono text-sm text-white">{temporaryPassword}</code>
                <button type="button" onClick={() => { navigator.clipboard.writeText(temporaryPassword); setCopied(true); }} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <Copy className="h-4 w-4" />{copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-2 text-xs text-emerald-800">Hand this to the student directly. It is not recoverable afterwards.</p>
            </div>
          ) : null}
        </div>

        <div className="mt-8 border-t border-slate-100 pt-6">
          <h2 className="text-xl font-bold text-slate-950">2. Payment received</h2>
          <p className="mt-1 text-sm text-slate-500">Use the details the student actually gave you. This activates their seat immediately, unless the evidence looks off — a duplicate screenshot, or an amount that does not match — in which case it goes to a second reviewer instead.</p>
          <form onSubmit={submit} className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Course<select className={inputClass} value={values.courseId} onChange={(event) => selectCourse(event.target.value)}><option value="">Select course</option>{courses.map((course) => <option key={course.id || course.slug} value={course.id || course.slug}>{course.title} · {course.batch}</option>)}</select></label>
            {courseBatches.length > 1 ? (
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                Batch
                <select className={inputClass} value={values.batchId} onChange={(event) => setValues((current) => ({ ...current, batchId: event.target.value }))}>
                  <option value="">Select batch</option>
                  {courseBatches.map((batch) => <option key={batch.id} value={batch.id}>{batch.title} · {batch.schedule}</option>)}
                </select>
              </label>
            ) : null}
            <label className="text-sm font-semibold text-slate-700">Expected amount<input value={selectedCourse?.price || 0} readOnly className={`${inputClass} bg-slate-100 text-slate-600`} /></label>
            <label className="text-sm font-semibold text-slate-700">Payment method<select className={inputClass} value={values.method} onChange={(event) => setValues((current) => ({ ...current, method: event.target.value }))}><option value="esewa">eSewa</option><option value="khalti">Khalti</option><option value="bank">Bank transfer</option><option value="cash">Cash receipt</option></select></label>
            <label className="text-sm font-semibold text-slate-700">Amount paid<input type="number" min="0" className={inputClass} value={values.amount} onChange={(event) => setValues((current) => ({ ...current, amount: event.target.value }))} /><span className="mt-1 block text-xs font-normal text-slate-400">For a full scholarship or fee waiver, enter 0 and attach the institution&apos;s authorization slip as proof below.</span></label>
            <label className="text-sm font-semibold text-slate-700">Payer name<input className={inputClass} value={values.payer} onChange={(event) => setValues((current) => ({ ...current, payer: event.target.value }))} placeholder={student?.name || ""} /></label>
            <label className="text-sm font-semibold text-slate-700">Reference number<input className={inputClass} value={values.reference} onChange={(event) => setValues((current) => ({ ...current, reference: event.target.value }))} /></label>
            <label className="text-sm font-semibold text-slate-700">Payment date<input type="date" className={inputClass} value={values.date} onChange={(event) => setValues((current) => ({ ...current, date: event.target.value }))} /></label>
            <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center sm:col-span-2">
              <FileUp className="h-8 w-8 text-brand-700" />
              <span className="mt-3 font-bold text-slate-800">{file ? file.name : "Upload proof supplied by the student"}</span>
              <span className="mt-1 text-xs text-slate-500">JPG, PNG or PDF · maximum 8 MB · required</span>
              <input type="file" accept="image/jpeg,image/png,application/pdf" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Internal note <span className="font-normal text-slate-400">(optional)</span><textarea className={textareaClass} value={values.note} onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))} /></label>

            {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</p> : null}

            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy || !student}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{busy ? "Enrolling…" : "Enroll student"}</Button>
            </div>
          </form>
        </div>
      </Panel>
      <aside className="space-y-5">
        <AlertBox title="Access activates on submission" tone="info">
          <p>You already verified this payment before entering it here, so the student&apos;s seat activates immediately — no separate approval step. Only a flagged submission (a scholarship/waiver, duplicate evidence, or an amount mismatch) falls back to a second reviewer.</p>
        </AlertBox>
        <AlertBox title="For a scholarship or fee waiver" tone="warning">
          <p>Enter 0 as the amount paid and attach the institution&apos;s authorization slip as proof instead of a payment screenshot. It still needs a different staff member or admin to approve it before the seat activates.</p>
        </AlertBox>
      </aside>
    </div>
  );
}
