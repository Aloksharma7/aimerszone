"use client";

import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { browserRequest, type NormalizedApiError } from "@/lib/api/browser-client";
import { isMockDataEnabled } from "@/lib/data/config";
import { useToast } from "@/providers/toast-provider";

const endpointFor = { course: "courses", batch: "batches" } as const;

/**
 * Row actions for the "Archived" view of the courses/batches lists.
 *
 * Archiving used to be a one-way trip: once a record was soft-deleted it
 * vanished from every list with no way back and no way to actually remove
 * it either. This is the other half — restore it, or (only once the API
 * confirms it never had any enrolment/payment history) delete it for real.
 */
export function ArchivedRowActions({ kind, id, name }: { kind: "course" | "batch"; id: string; name: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const mockMode = isMockDataEnabled();

  async function restore() {
    if (mockMode) {
      toast({ tone: "success", title: "Preview mode: nothing was restored." });
      return;
    }
    try {
      await browserRequest({ url: `/api/v1/admin/${endpointFor[kind]}/${encodeURIComponent(id)}/restore`, method: "POST" });
      toast({ tone: "success", title: `${name} restored.` });
      router.refresh();
    } catch (caught) {
      const apiError = caught as Partial<NormalizedApiError>;
      toast({ tone: "danger", title: "Not restored", message: apiError.message || "The request could not be completed." });
    }
  }

  async function destroyPermanently() {
    if (mockMode) {
      toast({ tone: "success", title: "Preview mode: nothing was deleted." });
      return;
    }
    try {
      await browserRequest({ url: `/api/v1/admin/${endpointFor[kind]}/${encodeURIComponent(id)}/permanent`, method: "DELETE" });
      toast({ tone: "success", title: `${name} permanently deleted.` });
      router.refresh();
    } catch (caught) {
      const apiError = caught as Partial<NormalizedApiError>;
      const message = apiError.message || `The ${kind} could not be deleted.`;
      toast({ tone: "danger", title: "Not deleted", message });
      throw new Error(message);
    }
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={() => void restore()}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Restore
      </button>
      <ConfirmAction
        label="Delete forever"
        icon={<Trash2 className="h-3.5 w-3.5" />}
        title={`Permanently delete "${name}"?`}
        description="Only possible because it has no enrolment or payment history. This cannot be undone."
        confirmLabel="Delete forever"
        onConfirm={destroyPermanently}
      />
    </div>
  );
}
