"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Smartphone, XCircle } from "lucide-react";
import { browserRequest, createIdempotencyKey, type NormalizedApiError } from "@/lib/api/browser-client";
import { isMockDataEnabled } from "@/lib/data/config";
import { useToast } from "@/providers/toast-provider";

function messageFrom(error: unknown, fallback: string): string {
  const apiError = error as Partial<NormalizedApiError>;
  return apiError.message || fallback;
}

/**
 * A small prompt that requires a written reason.
 *
 * Every action here is one an auditor may later ask about — a cancelled class,
 * a released device, money paid out. The reason is stored with the audit entry,
 * so it is collected at the moment the person still remembers why.
 */
function ReasonAction({
  label,
  title,
  description,
  confirmLabel,
  tone = "danger",
  minLength = 5,
  onConfirm,
}: {
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "danger" | "primary";
  minLength?: number;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buttonClass =
    tone === "danger"
      ? "border-red-200 text-red-700 hover:bg-red-50"
      : "border-slate-300 text-slate-700 hover:bg-slate-50";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold ${buttonClass}`}
      >
        {tone === "danger" ? <XCircle className="h-4 w-4" /> : null}
        {label}
      </button>
    );
  }

  return (
    <form
      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
      onSubmit={async (event) => {
        event.preventDefault();

        if (reason.trim().length < minLength) {
          setError(`Give a reason of at least ${minLength} characters — it is recorded in the audit log.`);
          return;
        }

        setBusy(true);
        setError(null);

        try {
          await onConfirm(reason.trim());
          setOpen(false);
          setReason("");
          toast({ tone: "success", title: `${confirmLabel} — done` });
        } catch (caught) {
          const message = messageFrom(caught, "The action could not be completed.");
          setError(message);
          toast({ tone: "danger", title: `${confirmLabel} — failed`, message });
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{description}</p>

      <label className="mt-3 grid gap-1.5">
        <span className="text-sm font-semibold text-slate-800">Reason</span>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Recorded in the audit log."
        />
      </label>

      {error ? <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Keep as is
        </button>
      </div>
    </form>
  );
}

/**
 * Cancels a class.
 *
 * Not a delete: students may have planned around it, attendance may exist, and
 * the cancellation itself is information they need to see.
 */
export function CancelClassButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const mockMode = isMockDataEnabled();

  return (
    <ReasonAction
      label="Cancel class"
      title="Cancel this class?"
      description="Students will see it as cancelled with your reason. The Zoom meeting is released so an old link cannot be used."
      confirmLabel="Cancel the class"
      onConfirm={async (reason) => {
        if (mockMode) return;

        await browserRequest({
          url: `/api/v1/teacher/classes/${encodeURIComponent(sessionId)}/cancel`,
          method: "POST",
          data: { reason },
          headers: { "Idempotency-Key": createIdempotencyKey("class-cancel") },
        });

        router.refresh();
      }}
    />
  );
}

/**
 * Frees a student's device slots.
 *
 * The realistic case is a student who changed phone and is locked out of their
 * own account, so the office needs this to be one click — but auditable,
 * because it is also the control that account sharing would try to abuse.
 */
export function ResetDevicesButton({
  userId,
  devices,
}: {
  userId: string;
  devices: Array<{ id: string; label: string; platform: string | null; lastActiveAt: string | null; active: boolean }>;
}) {
  const router = useRouter();
  const mockMode = isMockDataEnabled();

  const active = devices.filter((device) => device.active);

  return (
    <div className="grid gap-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <Smartphone className="h-4 w-4" />
          Signed-in devices
        </p>

        {devices.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No devices recorded for this account.</p>
        ) : (
          <ul className="mt-2 grid gap-1.5">
            {devices.map((device) => (
              <li key={device.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-700">
                  {device.label}
                  {device.lastActiveAt ? <span className="text-slate-400"> · last active {device.lastActiveAt}</span> : null}
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${device.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {device.active ? "Active" : "Released"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {active.length > 0 ? (
        <ReasonAction
          label="Reset devices"
          title="Release every device slot?"
          description="Use this when a student has changed phone and cannot sign in. They will be able to sign in from a new device immediately."
          confirmLabel="Release devices"
          tone="primary"
          onConfirm={async (reason) => {
            if (mockMode) return;

            await browserRequest({
              url: `/api/v1/admin/users/${encodeURIComponent(userId)}/devices/reset`,
              method: "POST",
              data: { reason },
              headers: { "Idempotency-Key": createIdempotencyKey("device-reset") },
            });

            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Records that a requested refund has actually been paid out.
 *
 * Without this step a refund stays at "requested" forever and never reaches the
 * collections report, which counts only completed ones.
 */
export function CompleteRefundButton({ refundId }: { refundId: string }) {
  const router = useRouter();
  const mockMode = isMockDataEnabled();

  return (
    <ReasonAction
      label="Mark as paid"
      title="Confirm the money has left the account?"
      description="Enter the bank or wallet reference. Whoever requested this refund cannot be the one to complete it."
      confirmLabel="Record payout"
      tone="primary"
      minLength={3}
      onConfirm={async (reference) => {
        if (mockMode) return;

        await browserRequest({
          url: `/api/v1/accounting/refunds/${encodeURIComponent(refundId)}/complete`,
          method: "POST",
          data: { reference },
          headers: { "Idempotency-Key": createIdempotencyKey("refund-complete") },
        });

        router.refresh();
      }}
    />
  );
}

/**
 * Approves or rejects a scholarship, transfer or institutional exception.
 *
 * Staff raise these; only this decision grants the seat. The officer who asked
 * cannot be the one who approves.
 */
