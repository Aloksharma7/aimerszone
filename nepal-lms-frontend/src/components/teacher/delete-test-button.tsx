"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { browserRequest, type NormalizedApiError } from "@/lib/api/browser-client";
import { isMockDataEnabled } from "@/lib/data/config";
import { useToast } from "@/providers/toast-provider";

/**
 * There was previously no way to remove a test at all. The API refuses this
 * outright once a student has attempted it — the button still renders so
 * the reason is visible, rather than silently disappearing once a test has
 * results.
 */
export function DeleteTestButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const mockMode = isMockDataEnabled();

  async function destroy() {
    if (mockMode) {
      toast({ tone: "success", title: "Preview mode: nothing was deleted." });
      return;
    }
    try {
      await browserRequest({ url: `/api/v1/teacher/tests/${encodeURIComponent(id)}`, method: "DELETE" });
      toast({ tone: "success", title: "Test deleted." });
      router.refresh();
    } catch (caught) {
      const apiError = caught as Partial<NormalizedApiError>;
      const message = apiError.message || "The test could not be deleted.";
      toast({ tone: "danger", title: "Not deleted", message });
      throw new Error(message);
    }
  }

  return (
    <ConfirmAction
      label="Delete"
      icon={<Trash2 className="h-3.5 w-3.5" />}
      title={`Delete "${title}"?`}
      description="Only possible because no student has attempted it yet. This cannot be undone."
      confirmLabel="Delete test"
      onConfirm={destroy}
    />
  );
}
