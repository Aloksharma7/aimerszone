"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { browserRequest, type NormalizedApiError } from "@/lib/api/browser-client";
import { isMockDataEnabled } from "@/lib/data/config";
import { useToast } from "@/providers/toast-provider";

/** Announcements carry no payment or academic history, so unlike courses/batches/enrollments this deletes outright — no archive step. */
export function DeleteAnnouncementButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const mockMode = isMockDataEnabled();

  async function destroy() {
    if (mockMode) {
      toast({ tone: "success", title: "Preview mode: nothing was deleted." });
      return;
    }
    try {
      await browserRequest({ url: `/api/v1/admin/announcements/${encodeURIComponent(id)}`, method: "DELETE" });
      toast({ tone: "success", title: "Announcement deleted." });
      router.refresh();
    } catch (caught) {
      const apiError = caught as Partial<NormalizedApiError>;
      const message = apiError.message || "The announcement could not be deleted.";
      toast({ tone: "danger", title: "Not deleted", message });
      throw new Error(message);
    }
  }

  return (
    <ConfirmAction
      label="Delete"
      icon={<Trash2 className="h-3.5 w-3.5" />}
      title={`Delete "${title}"?`}
      description="This cannot be undone."
      confirmLabel="Delete announcement"
      onConfirm={destroy}
    />
  );
}
