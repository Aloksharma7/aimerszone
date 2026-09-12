"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, LoaderCircle, Send } from "lucide-react";
import { browserRequest, createIdempotencyKey, type NormalizedApiError } from "@/lib/api/browser-client";
import { refreshPublicCatalogue } from "@/lib/catalogue-cache";
import { isMockDataEnabled } from "@/lib/data/config";
import { useToast } from "@/providers/toast-provider";

/**
 * One-click publish/unpublish for a course.
 *
 * The course form could only ever move a course from Draft to Published —
 * "Save draft" keeps whatever the current state already is, so a published
 * course had no button anywhere that took it back to Draft. This is that
 * missing half, kept outside the big edit form so it doesn't require
 * touching (or re-validating) the rest of the course to flip.
 */
export function PublishToggle({ id, slug, published }: { id: string; slug?: string; published: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const mockMode = isMockDataEnabled();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      if (mockMode) {
        toast({ tone: "success", title: "Preview mode: nothing was changed." });
        return;
      }
      await browserRequest({
        url: `/api/v1/admin/courses/${encodeURIComponent(id)}`,
        method: "PATCH",
        data: { published: !published },
        headers: { "Idempotency-Key": createIdempotencyKey("course-publish-toggle") },
      });
      toast({ tone: "success", title: published ? "Course unpublished" : "Course published" });
      await refreshPublicCatalogue({ slug });
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
        published
          ? "inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-300 px-3 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50 sm:h-10 sm:text-sm"
          : "inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-300 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 sm:h-10 sm:text-sm"
      }
    >
      {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" /> : published ? <EyeOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
      {busy ? "Saving…" : published ? "Unpublish" : "Publish"}
    </button>
  );
}
