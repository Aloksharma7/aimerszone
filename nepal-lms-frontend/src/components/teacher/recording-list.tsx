"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileVideo, Trash2 } from "lucide-react";
import { browserRequest, type NormalizedApiError } from "@/lib/api/browser-client";
import { isMockDataEnabled } from "@/lib/data/config";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { StatusBadge } from "@/components/ui";
import type { Recording } from "@/types/lms";

/**
 * The list side of a batch's recordings, split out from the "Add recording"
 * form so it can manage its own delete action. Recordings had no delete
 * route at all before — a wrongly-pasted video id or a fully-retracted
 * recording could only be edited or hidden via release_at, never removed.
 */
export function RecordingList({ batchId, items }: { batchId: string; items: Recording[] }) {
  const router = useRouter();
  const mockMode = isMockDataEnabled();
  const [error, setError] = useState<string | null>(null);

  async function remove(recording: Recording) {
    setError(null);

    if (mockMode) return;

    try {
      await browserRequest({
        url: `/api/v1/teacher/batches/${encodeURIComponent(batchId)}/recordings/${encodeURIComponent(recording.id)}`,
        method: "DELETE",
      });

      router.refresh();
    } catch (caught) {
      const apiError = caught as Partial<NormalizedApiError>;
      setError(apiError.message || "The recording could not be removed.");
      throw caught;
    }
  }

  return (
    <>
      {error ? <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {items.length ? items.map((item) => (
          <div key={item.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700"><FileVideo className="h-5 w-5" /></div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{item.title}</h3><StatusBadge status={item.state === "Processing" ? "Processing" : "Published"} /></div>
              <p className="mt-1 text-sm text-slate-500">{item.module} · {item.date} · {item.duration}</p>
              <p className="mt-1 text-xs text-slate-400">Changes use a versioned recording update endpoint; published items remain auditable.</p>
            </div>
            <ConfirmAction
              label="Remove"
              icon={<Trash2 className="h-3.5 w-3.5" />}
              title={`Remove "${item.title}"?`}
              description="Students will lose access immediately. The video itself stays on YouTube."
              confirmLabel="Remove recording"
              triggerClassName="inline-flex h-9 items-center gap-1.5 self-start rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 sm:self-center"
              onConfirm={() => remove(item)}
            />
          </div>
        )) : <p className="p-5 text-sm text-slate-500">No recordings match this search.</p>}
      </div>
    </>
  );
}
