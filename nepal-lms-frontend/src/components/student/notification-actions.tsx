"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { browserRequest, type NormalizedApiError } from "@/lib/api/browser-client";
import { isMockDataEnabled } from "@/lib/data/config";

/**
 * Marks an announcement as read.
 *
 * The unread dot was rendered but never cleared, so the count only ever grew
 * and students learned to ignore it.
 */
export function MarkReadButton({ announcementId, read }: { announcementId: string; read: boolean }) {
  const router = useRouter();
  const mockMode = isMockDataEnabled();

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(read);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
        <Check className="h-3.5 w-3.5" /> Read
      </span>
    );
  }

  async function mark() {
    setBusy(true);
    setError(null);

    try {
      if (!mockMode) {
        await browserRequest({
          url: `/api/v1/student/announcements/${encodeURIComponent(announcementId)}/read`,
          method: "POST",
        });
      }

      // Optimistic locally, then refresh so the header count follows.
      setDone(true);
      router.refresh();
    } catch (caught) {
      const apiError = caught as Partial<NormalizedApiError>;
      setError(apiError.message || "Could not mark as read.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={mark}
        disabled={busy}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        Mark read
      </button>
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </span>
  );
}
