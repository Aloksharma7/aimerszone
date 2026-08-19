"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { browserRequest, type NormalizedApiError } from "@/lib/api/browser-client";

type State =
  | { kind: "verifying" }
  | { kind: "approved"; paymentId: string }
  | { kind: "incomplete"; message: string }
  | { kind: "failed"; message: string };

/**
 * Hands eSewa's signed return payload to the API for verification.
 *
 * The browser deliberately does not interpret the payload: only the server
 * holds the secret that proves the payment is real. A student crafting their
 * own success URL reaches this component and still fails verification.
 */
export function EsewaCallbackHandler({ payload }: { payload: string | null }) {
  // payload comes from the server-rendered URL query, so it is known before
  // the first render — no need for an effect to reach the "failed" state.
  const [state, setState] = useState<State>(() =>
    payload ? { kind: "verifying" } : { kind: "failed", message: "eSewa did not return any payment details." },
  );

  // React runs effects twice in development; verification is idempotent server
  // side, but the guard keeps the UI from flickering through two attempts.
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !payload) return;
    started.current = true;

    browserRequest<{ data: { status: string; payment_id?: string; message?: string } }>({
      url: "/api/v1/student/payments/esewa/callback",
      method: "POST",
      data: { data: payload },
    })
      .then((response) => {
        if (response.data.status === "approved") {
          setState({ kind: "approved", paymentId: response.data.payment_id ?? "" });
          return;
        }

        setState({ kind: "incomplete", message: response.data.message ?? "eSewa did not confirm this payment." });
      })
      .catch((caught) => {
        const apiError = caught as Partial<NormalizedApiError>;
        setState({ kind: "failed", message: apiError.message || "This payment could not be verified." });
      });
  }, [payload]);

  if (state.kind === "verifying") {
    return (
      <div className="flex max-w-xl items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6">
        <Loader2 className="h-5 w-5 animate-spin text-brand-700" />
        <p className="text-sm text-slate-700">Checking with eSewa. Do not close this page.</p>
      </div>
    );
  }

  if (state.kind === "approved") {
    return (
      <div className="max-w-xl rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <p className="flex items-center gap-2 text-lg font-bold text-emerald-900">
          <CheckCircle2 className="h-5 w-5" /> Payment confirmed
        </p>
        <p className="mt-1 text-sm text-emerald-800">
          Your seat is active and a receipt has been issued. Classes, recordings and notes are available now.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/student/courses" className="inline-flex h-11 items-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
            Go to my courses
          </Link>
          <Link href="/student/receipts" className="inline-flex h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            View receipt
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6">
      <p className="flex items-center gap-2 text-lg font-bold text-amber-900">
        <XCircle className="h-5 w-5" /> Not confirmed
      </p>
      <p className="mt-1 text-sm text-amber-900">{state.message}</p>
      <p className="mt-3 text-sm text-amber-900">
        If money left your account, contact the office with your eSewa transaction code and it will be matched manually.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/student/payments" className="inline-flex h-11 items-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
          Back to payments
        </Link>
        <Link href="/student/support" className="inline-flex h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Contact support
        </Link>
      </div>
    </div>
  );
}
