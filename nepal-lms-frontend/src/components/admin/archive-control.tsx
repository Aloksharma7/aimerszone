"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, LoaderCircle } from "lucide-react";
import { AlertBox, Button, Panel } from "@/components/ui";
import { browserRequest, type NormalizedApiError } from "@/lib/api/browser-client";
import { refreshPublicCatalogue } from "@/lib/catalogue-cache";

const mockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

/**
 * Archive control for a course or a batch.
 *
 * The API soft-deletes: the record stays and every read path already filters
 * on it. That is deliberate — enrolments, payments and receipts all reference
 * these rows, so removing one outright would leave a student's paid history
 * pointing at nothing.
 *
 * The API refuses to archive anything that still has students with active
 * access, and returns a message saying how many. That message is shown as-is
 * rather than replaced with a generic failure, because it is the only thing
 * that tells the administrator what to do next.
 */
export function ArchiveControl({
  kind,
  id,
  name,
  redirectTo,
  slug,
}: {
  kind: "course" | "batch" | "user";
  id: string;
  name: string;
  redirectTo: string;
  /** The course's public slug, so archiving it also drops its public detail-page cache. */
  slug?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function archive() {
    setBusy(true);
    setError(null);

    try {
      if (mockMode) {
        setError("Preview mode: nothing was archived.");
        return;
      }

      await browserRequest({
        url: `/api/v1/admin/${{ course: "courses", batch: "batches", user: "users" }[kind]}/${encodeURIComponent(id)}`,
        method: "DELETE",
      });
      router.replace(redirectTo);
      await refreshPublicCatalogue({ slug });
      router.refresh();
    } catch (caught) {
      const apiError = caught as Partial<NormalizedApiError>;
      setError(apiError.message || `The ${kind} could not be archived.`);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel className="border-red-200">
      <div className="flex items-start gap-3">
        <Archive className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-slate-950">Archive this {kind}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {kind === "user"
              ? "The account is suspended and hidden from every list. Payment history, receipts and audit entries are kept intact — removing them would break the record of what was paid and by whom."
              : "It disappears from the catalogue and from every list, and no new enrolment can reference it. Existing payment records, receipts and attendance history are kept intact."}
          </p>

          {error ? (
            <div className="mt-4">
              <AlertBox title={`${name} was not archived`} tone="danger">
                <p>{error}</p>
              </AlertBox>
            </div>
          ) : null}

          {confirming ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold text-slate-900">Archive “{name}”?</p>
              <Button variant="danger" size="sm" onClick={archive} disabled={busy}>
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                {busy ? "Archiving…" : "Yes, archive it"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="mt-4 border-red-300 text-red-700 hover:bg-red-50" onClick={() => setConfirming(true)}>
              <Archive className="h-4 w-4" />
              Archive {kind}
            </Button>
          )}
        </div>
      </div>
    </Panel>
  );
}
