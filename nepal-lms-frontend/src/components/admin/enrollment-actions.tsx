"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, LoaderCircle, Trash2 } from "lucide-react";
import { AlertBox, Button, Panel } from "@/components/ui";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { browserRequest, createIdempotencyKey, type NormalizedApiError } from "@/lib/api/browser-client";
import { isMockDataEnabled } from "@/lib/data/config";
import { useToast } from "@/providers/toast-provider";

/**
 * Cancel / permanently-delete controls for one enrollment.
 *
 * There was previously no way to remove an enrollment at all — only a
 * read-only roster and an export. Cancel is the everyday action: it revokes
 * access right away but keeps the row, so payment and attendance history
 * stay attributable to it. Permanent delete is for the rare seat that never
 * should have existed (no payment ever behind it) — the API refuses it the
 * moment a payment is attached, so this disables the button up front rather
 * than letting someone hit that error after typing a reason.
 */
export function EnrollmentActions({ id, studentName, status, hasPayment, redirectTo }: { id: string; studentName: string; status: string; hasPayment: boolean; redirectTo: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const mockMode = isMockDataEnabled();
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyCancelled = status.toLowerCase() === "cancelled";

  async function cancel() {
    if (reason.trim().length < 5) {
      setError("Enter at least a few words explaining why.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mockMode) {
        toast({ tone: "success", title: "Preview mode: nothing was changed." });
        return;
      }
      await browserRequest({
        url: `/api/v1/staff/enrollments/${encodeURIComponent(id)}/cancel`,
        method: "POST",
        data: { reason: reason.trim() },
        headers: { "Idempotency-Key": createIdempotencyKey("enrollment-cancel") },
      });
      toast({ tone: "success", title: "Enrollment cancelled" });
      setCancelling(false);
      router.refresh();
    } catch (caught) {
      const apiError = caught as Partial<NormalizedApiError>;
      setError(apiError.message || "The request could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  async function destroyPermanently() {
    if (mockMode) {
      toast({ tone: "success", title: "Preview mode: nothing was deleted." });
      return;
    }
    try {
      await browserRequest({ url: `/api/v1/staff/enrollments/${encodeURIComponent(id)}`, method: "DELETE" });
      toast({ tone: "success", title: `${studentName}'s enrollment permanently deleted.` });
      router.replace(redirectTo);
      router.refresh();
    } catch (caught) {
      const apiError = caught as Partial<NormalizedApiError>;
      const message = apiError.message || "The enrollment could not be deleted.";
      toast({ tone: "danger", title: "Not deleted", message });
      throw new Error(message);
    }
  }

  return (
    <Panel className="border-red-200">
      <h2 className="font-bold text-slate-950">Remove this enrollment</h2>

      {alreadyCancelled ? (
        <p className="mt-2 text-sm leading-6 text-slate-600">This enrollment is already cancelled. The seat can still be permanently deleted below.</p>
      ) : (
        <>
          <p className="mt-1 text-sm leading-6 text-slate-600">Revokes access immediately. Payment and attendance history are kept — this is the normal way to remove a student from a batch.</p>
          {error ? <div className="mt-3"><AlertBox title="Not cancelled" tone="danger"><p>{error}</p></AlertBox></div> : null}
          {cancelling ? (
            <div className="mt-4 space-y-3">
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Why is this enrollment being cancelled?"
                maxLength={500}
                className="min-h-24 w-full rounded-lg border border-slate-300 p-3 text-sm leading-6 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="danger" size="sm" onClick={cancel} disabled={busy}>
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                  {busy ? "Cancelling…" : "Confirm cancellation"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setCancelling(false); setError(null); }} disabled={busy}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="mt-4 border-red-300 text-red-700 hover:bg-red-50" onClick={() => setCancelling(true)}>
              <Ban className="h-4 w-4" />
              Cancel enrollment
            </Button>
          )}
        </>
      )}

      <div className="mt-6 border-t border-slate-100 pt-5">
        <p className="text-sm font-semibold text-slate-800">Permanent delete</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          {hasPayment
            ? "Not available: this seat is tied to a payment record. Cancel it instead so the payment stays traceable."
            : "No payment is attached to this seat, so it can be removed for good. This cannot be undone."}
        </p>
        <div className="mt-4">
          <ConfirmAction
            label="Delete forever"
            icon={<Trash2 className="h-3.5 w-3.5" />}
            title={`Permanently delete ${studentName}'s enrollment?`}
            description="This cannot be undone."
            confirmLabel="Delete forever"
            disabled={hasPayment}
            onConfirm={destroyPermanently}
          />
        </div>
      </div>
    </Panel>
  );
}
