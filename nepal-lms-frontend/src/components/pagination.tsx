import { ChevronLeft, ChevronRight } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import type { PageMeta } from "@/lib/api/contracts";

/**
 * Server-rendered pager for a list page. `buildHref` receives the target
 * page number and must return a full href that preserves the page's other
 * query params (search, status, etc.) — callers build it from the same
 * searchParams they already read for filtering.
 */
export function Pagination({ meta, buildHref }: { meta: PageMeta; buildHref: (page: number) => string }) {
  if (meta.lastPage <= 1) return null;

  const prevDisabled = meta.currentPage <= 1;
  const nextDisabled = meta.currentPage >= meta.lastPage;
  const from = meta.from ?? null;
  const to = meta.to ?? null;

  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-1 pt-4 sm:flex-row">
      <p className="text-xs text-slate-500">
        {from != null && to != null ? `Showing ${from}–${to} of ${meta.total}` : `${meta.total} total`} · Page {meta.currentPage} of {meta.lastPage}
      </p>
      <div className="flex gap-2">
        {prevDisabled ? (
          <span className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-300"><ChevronLeft className="h-4 w-4" />Previous</span>
        ) : (
          <ButtonLink href={buildHref(meta.currentPage - 1)} variant="outline" size="sm"><ChevronLeft className="h-4 w-4" />Previous</ButtonLink>
        )}
        {nextDisabled ? (
          <span className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-300">Next<ChevronRight className="h-4 w-4" /></span>
        ) : (
          <ButtonLink href={buildHref(meta.currentPage + 1)} variant="outline" size="sm">Next<ChevronRight className="h-4 w-4" /></ButtonLink>
        )}
      </div>
    </div>
  );
}
