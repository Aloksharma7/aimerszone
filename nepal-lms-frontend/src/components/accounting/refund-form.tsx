"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Save, Undo2, X } from "lucide-react";
import { PaymentPicker, type PaymentSummary } from "@/components/accounting/adjustment-form";
import { AlertBox, Button, Panel, StatusBadge, labelledFieldClass } from "@/components/ui";
import { browserRequest, createIdempotencyKey, normalizeApiError } from "@/lib/api/browser-client";
import type { ApiResponse } from "@/lib/api/contracts";
import { formatNpr } from "@/lib/utils";

const mockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
const inputClass = labelledFieldClass;

export function AccountingRefundForm() {
  const router = useRouter();
  const [selected, setSelected] = useState<PaymentSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; title: string; message: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const data = {
      payment_id: selected?.id || "",
      amount_npr: Number(form.get("amount_npr") || 0),
      reason: String(form.get("reason") || "").trim(),
      method: String(form.get("method") || "").trim(),
      reference: String(form.get("reference") || "").trim(),
    };
    if (!data.payment_id || !Number.isFinite(data.amount_npr) || data.amount_npr <= 0 || data.reason.length < 10) {
      setNotice({ tone: "danger", title: "Refund not submitted", message: "Find the payment, enter a positive amount and a clear reason of at least 10 characters." });
      return;
    }
    setBusy(true); setNotice(null);
    try {
      if (mockMode) {
        setNotice({ tone: "success", title: "Preview validated", message: "Laravel will verify the payment is approved and that the refund does not exceed what was actually paid before creating it." });
        return;
      }
      const response = await browserRequest<ApiResponse<{ id: string }>>({
        url: "/api/v1/accounting/refunds",
        method: "POST",
        data: {
          payment_id: data.payment_id,
          amount_npr: data.amount_npr,
          reason: data.reason,
          method: data.method || undefined,
          reference: data.reference || undefined,
        },
        headers: { "Idempotency-Key": createIdempotencyKey("accounting-refund") },
      });
      router.replace(`/accounting/refunds?created=${encodeURIComponent(response.data.id)}`);
      router.refresh();
    } catch (caught) {
      setNotice({ tone: "danger", title: "Refund not submitted", message: normalizeApiError(caught).message });
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <Panel>
        <div className="flex items-center gap-3"><Undo2 className="h-6 w-6 text-brand-700" /><h2 className="text-xl font-bold text-slate-950">Refund details</h2></div>
        {notice ? <div className="mt-5"><AlertBox title={notice.title} tone={notice.tone}>{notice.message}</AlertBox></div> : null}
        <form onSubmit={submit} className="mt-6 grid gap-5 sm:grid-cols-2" noValidate>
          <div className="sm:col-span-2">
            {selected ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 p-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Selected payment</p>
                  <p className="mt-1 font-semibold text-slate-900">{selected.studentName} · {selected.courseTitle || "Course removed"}</p>
                  <p className="mt-1 text-xs text-slate-500">{selected.id} · {formatNpr(selected.amountNpr)} · <StatusBadge status={selected.status} /></p>
                </div>
                <button type="button" onClick={() => setSelected(null)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <X className="h-3.5 w-3.5" />Change
                </button>
              </div>
            ) : (
              <PaymentPicker onSelect={setSelected} />
            )}
          </div>
          <label className="text-sm font-semibold text-slate-700">Refund amount (NPR)<input name="amount_npr" type="number" min="1" step="1" required className={inputClass} /></label>
          <label className="text-sm font-semibold text-slate-700">Method (optional)<input name="method" maxLength={40} className={inputClass} placeholder="Bank transfer, eSewa, cash" /></label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Reference (optional)<input name="reference" maxLength={120} className={inputClass} placeholder="Bank or wallet transaction reference" /></label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Reason<textarea name="reason" required minLength={10} maxLength={500} className="mt-2 min-h-28 w-full rounded-lg border border-slate-300 p-3 font-normal outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="Recorded in the audit log." /></label>
          <div className="sm:col-span-2"><Button type="submit" disabled={busy || !selected}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? "Submitting…" : "Submit refund request"}</Button></div>
        </form>
      </Panel>
      <aside className="space-y-5">
        <AlertBox title="Only approved payments qualify" tone="warning">The payment must be in Approved status and the refund cannot exceed what was actually paid.</AlertBox>
        <AlertBox title="A separate payout step follows" tone="info">This creates the refund request. Recording the payout itself is a separate, audited action once the money has actually left the account.</AlertBox>
      </aside>
    </div>
  );
}
