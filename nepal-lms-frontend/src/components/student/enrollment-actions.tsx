"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, ShieldCheck, Wallet } from "lucide-react";
import { browserRequest, createIdempotencyKey, type NormalizedApiError } from "@/lib/api/browser-client";
import { isMockDataEnabled } from "@/lib/data/config";

/**
 * Sends the student to eSewa.
 *
 * eSewa is a redirect gateway: the browser must POST a signed form to their
 * domain, so the form is built here from the fields the API signed and
 * submitted immediately. The signature comes from the server — nothing about
 * the amount is decided in the browser, and a tampered field simply fails
 * verification on the way back.
 */
export function EsewaCheckoutButton({ batchId, amountLabel }: { batchId: string; amountLabel: string }) {
  const mockMode = isMockDataEnabled();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);

    try {
      if (mockMode) {
        setError("Preview mode: online payment is disabled.");
        return;
      }

      const response = await browserRequest<{ data: { action: string; fields: Record<string, string> } }>({
        url: "/api/v1/student/payments/esewa/checkout",
        method: "POST",
        data: { batch_id: batchId },
        headers: { "Idempotency-Key": createIdempotencyKey("esewa-checkout") },
      });

      // A real form post is required: eSewa does not accept a JSON body or a
      // cross-origin fetch, and the user must land on their domain to pay.
      const form = document.createElement("form");
      form.method = "POST";
      form.action = response.data.action;

      Object.entries(response.data.fields).forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (caught) {
      const apiError = caught as Partial<NormalizedApiError>;
      setError(apiError.message || "eSewa checkout could not be started.");
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
        Pay {amountLabel} with eSewa
      </button>
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5" />
        You are enrolled automatically once eSewa confirms the payment.
      </p>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

/**
 * Joins a free course.
 *
 * Payment approval used to be the only activation path, so a course marked
 * free could not actually be joined. The server re-checks that the course is
 * genuinely free; this button only asks.
 */
export function FreeEnrollButton({ batchId, courseTitle }: { batchId: string; courseTitle: string }) {
  const router = useRouter();
  const mockMode = isMockDataEnabled();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function join() {
    setBusy(true);
    setError(null);

    try {
      if (mockMode) {
        setDone(true);
        return;
      }

      await browserRequest({
        url: "/api/v1/student/enroll-free",
        method: "POST",
        data: { batch_id: batchId },
        headers: { "Idempotency-Key": createIdempotencyKey("free-enroll") },
      });

      setDone(true);
      router.refresh();
      router.push("/student/courses");
    } catch (caught) {
      const apiError = caught as Partial<NormalizedApiError>;
      setError(apiError.message || "You could not be enrolled. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
        You are enrolled in {courseTitle}. It now appears under My Courses.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={join}
        disabled={busy}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Join this free course
      </button>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
