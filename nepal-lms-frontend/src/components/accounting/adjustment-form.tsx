"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownUp, LoaderCircle, Save, Search, X } from "lucide-react";
import { AlertBox, Button, Panel, StatusBadge, labelledFieldClass } from "@/components/ui";
import { browserRequest, createIdempotencyKey, normalizeApiError } from "@/lib/api/browser-client";
import type { ApiResponse, PaginatedResponse } from "@/lib/api/contracts";
import { useToast } from "@/providers/toast-provider";
import { formatNpr } from "@/lib/utils";

const mockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
// Shared token; see fieldClass in components/ui.
const inputClass = labelledFieldClass;

export type PaymentSummary = { id: string; studentName: string; courseTitle: string | null; amountNpr: number; status: string };

type ApiPaymentQueueRow = { id: string; student_name?: string | null; course_title?: string | null; submitted_amount_npr: number; status: string };

function mapRow(row: ApiPaymentQueueRow): PaymentSummary {
  return { id: row.id, studentName: row.student_name || "Student", courseTitle: row.course_title ?? null, amountNpr: row.submitted_amount_npr, status: row.status };
}

/**
 * Search-as-you-type over the same payment queue endpoint the review screen
 * uses, so an accountant finds the payment by student name instead of
 * hand-typing an exact "PAY-..." id — a meaningful error risk for a form
 * whose whole purpose is an irreversible financial correction.
 */
export function PaymentPicker({ onSelect }: { onSelect: (payment: PaymentSummary) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PaymentSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        if (mockMode) {
          setResults([]);
          return;
        }
        const response = await browserRequest<ApiResponse<ApiPaymentQueueRow[]> | PaginatedResponse<ApiPaymentQueueRow>>({
          url: `/api/v1/accounting/payments?q=${encodeURIComponent(query.trim())}&per_page=8`,
          method: "GET",
        });
        setResults(response.data.map(mapRow));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">
        Find the payment
        <span className="relative mt-2 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className={`${inputClass} pl-9`}
            placeholder="Search by student name or mobile"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
        </span>
      </label>
      {searching ? <p className="mt-2 text-xs text-slate-500">Searching…</p> : null}
      {results.length ? (
        <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {results.map((payment) => (
            <button
              key={payment.id}
              type="button"
              onClick={() => { onSelect(payment); setQuery(""); setResults([]); }}
              className="flex w-full items-center justify-between gap-3 p-3 text-left text-sm hover:bg-slate-50"
            >
              <span>
                <span className="block font-semibold text-slate-900">{payment.studentName}</span>
                <span className="block text-xs text-slate-500">{payment.courseTitle || "Course removed"} · {payment.id}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-semibold tabular-nums text-slate-900">{formatNpr(payment.amountNpr)}</span>
                <StatusBadge status={payment.status} />
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {!searching && query.trim().length >= 2 && results.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">No matching payment. Try the student&apos;s full name or mobile number.</p>
      ) : null}
    </div>
  );
}

export function AccountingAdjustmentForm({ initialPayment = null, returnPath = "/accounting/adjustments" }: { initialPayment?: PaymentSummary | null; returnPath?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [selected, setSelected] = useState<PaymentSummary | null>(initialPayment);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; title: string; message: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const data = {
      payment_id: selected?.id || "",
      type: String(form.get("type") || "credit"),
      amount_npr: Number(form.get("amount_npr") || 0),
      reason: String(form.get("reason") || "").trim(),
      authorization_reference: String(form.get("authorization_reference") || "").trim(),
    };
    if (!data.payment_id || !Number.isFinite(data.amount_npr) || data.amount_npr <= 0 || data.reason.length < 10 || data.authorization_reference.length < 3) {
      setNotice({ tone: "danger", title: "Adjustment not submitted", message: "Find the payment, enter a positive amount, authorization reference and a clear reason." });
      return;
    }
    setBusy(true); setNotice(null);
    try {
      if (mockMode) {
        setNotice({ tone: "success", title: "Preview validated", message: "The server will double-check the payment, authorization, policy limits and duplicate requests before creating the adjustment." });
        return;
      }
      const response = await browserRequest<ApiResponse<{ id: string }>>({
        url: "/api/v1/accounting/adjustments",
        method: "POST",
        data,
        headers: { "Idempotency-Key": createIdempotencyKey("accounting-adjustment") },
      });
      toast({ tone: "success", title: "Adjustment submitted" });
      router.replace(`${returnPath}?created=${encodeURIComponent(response.data.id)}`);
      router.refresh();
    } catch (caught) {
      const message = normalizeApiError(caught).message;
      setNotice({ tone: "danger", title: "Adjustment not submitted", message });
      toast({ tone: "danger", title: "Adjustment not submitted", message });
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <Panel>
        <div className="flex items-center gap-3"><ArrowDownUp className="h-6 w-6 text-brand-700" /><h2 className="text-xl font-bold text-slate-950">Adjustment details</h2></div>
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
                {initialPayment && initialPayment.id === selected.id ? null : (
                  <button type="button" onClick={() => setSelected(null)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    <X className="h-3.5 w-3.5" />Change
                  </button>
                )}
              </div>
            ) : (
              <PaymentPicker onSelect={setSelected} />
            )}
          </div>
          <label className="text-sm font-semibold text-slate-700">Adjustment type<select name="type" className={inputClass}><option value="credit">Credit</option><option value="debit">Debit</option><option value="reversal">Reversal</option><option value="refund">Refund</option></select></label>
          <label className="text-sm font-semibold text-slate-700">Amount (NPR)<input name="amount_npr" type="number" min="1" step="1" required className={inputClass} /></label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Authorization reference<input name="authorization_reference" required maxLength={120} className={inputClass} placeholder="Approval ticket, policy reference or manager authorization" /></label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Permanent reason<textarea name="reason" required minLength={10} maxLength={1000} className="mt-2 min-h-28 w-full rounded-lg border border-slate-300 p-3 font-normal outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" /></label>
          <div className="sm:col-span-2"><Button type="submit" disabled={busy || !selected}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? "Submitting…" : "Submit adjustment"}</Button></div>
        </form>
      </Panel>
      <aside className="space-y-5">
        <AlertBox title="No destructive edits" tone="warning">This creates a separate, permanent financial record. It never overwrites or deletes the original payment and receipt.</AlertBox>
        <AlertBox title="Server authorization required" tone="info">The backend rechecks accountant permission, amount limits, approval policy, payment state and idempotency before committing anything.</AlertBox>
      </aside>
    </div>
  );
}
