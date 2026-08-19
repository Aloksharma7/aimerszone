"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, Link2, LoaderCircle, MonitorPlay, RefreshCw, Save, Send, UploadCloud, UserCheck } from "lucide-react";
import { browserRequest, createIdempotencyKey, type NormalizedApiError } from "@/lib/api/browser-client";
import type { TeacherAttendanceDetail, TeacherSessionOption } from "@/lib/data/teacher";
import { trustedDestination } from "@/lib/security/trusted-destination";
import type { TeacherBatch } from "@/types/lms";
import { Button, StatusBadge } from "@/components/ui";

const mockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

function ErrorNotice({ error }: { error: NormalizedApiError | null }) {
  if (!error) return null;
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <p className="font-bold">{error.message}</p>
      {error.requestId ? <p className="mt-1 font-mono text-xs">Reference: {error.requestId}</p> : null}
    </div>
  );
}

function SuccessNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">{message}</div>;
}

export function StartTeacherClassButton({ sessionId, enabled = true }: { sessionId: string; enabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function startClass() {
    if (!enabled || loading) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (mockMode) {
        setSuccess("Preview only: Laravel will authorize the teacher, issue a short-lived host redirect, and record the start action.");
        return;
      }
      const response = await browserRequest<{ data: { redirect_url: string } }>({
        url: `/api/v1/teacher/classes/${encodeURIComponent(sessionId)}/start`,
        method: "POST",
        headers: { "Idempotency-Key": createIdempotencyKey("class-start") },
      });
      const destination = trustedDestination(response.data.redirect_url, { currentOrigin: window.location.origin });
      if (!destination) throw { status: 502, code: "untrusted_redirect", message: "The meeting provider returned an untrusted destination.", retryable: false } satisfies NormalizedApiError;
      window.location.assign(destination);
    } catch (caught) {
      setError(caught as NormalizedApiError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button size="lg" className="w-full sm:w-auto" onClick={startClass} disabled={!enabled || loading}>
        <MonitorPlay className="h-5 w-5" />{loading ? "Authorizing…" : "Start class"}
      </Button>
      <ErrorNotice error={error} />
      <SuccessNotice message={success} />
    </div>
  );
}

export function TeacherAttendanceEditor({ detail }: { detail: TeacherAttendanceDetail }) {
  const canFinalize = detail.session.canFinalizeAttendance !== false;
  const initialRows = useMemo(() => detail.rows.map((row) => ({ ...row, overrideReason: row.overrideReason || "" })), [detail.rows]);
  const [rows, setRows] = useState(initialRows);
  const [loading, setLoading] = useState<"draft" | "finalize" | "import" | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function updateRow(id: string, field: "status" | "overrideReason", value: string) {
    setRows((items) => items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function payload() {
    return {
      participants: rows.map((row) => ({
        student_id: row.id,
        attendance_status: row.status.toLowerCase().replace(/\s+/g, "_"),
        override_reason: row.overrideReason?.trim() || null,
      })),
    };
  }

  function validationMessage(): string | null {
    const invalid = rows.find((row) => ["Absent", "Excused", "Review"].includes(row.status) && row.status !== detail.rows.find((source) => source.id === row.id)?.status && !row.overrideReason?.trim());
    return invalid ? `Add an override reason for ${invalid.name}.` : null;
  }

  async function submit(mode: "draft" | "finalize") {
    const validation = validationMessage();
    if (validation) {
      setError({ status: 422, code: "validation_failed", message: validation, retryable: false });
      return;
    }
    setLoading(mode);
    setError(null);
    setSuccess(null);
    try {
      if (mockMode) {
        setSuccess(mode === "finalize" ? "Preview validated. Laravel will finalize attendance and create an audit entry." : "Preview draft validated. Laravel will save these overrides without finalizing.");
        return;
      }
      await browserRequest({
        url: `/api/v1/teacher/classes/${encodeURIComponent(detail.session.id)}/attendance${mode === "finalize" ? "/finalize" : ""}`,
        method: mode === "finalize" ? "POST" : "PUT",
        data: payload(),
        headers: { "Idempotency-Key": createIdempotencyKey(`attendance-${mode}`) },
      });
      setSuccess(mode === "finalize" ? "Attendance finalized successfully." : "Attendance draft saved.");
    } catch (caught) {
      setError(caught as NormalizedApiError);
    } finally {
      setLoading(null);
    }
  }

  async function reimport() {
    setLoading("import");
    setError(null);
    setSuccess(null);
    try {
      if (mockMode) {
        setSuccess("Preview only: Laravel will queue a signed Zoom attendance import and preserve existing manual overrides.");
        return;
      }
      await browserRequest({
        url: `/api/v1/teacher/classes/${encodeURIComponent(detail.session.id)}/attendance/import`,
        method: "POST",
        headers: { "Idempotency-Key": createIdempotencyKey("attendance-import") },
      });
      setSuccess("Attendance import queued. Refresh after processing completes.");
    } catch (caught) {
      setError(caught as NormalizedApiError);
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div><h2 className="text-xl font-bold text-slate-950">Participant matching</h2><p className="mt-1 text-sm text-slate-500">Zoom import, LMS joins and enrolled student identity.</p></div>
        <Button variant="outline" onClick={reimport} disabled={loading !== null}><RefreshCw className="h-4 w-4" />{loading === "import" ? "Importing…" : "Re-import"}</Button>
      </div>
      <div className="soft-scrollbar mt-5 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr>{["Student", "Zoom participant", "Duration", "Match confidence", "Status", "Override"].map((heading) => <th key={heading} className="border-b border-slate-200 px-4 py-3 font-bold">{heading}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3"><p className="font-semibold text-slate-900">{row.name}</p><p className="mt-1 text-xs text-slate-500">{row.id}</p></td>
                <td className="px-4 py-3 text-slate-700">{row.participantName}</td>
                <td className="px-4 py-3 text-slate-700">{row.duration}</td>
                <td className="px-4 py-3"><StatusBadge status={row.confidence} /></td>
                <td className="px-4 py-3"><select value={row.status} onChange={(event) => updateRow(row.id, "status", event.target.value)} className="h-9 rounded-lg border border-slate-300 bg-white px-2" disabled={detail.summary.finalized}><option>Present</option><option>Late</option><option>Absent</option><option>Excused</option><option>Review</option></select></td>
                <td className="px-4 py-3"><input value={row.overrideReason || ""} onChange={(event) => updateRow(row.id, "overrideReason", event.target.value)} className="h-9 w-44 rounded-lg border border-slate-300 px-2" placeholder="Reason if changed" disabled={detail.summary.finalized} maxLength={240} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5 space-y-3"><ErrorNotice error={error} /><SuccessNotice message={success} /></div>
      {!detail.summary.finalized ? (
        <div className="mt-5 flex flex-col items-end gap-3">
          <div className="flex flex-col justify-end gap-3 sm:flex-row">
            <Button variant="outline" onClick={() => submit("draft")} disabled={loading !== null}><Save className="h-4 w-4" />{loading === "draft" ? "Saving…" : "Save draft"}</Button>
            {canFinalize ? <Button onClick={() => submit("finalize")} disabled={loading !== null}><UserCheck className="h-4 w-4" />{loading === "finalize" ? "Finalizing…" : "Finalize attendance"}</Button> : null}
          </div>
          {!canFinalize ? <p className="text-sm text-slate-500">Only {detail.session.teacher}, the assigned teacher, can finalize this register.</p> : null}
        </div>
      ) : <div className="mt-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800"><CheckCircle2 className="h-5 w-5" />Attendance is finalized. Reopening requires a separate permission and audited reason.</div>}
    </>
  );
}

export function TeacherRecordingForm({ batchId, sessionOptions = [] }: { batchId: string; sessionOptions?: TeacherSessionOption[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const form = new FormData(event.currentTarget);
    const videoId = String(form.get("youtube_video_id") || "").trim();
    if (!/^[A-Za-z0-9_-]{6,32}$/.test(videoId)) {
      setError({ status: 422, code: "validation_failed", message: "Enter only a valid YouTube video ID, not a full URL.", retryable: false });
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (mockMode) {
        setSuccess("Preview validated. Laravel will verify this video ID, confirm batch ownership, and save the release record.");
        return;
      }
      await browserRequest({
        url: `/api/v1/teacher/batches/${encodeURIComponent(batchId)}/recordings`,
        method: "POST",
        data: {
          session_id: String(form.get("session_id") || "") || null,
          title: String(form.get("title") || "").trim(),
          youtube_video_id: videoId,
          release_at: String(form.get("release_at") || "") || null,
        },
        headers: { "Idempotency-Key": createIdempotencyKey("recording-create") },
      });
      event.currentTarget.reset();
      setSuccess("Recording saved successfully.");
    } catch (caught) {
      setError(caught as NormalizedApiError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
      <label className="block text-sm font-semibold text-slate-700">Related session <span className="font-normal text-slate-400">(optional)</span><select name="session_id" className="mt-2 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"><option value="">Not tied to a specific class</option>{sessionOptions.map((session) => <option key={session.id} value={session.id}>{session.label}</option>)}</select></label>
      <label className="block text-sm font-semibold text-slate-700">Title<input name="title" required maxLength={150} className="mt-2 h-10 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100" /></label>
      <label className="block text-sm font-semibold text-slate-700">YouTube video ID<input name="youtube_video_id" required className="mt-2 h-10 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="Video ID only" autoComplete="off" /></label>
      <label className="block text-sm font-semibold text-slate-700">Release date<input name="release_at" type="datetime-local" className="mt-2 h-10 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100" /></label>
      <ErrorNotice error={error} /><SuccessNotice message={success} />
      <Button type="submit" className="w-full" disabled={loading}><UploadCloud className="h-4 w-4" />{loading ? "Saving…" : "Save recording"}</Button>
    </form>
  );
}

export function TeacherAnnouncementForm({ batches }: { batches: TeacherBatch[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const data = {
        batch_id: String(form.get("batch_id") || ""),
        title: String(form.get("title") || "").trim(),
        body: String(form.get("body") || "").trim(),
        pinned: form.get("pinned") === "on",
      };
      if (!data.batch_id || data.title.length < 3 || data.body.length < 10) {
        setError({ status: 422, code: "validation_failed", message: "Select a batch and enter a clear title and message.", retryable: false });
        return;
      }
      if (mockMode) {
        setSuccess("Preview validated. Laravel will verify batch assignment and publish the announcement.");
        return;
      }
      await browserRequest({ url: "/api/v1/teacher/announcements", method: "POST", data, headers: { "Idempotency-Key": createIdempotencyKey("announcement") } });
      event.currentTarget.reset();
      setSuccess("Announcement published successfully.");
      router.refresh();
    } catch (caught) {
      setError(caught as NormalizedApiError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
      <label className="block text-sm font-semibold text-slate-700">Target batch<select name="batch_id" required className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"><option value="">Select assigned batch</option>{batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.course} · {batch.batch}</option>)}</select></label>
      <label className="block text-sm font-semibold text-slate-700">Title<input name="title" required minLength={3} maxLength={100} className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="Clear announcement title" /></label>
      <label className="block text-sm font-semibold text-slate-700">Message<textarea name="body" required minLength={10} maxLength={1000} className="mt-2 min-h-32 w-full rounded-lg border border-slate-300 p-3 font-normal outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="Write the complete update" /></label>
      <label className="flex items-center gap-3 text-sm font-medium text-slate-600"><input name="pinned" type="checkbox" className="h-4 w-4 accent-brand-700" />Pin this announcement</label>
      <ErrorNotice error={error} /><SuccessNotice message={success} />
      <Button type="submit" className="w-full" disabled={loading}><Send className="h-4 w-4" />{loading ? "Publishing…" : "Publish announcement"}</Button>
    </form>
  );
}


export function TeacherSessionForm({ batches }: { batches: TeacherBatch[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const form = new FormData(event.currentTarget);
    const data = {
      batch_id: String(form.get("batch_id") || ""),
      title: String(form.get("title") || "").trim(),
      starts_at: String(form.get("starts_at") || ""),
      ends_at: String(form.get("ends_at") || ""),
      instructions: String(form.get("instructions") || "").trim() || null,
    };
    if (!data.batch_id || data.title.length < 3 || !data.starts_at || !data.ends_at || new Date(data.ends_at) <= new Date(data.starts_at)) {
      setError({ status: 422, code: "validation_failed", message: "Select an assigned batch, add a title, and enter a valid start and end time.", retryable: false });
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (mockMode) {
        setSuccess("Preview validated. Laravel will verify the batch assignment and create the Zoom-backed session.");
        return;
      }
      const response = await browserRequest<{ data: { id: string } }>({
        url: "/api/v1/teacher/classes",
        method: "POST",
        data,
        headers: { "Idempotency-Key": createIdempotencyKey("teacher-session-create") },
      });
      router.replace(`/teacher/classes/${encodeURIComponent(response.data.id)}`);
      router.refresh();
    } catch (caught) {
      setError(caught as NormalizedApiError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2" noValidate>
      <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Assigned batch<select name="batch_id" required className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"><option value="">Select batch</option>{batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.course} · {batch.batch}</option>)}</select></label>
      <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Session title<input name="title" required minLength={3} maxLength={150} className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="Topic or class title" /></label>
      <label className="text-sm font-semibold text-slate-700">Starts at<input name="starts_at" type="datetime-local" required className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100" /></label>
      <label className="text-sm font-semibold text-slate-700">Ends at<input name="ends_at" type="datetime-local" required className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100" /></label>
      <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Instructions<textarea name="instructions" maxLength={1500} className="mt-2 min-h-28 w-full rounded-lg border border-slate-300 p-3 font-normal outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="Optional preparation or class instructions" /></label>
      <div className="space-y-3 sm:col-span-2"><ErrorNotice error={error} /><SuccessNotice message={success} /><Button type="submit" disabled={loading}>{loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}{loading ? "Creating…" : "Create session"}</Button></div>
    </form>
  );
}

export function TeacherSessionManagement({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"sync" | "reschedule" | "fallback" | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function mutate(kind: "sync" | "reschedule" | "fallback", data?: Record<string, unknown>) {
    if (loading) return;
    setLoading(kind); setError(null); setSuccess(null);
    try {
      if (!mockMode) {
        await browserRequest({
          url: kind === "sync" ? `/api/v1/teacher/classes/${encodeURIComponent(sessionId)}/sync` : kind === "fallback" ? `/api/v1/teacher/classes/${encodeURIComponent(sessionId)}/fallback` : `/api/v1/teacher/classes/${encodeURIComponent(sessionId)}`,
          method: kind === "reschedule" ? "PATCH" : "POST",
          data,
          headers: { "Idempotency-Key": createIdempotencyKey(`teacher-session-${kind}`) },
        });
        router.refresh();
      }
      setSuccess(mockMode ? `Preview validated. Laravel will process the ${kind} request after permission and state checks.` : kind === "sync" ? "Zoom status synchronized." : kind === "fallback" ? "Fallback configuration saved." : "Session rescheduled.");
    } catch (caught) { setError(caught as NormalizedApiError); } finally { setLoading(null); }
  }

  function reschedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startsAt = String(form.get("starts_at") || "");
    const endsAt = String(form.get("ends_at") || "");
    const reason = String(form.get("reason") || "").trim();
    if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt) || reason.length < 5) {
      setError({ status: 422, code: "validation_failed", message: "Enter a valid start/end time and a reason of at least five characters.", retryable: false });
      return;
    }
    void mutate("reschedule", { starts_at: startsAt, ends_at: endsAt, reason });
  }

  function fallback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const provider = String(form.get("provider") || "manual");
    const reference = String(form.get("reference") || "").trim();
    const reason = String(form.get("reason") || "").trim();
    if (reference.length < 3 || reason.length < 5) {
      setError({ status: 422, code: "validation_failed", message: "Enter a provider reference and a clear reason.", retryable: false });
      return;
    }
    void mutate("fallback", { provider, reference, reason });
  }

  return (
    <div className="space-y-4">
      <Button variant="outline" className="w-full" onClick={() => void mutate("sync")} disabled={loading !== null}><RefreshCw className={loading === "sync" ? "h-4 w-4 animate-spin" : "h-4 w-4"} />{loading === "sync" ? "Syncing…" : "Sync Zoom status"}</Button>
      <details className="rounded-xl border border-slate-200 p-4"><summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-800"><CalendarDays className="h-4 w-4" />Reschedule session</summary><form onSubmit={reschedule} className="mt-4 space-y-3"><input name="starts_at" type="datetime-local" required className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100" /><input name="ends_at" type="datetime-local" required className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100" /><textarea name="reason" required minLength={5} maxLength={500} className="min-h-20 w-full rounded-lg border border-slate-300 p-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="Reason for change" /><Button type="submit" size="sm" className="w-full" disabled={loading !== null}>{loading === "reschedule" ? "Saving…" : "Save new schedule"}</Button></form></details>
      <details className="rounded-xl border border-slate-200 p-4"><summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-800"><Link2 className="h-4 w-4" />Configure fallback</summary><form onSubmit={fallback} className="mt-4 space-y-3"><select name="provider" className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"><option value="manual">Manual meeting reference</option><option value="zoom_alternate">Alternate Zoom meeting</option><option value="phone">Phone / offline instruction</option></select><input name="reference" required maxLength={500} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="Provider reference or instruction" /><textarea name="reason" required minLength={5} maxLength={500} className="min-h-20 w-full rounded-lg border border-slate-300 p-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="Why fallback is needed" /><Button type="submit" size="sm" className="w-full" disabled={loading !== null}>{loading === "fallback" ? "Saving…" : "Save fallback"}</Button></form></details>
      <ErrorNotice error={error} /><SuccessNotice message={success} />
    </div>
  );
}
