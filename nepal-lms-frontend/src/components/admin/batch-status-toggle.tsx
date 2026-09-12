"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, CalendarX, LoaderCircle } from "lucide-react";
import { browserRequest, createIdempotencyKey, type NormalizedApiError } from "@/lib/api/browser-client";
import { useToast } from "@/providers/toast-provider";
import { isMockDataEnabled } from "@/lib/data/config";

const acceptingEnrollment = ["Open", "Ongoing"];

/**
 * One-click "Open for enrollment" / "Close enrollment" for a batch.
 *
 * A new batch defaults to Draft, and Draft is correctly refused by the
 * enrollment API ("batch_closed") — but the only way to change that was the
 * full batch editor's "Operational status" dropdown, several fields away
 * from where staff actually hit the error while trying to enrol someone.
 * This puts the one transition that unblocks enrollment right next to the
 * status badge.
 */
export function BatchStatusToggle({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const mockMode = isMockDataEnabled();
  const [busy, setBusy] = useState(false);
  const open = acceptingEnrollment.includes(status);

  async function toggle() {
    setBusy(true);
    try {
      if (mockMode) {
        toast({ tone: "success", title: "Preview mode: nothing was changed." });
        return;
      }
      await browserRequest({
        url: `/api/v1/admin/batches/${encodeURIComponent(id)}`,
        method: "PATCH",
        data: { status: open ? "closed" : "open" },
        headers: { "Idempotency-Key": createIdempotencyKey("batch-status-toggle") },
      });
      toast({ tone: "success", title: open ? "Enrollment closed" : "Batch opened for enrollment" });
      router.refresh();
    } catch (caught) {
      const apiError = caught as Partial<NormalizedApiError>;
      toast({ tone: "danger", title: "Could not update", message: apiError.message || "The request could not be completed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      className={
        open
          ? "inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-300 px-3 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50 sm:h-10 sm:text-sm"
          : "inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-300 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 sm:h-10 sm:text-sm"
      }
    >
      {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" /> : open ? <CalendarX className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <CalendarCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
      {busy ? "Saving…" : open ? "Close enrollment" : "Open for enrollment"}
    </button>
  );
}
