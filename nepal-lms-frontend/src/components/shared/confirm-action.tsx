"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/providers/toast-provider";

/**
 * A styled, inline stand-in for window.confirm().
 *
 * The native dialog is jarring, blocks the page, carries none of the app's
 * styling, and gives no room to explain what is about to happen. This stays
 * on the page, in the same visual language as every other action here.
 */
export function ConfirmAction({
  label,
  title,
  description,
  confirmLabel,
  tone = "danger",
  icon,
  disabled = false,
  triggerClassName,
  triggerChildren,
  ariaLabel,
  onConfirm,
}: {
  label: string;
  title: string;
  description?: string;
  confirmLabel: string;
  tone?: "danger" | "primary";
  icon?: React.ReactNode;
  disabled?: boolean;
  /** Full override of the trigger button's classes — for callers embedding this in a larger tile/grid layout. */
  triggerClassName?: string;
  /** Full override of the trigger button's content — takes precedence over icon/label. */
  triggerChildren?: React.ReactNode;
  /** For an icon-only trigger (empty label), the accessible name. */
  ariaLabel?: string;
  onConfirm: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
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
        disabled={disabled}
        aria-label={ariaLabel}
        className={triggerClassName || `inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold disabled:opacity-50 sm:h-10 sm:text-sm ${buttonClass}`}
      >
        {triggerChildren || <>{icon}{label}</>}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-bold text-slate-900">{title}</p>
      {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}

      {error ? <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onConfirm();
              setOpen(false);
              toast({ tone: "success", title: `${confirmLabel} — done` });
            } catch (caught) {
              const message = (caught as Partial<{ message: string }>)?.message;
              setError(message || "The action could not be completed.");
              toast({ tone: "danger", title: `${confirmLabel} — failed`, message: message || "The action could not be completed." });
            } finally {
              setBusy(false);
            }
          }}
          className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60 ${
            tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-brand-700 hover:bg-brand-800"
          }`}
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
          disabled={busy}
          className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
