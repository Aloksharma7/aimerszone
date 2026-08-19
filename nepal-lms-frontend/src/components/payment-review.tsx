"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { browserRequest, createIdempotencyKey, type NormalizedApiError } from "@/lib/api/browser-client";
import { Button, ButtonLink, Panel, StatusBadge } from "@/components/ui";
import { trustedDestination } from "@/lib/security/trusted-destination";
import { useToast } from "@/providers/toast-provider";

const mockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

type Decision = "approve" | "reject" | "flag";

function ErrorNotice({ error }: { error: NormalizedApiError | null }) {
  if (!error) return null;
  return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p className="font-bold">{error.message}</p>{error.requestId ? <p className="mt-1 font-mono text-xs">Reference: {error.requestId}</p> : null}</div>;
}

export function PaymentProofButton({ paymentId, available }: { paymentId: string; available: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  async function openProof() {
    if (!available || loading) return;
    setLoading(true);
    setError(null);
    try {
      if (mockMode) {
        setError({ status: 0, code: "preview_only", message: "Preview mode does not expose a real payment proof. Laravel will issue a short-lived authorized viewer URL.", retryable: false });
        return;
      }
      const response = await browserRequest<{ data: { view_url: string } }>({ url: `/api/v1/accounting/payments/${encodeURIComponent(paymentId)}/proof`, method: "POST", headers: { "Idempotency-Key": createIdempotencyKey("proof-view") } });
      const destination = trustedDestination(response.data.view_url, { currentOrigin: window.location.origin });
      if (!destination) throw { status: 502, code: "untrusted_file_url", message: "The proof viewer returned an untrusted destination.", retryable: false } satisfies NormalizedApiError;
      window.open(destination, "_blank", "noopener,noreferrer");
    } catch (caught) {
      setError(caught as NormalizedApiError);
    } finally {
      setLoading(false);
    }
  }

  return <div><Button variant="outline" className="w-full" onClick={openProof} disabled={!available || loading}><ExternalLink className="h-4 w-4" />{loading ? "Authorizing…" : available ? "Open authorized proof viewer" : "Proof unavailable"}</Button><div className="mt-3"><ErrorNotice error={error} /></div></div>;
}

/**
 * Loads the proof inline, mime-type aware, so an officer does not have to
 * switch tabs to look at the evidence before deciding on it. Falls back to
 * the new-tab button (full-size, or when the file type cannot be embedded).
 */
export function PaymentProofPreview({ paymentId, mimeType, available }: { paymentId: string; mimeType: string; available: boolean }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  const embeddable = available && (isImage || isPdf) && !mockMode;

  useEffect(() => {
    if (!embeddable) return;

    let cancelled = false;

    async function load() {
      try {
        const response = await browserRequest<{ data: { view_url: string } }>({
          url: `/api/v1/accounting/payments/${encodeURIComponent(paymentId)}/proof`,
          method: "POST",
          headers: { "Idempotency-Key": createIdempotencyKey("proof-preview") },
        });
        const destination = trustedDestination(response.data.view_url, { currentOrigin: window.location.origin });
        if (!destination) throw new Error("untrusted_destination");
        if (!cancelled) setPreviewUrl(destination);
      } catch {
        if (!cancelled) setError("The preview could not be loaded. Use the button below to open it in a new tab instead.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- paymentId is the only value this should reload on
  }, [paymentId]);

  if (!available) return null;

  return (
    <div className="mt-4 space-y-3">
      {isImage || isPdf ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {embeddable && loading ? (
            <div className="flex h-64 items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : previewUrl && isImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- authorized signed URL, not a Next-optimized asset
            <img src={previewUrl} alt="Payment proof" className="max-h-[480px] w-full object-contain" />
          ) : previewUrl && isPdf ? (
            <iframe src={previewUrl} title="Payment proof" className="h-[480px] w-full" />
          ) : (
            <div className="p-4 text-sm text-amber-800">{error || "The preview is unavailable."}</div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <FileText className="h-4 w-4 shrink-0" />
          This file type cannot be previewed inline — open it to review.
        </div>
      )}
      <PaymentProofButton paymentId={paymentId} available={available} />
    </div>
  );
}

export function PaymentReview({ paymentId, initialStatus = "Under review", basePath = "/accounting/payments" }: { paymentId: string; initialStatus?: string; basePath?: string }) {
  const { toast } = useToast();
  const [status, setStatus] = useState(initialStatus);
  const [reason, setReason] = useState("");
  const [pendingDecision, setPendingDecision] = useState<Decision | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function decisionLabel(decision: Decision): string {
    return decision === "approve" ? "Approve payment" : decision === "reject" ? "Reject payment" : "Flag possible duplicate";
  }

  async function confirmDecision() {
    if (!pendingDecision || loading) return;
    if (pendingDecision !== "approve" && reason.trim().length < 5) {
      setError({ status: 422, code: "validation_failed", message: "Enter a clear reason before rejecting or flagging this payment.", retryable: false });
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (mockMode) {
        const next = pendingDecision === "approve" ? "Approved" : pendingDecision === "reject" ? "Rejected" : "Flagged for duplicate review";
        setStatus(next);
        setSuccess("Preview validated. Laravel will re-check the external reference and complete the decision transaction.");
        setPendingDecision(null);
        toast({ tone: "success", title: `Preview: ${decisionLabel(pendingDecision)}`, message: "Nothing was saved — preview mode only." });
        return;
      }
      const response = await browserRequest<{ data: { status: string; message?: string } }>({
        url: `/api/v1/accounting/payments/${encodeURIComponent(paymentId)}/decision`,
        method: "POST",
        data: { decision: pendingDecision, reason: reason.trim() || null },
        headers: { "Idempotency-Key": createIdempotencyKey(`payment-${pendingDecision}`) },
      });
      const label = decisionLabel(pendingDecision);
      setStatus(response.data.status.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()));
      setSuccess(response.data.message || "Payment decision saved successfully.");
      setPendingDecision(null);
      toast({ tone: "success", title: `${label} — done`, message: response.data.message || "The decision was recorded." });
    } catch (caught) {
      setError(caught as NormalizedApiError);
      toast({ tone: "danger", title: "Decision not saved", message: (caught as Partial<NormalizedApiError>)?.message || "The request could not be completed." });
    } finally {
      setLoading(false);
    }
  }

  const decisionLocked = ["Approved", "Rejected", "Refunded"].includes(status);
  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-500">Current decision state</p><div className="mt-2"><StatusBadge status={status} /></div></div><ShieldCheck className="h-7 w-7 text-brand-700" /></div>
        <label className="mt-6 block text-sm font-semibold text-slate-700">Decision reason / internal note<textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-24 w-full rounded-lg border border-slate-300 p-3 font-normal outline-none focus:border-brand-600" placeholder="Required for rejection, duplicate flag, reversal or adjustment" maxLength={1000} disabled={decisionLocked} /></label>
        {!decisionLocked ? <><div className="mt-5 grid gap-3 sm:grid-cols-2"><Button onClick={() => setPendingDecision("approve")} disabled={loading}><CheckCircle2 className="h-4 w-4" />Approve payment</Button><Button variant="danger" onClick={() => setPendingDecision("reject")} disabled={loading}><XCircle className="h-4 w-4" />Reject payment</Button></div><Button variant="outline" className="mt-3 w-full" onClick={() => setPendingDecision("flag")} disabled={loading}><AlertTriangle className="h-4 w-4" />Flag possible duplicate</Button></> : <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">This payment has a completed decision state. Further changes require an authorized adjustment or refund workflow.</p>}
        {pendingDecision ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="font-bold text-amber-950">Confirm: {decisionLabel(pendingDecision)}</p><p className="mt-1 text-sm leading-6 text-amber-800">Laravel will lock the payment row, re-check conflicts, record the accountant and request ID, then perform the decision atomically.</p><div className="mt-4 flex gap-2"><Button size="sm" onClick={confirmDecision} disabled={loading}>{loading ? "Processing…" : "Confirm decision"}</Button><Button size="sm" variant="outline" onClick={() => setPendingDecision(null)} disabled={loading}>Cancel</Button></div></div> : null}
        <div className="mt-4 space-y-3"><ErrorNotice error={error} />{success ? <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-900"><p className="font-bold">Decision recorded</p><p className="mt-1">{success}</p></div> : null}</div>
      </Panel>
      <Panel><div className="flex gap-3"><FileText className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" /><div><h2 className="font-bold text-slate-950">Audit record</h2><p className="mt-2 text-sm leading-6 text-slate-600">Every decision records the accountant, payment, reason, time, source IP and request ID.</p></div></div><ButtonLink href={`${basePath}/${paymentId}`} variant="ghost" className="mt-4 w-full">Refresh payment record</ButtonLink></Panel>
    </div>
  );
}
