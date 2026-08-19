"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, LoaderCircle, Send } from "lucide-react";
import { AlertBox, Button, Panel, StatusBadge } from "@/components/ui";
import { browserRequest, createIdempotencyKey, type NormalizedApiError } from "@/lib/api/browser-client";
import type { SupportTicketDetail } from "@/lib/data/support-inbox";
import { cn } from "@/lib/utils";

const mockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

/**
 * The conversation on a support ticket.
 *
 * Students could raise a ticket from the first release and nobody could
 * answer one — the ticket sat at "Open" with no reply and no status change.
 * This is both halves of the thread; the same component serves the student and
 * the staff member, differing only in what the API returns (`can_manage`) and
 * therefore what is offered.
 */
export function TicketThread({ ticket }: { ticket: SupportTicketDetail }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closed = ["resolved", "closed"].includes(ticket.status);
  const canReply = ticket.canManage || !closed;

  async function send() {
    if (body.trim().length < 2) {
      setError("Write a reply before sending.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      if (mockMode) {
        setError("Preview mode: the reply was not saved.");
        return;
      }

      await browserRequest({
        url: `/api/v1/support/tickets/${encodeURIComponent(ticket.id)}/messages`,
        method: "POST",
        data: {
          body: body.trim(),
          is_internal: ticket.canManage ? internal : false,
          ...(ticket.canManage && status ? { status } : {}),
        },
        headers: { "Idempotency-Key": createIdempotencyKey("support-reply") },
      });

      setBody("");
      setInternal(false);
      setStatus("");
      router.refresh();
    } catch (caught) {
      const apiError = caught as Partial<NormalizedApiError>;
      setError(apiError.message || "The reply could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-700">{ticket.reference}</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">{ticket.subject}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {ticket.studentName} · {ticket.category} · raised {ticket.createdAt}
            </p>
          </div>
          <StatusBadge status={ticket.status} />
        </div>
        <p className="mt-5 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{ticket.message}</p>
      </Panel>

      {ticket.messages.length ? (
        <div className="space-y-3">
          {ticket.messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "rounded-xl border p-4",
                message.isInternal
                  ? "border-amber-200 bg-amber-50"
                  : message.fromStudent
                    ? "border-slate-200 bg-white"
                    : "border-brand-200 bg-brand-50",
              )}
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-slate-900">{message.authorName}</span>
                {message.isInternal ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                    <EyeOff className="h-3 w-3" />
                    Internal note
                  </span>
                ) : null}
                <span className="text-xs text-slate-400">{message.createdAt}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{message.body}</p>
            </div>
          ))}
        </div>
      ) : (
        <Panel className="text-sm text-slate-500">
          {ticket.canManage ? "No reply yet. The student is waiting." : "No reply yet. Someone will answer here."}
        </Panel>
      )}

      {canReply ? (
        <Panel>
          <h3 className="font-bold text-slate-950">{ticket.canManage ? "Reply to the student" : "Add to this request"}</h3>
          {error ? (
            <div className="mt-3">
              <AlertBox title="Not sent" tone="danger">
                <p>{error}</p>
              </AlertBox>
            </div>
          ) : null}
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={4000}
            placeholder={ticket.canManage ? "Answer the question, or leave an internal note for colleagues." : "Add anything else that helps."}
            className="mt-3 min-h-32 w-full rounded-xl border border-slate-300 p-4 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />

          {ticket.canManage ? (
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} className="h-4 w-4 accent-brand-700" />
                Internal note — the student never sees this
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                Set status
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="">Leave as is</option>
                  <option value="open">Open</option>
                  <option value="pending">Waiting on student</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
            </div>
          ) : null}

          <div className="mt-4 flex justify-end">
            <Button onClick={send} disabled={busy}>
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {busy ? "Sending…" : "Send reply"}
            </Button>
          </div>
        </Panel>
      ) : (
        <Panel className="text-sm text-slate-600">
          This request is {ticket.status}. If you still need help, raise a new one from the support page and mention {ticket.reference}.
        </Panel>
      )}
    </div>
  );
}
