/**
 * Route-transition placeholder for the portal shells.
 *
 * The shell (nav, header) stays mounted across a navigation — only this
 * fills the content area while the next page's data loads — so a click
 * gets an immediate response instead of a frozen screen until the fetch
 * resolves.
 */
export function PortalLoadingSkeleton() {
  return (
    <div className="animate-pulse" role="status" aria-label="Loading">
      <div className="h-4 w-40 rounded bg-slate-200" />
      <div className="mt-3 h-8 w-72 max-w-full rounded bg-slate-200" />
      <div className="mt-2 h-4 w-96 max-w-full rounded bg-slate-100" />

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <div key={key} className="h-24 rounded-2xl border border-slate-200 bg-slate-50" />
        ))}
      </div>

      <div className="mt-6 h-72 rounded-2xl border border-slate-200 bg-slate-50" />
    </div>
  );
}
