"use client";

import Link from "next/link";
import { Clock3, LoaderCircle, MessageCircle, Send } from "lucide-react";
import { useState } from "react";
import { AlertBox, Button, Panel, StatusBadge, labelledFieldClass } from "@/components/ui";
import { browserRequest, createIdempotencyKey, normalizeApiError } from "@/lib/api/browser-client";
import type { ApiResponse } from "@/lib/api/contracts";
import type { StudentSupportData } from "@/lib/data/support";

const mockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
// Shared token; see fieldClass in components/ui.
const inputClass = labelledFieldClass;
const textareaClass = "mt-2 min-h-32 w-full rounded-lg border border-slate-300 p-3 font-normal outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100";
type Notice = { tone: "success" | "danger"; title: string; message: string } | null;

function messageFor(error: unknown): string {
  return normalizeApiError(error).message || "The request could not be completed.";
}

function NoticeBox({ notice }: { notice: Notice }) {
  return notice ? <AlertBox title={notice.title} tone={notice.tone}>{notice.message}</AlertBox> : null;
}

export function PublicSupportRequestForm() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") || "").trim();
    const mobile = String(form.get("mobile") || "").trim();
    const course = String(form.get("course") || "").trim();
    const message = String(form.get("message") || "").trim();
    const website = String(form.get("website") || "");
    if (name.length < 2 || mobile.length < 7 || message.length < 10) {
      setNotice({ tone: "danger", title: "Request not submitted", message: "Enter your name, a valid mobile number and a clear message of at least 10 characters." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      if (!mockMode) {
        await browserRequest<ApiResponse<{ ticket_reference: string }>>({
          url: "/api/v1/public/support-requests",
          method: "POST",
          data: { name, mobile, course: course || null, message, website },
          headers: { "Idempotency-Key": createIdempotencyKey("public-support") },
        });
      }
      formElement.reset();
      setNotice({ tone: "success", title: mockMode ? "Preview validated" : "Support request submitted", message: mockMode ? "The form passed validation. Preview mode does not submit anything." : "Your request was queued. Keep the confirmation reference shown by the institution." });
    } catch (error) {
      setNotice({ tone: "danger", title: "Request not submitted", message: messageFor(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <h2 className="text-2xl font-bold text-slate-950">Send a support request</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Provide enough detail for the support team to identify the course, payment or account issue.</p>
      <div className="mt-5"><NoticeBox notice={notice} /></div>
      <form onSubmit={submit} className="mt-7 grid gap-5 sm:grid-cols-2" noValidate>
        <label className="text-sm font-semibold text-slate-700">Full name<span className="text-red-600"> *</span><input name="name" required minLength={2} maxLength={120} autoComplete="name" className={inputClass} placeholder="Your full name" /></label>
        <label className="text-sm font-semibold text-slate-700">Mobile number<span className="text-red-600"> *</span><input name="mobile" required minLength={7} maxLength={20} autoComplete="tel" className={inputClass} placeholder="98XXXXXXXX" /></label>
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Course or batch<input name="course" maxLength={160} className={inputClass} placeholder="Example: Physics Morning Batch" /></label>
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">How can we help?<span className="text-red-600"> *</span><textarea name="message" required minLength={10} maxLength={2000} className={textareaClass} placeholder="Describe the issue clearly" /></label>
        <label className="sr-only" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
        <div className="sm:col-span-2"><Button type="submit" disabled={busy}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{busy ? "Submitting…" : "Submit support request"}</Button></div>
      </form>
    </Panel>
  );
}

export function StudentSupportManager({ initialData }: { initialData: StudentSupportData }) {
  const [tickets, setTickets] = useState(initialData.tickets);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const category = String(form.get("category") || "");
    const enrollmentId = String(form.get("enrollment_id") || "");
    const subject = String(form.get("subject") || "").trim();
    const message = String(form.get("message") || "").trim();
    if (!category || subject.length < 5 || message.length < 10) {
      setNotice({ tone: "danger", title: "Ticket not submitted", message: "Select an issue type and enter a clear subject and message." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      let ticketId = `TKT-PREVIEW-${Date.now()}`;
      if (!mockMode) {
        const response = await browserRequest<ApiResponse<{ id: string; created_at: string }>>({
          url: "/api/v1/student/support-tickets",
          method: "POST",
          data: { category, enrollment_id: enrollmentId || null, subject, message },
          headers: { "Idempotency-Key": createIdempotencyKey("student-support") },
        });
        ticketId = response.data.id;
      }
      setTickets((items) => [{ id: ticketId, subject, category, status: "Open", createdAt: "Just now", latestReply: null, replyCount: 0, updatedAt: "Just now" }, ...items]);
      formElement.reset();
      setNotice({ tone: "success", title: mockMode ? "Preview validated" : "Support ticket created", message: mockMode ? "The form passed validation. Preview mode does not create a ticket." : `Ticket ${ticketId} was created and can now be tracked here.` });
    } catch (error) {
      setNotice({ tone: "danger", title: "Ticket not submitted", message: messageFor(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <NoticeBox notice={notice} />
        <Panel>
          <h2 className="text-xl font-bold text-slate-950">Submit a support request</h2>
          <form onSubmit={submit} className="mt-6 grid gap-5 sm:grid-cols-2" noValidate>
            <label className="text-sm font-semibold text-slate-700">Issue type<select name="category" required defaultValue="course_access" className={`${inputClass} bg-white`}><option value="course_access">Course access</option><option value="payment">Payment</option><option value="account">Account</option><option value="class_recording">Class or recording</option><option value="test">Test</option><option value="other">Other</option></select></label>
            <label className="text-sm font-semibold text-slate-700">Related course<select name="enrollment_id" defaultValue="" className={`${inputClass} bg-white`}><option value="">Not course-specific</option>{(initialData.courses ?? []).map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Subject<input name="subject" required minLength={5} maxLength={160} className={inputClass} placeholder="Briefly describe the problem" /></label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Message<textarea name="message" required minLength={10} maxLength={3000} className={textareaClass} placeholder="Include the date, class or payment reference when relevant" /></label>
            <div className="sm:col-span-2"><Button type="submit" disabled={busy}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{busy ? "Submitting…" : "Submit request"}</Button></div>
          </form>
        </Panel>
      </div>
      <Panel>
        <h2 className="text-lg font-bold text-slate-950">Recent requests</h2>
        <div className="mt-5 space-y-4">{tickets.length ? tickets.slice(0, 5).map((ticket) => <Link key={ticket.id} href={`/student/support/${encodeURIComponent(ticket.id)}`} className="block rounded-xl border border-slate-200 p-4 transition hover:border-brand-300 hover:bg-slate-50"><div className="flex justify-between gap-3"><p className="text-sm font-semibold text-slate-900">{ticket.subject}</p><StatusBadge status={ticket.status} /></div><p className="mt-2 text-xs text-slate-500">{ticket.id} · raised {ticket.createdAt}</p>{ticket.replyCount > 0 ? <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><MessageCircle className="h-4 w-4" />{ticket.replyCount === 1 ? "1 reply" : `${ticket.replyCount} replies`} · open the conversation</p> : <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-500"><Clock3 className="h-4 w-4" />Waiting for a reply — we will answer here</p>}</Link>) : <p className="text-sm text-slate-500">No support requests yet.</p>}</div>
      </Panel>
    </div>
  );
}
