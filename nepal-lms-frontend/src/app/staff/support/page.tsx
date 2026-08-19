import { Clock3, Inbox, MessageSquare, TimerReset } from "lucide-react";
import Link from "next/link";
import { ListFilters } from "@/components/list-filters";
import { EmptyState, MetricCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { getSupportInbox } from "@/lib/data/support-inbox";
import { firstParam, searchTerm, type PageSearchParams } from "@/lib/search-params";
import { portalPath } from "@/lib/portal-path";

export default async function SupportInboxPage({ searchParams }: { searchParams: PageSearchParams }) {
  const raw = await searchParams;
  const search = searchTerm(raw);
  const status = firstParam(raw.status);
  const inbox = await getSupportInbox({ search, status });
  const base = await portalPath("/staff/support");

  return (
    <>
      <PageHeader
        eyebrow="Support"
        title="Support inbox"
        description="Every request a student has raised. Oldest waiting first, so nothing sits unanswered."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Open" value={String(inbox.metrics.open)} detail="Waiting on us" icon={Inbox} tone="amber" />
        <MetricCard label="Waiting on student" value={String(inbox.metrics.pending)} detail="Replied, no answer yet" icon={Clock3} tone="blue" />
        <MetricCard label="Resolved this month" value={String(inbox.metrics.resolvedMonth)} icon={MessageSquare} tone="green" />
        <MetricCard label="Older than 2 days" value={String(inbox.metrics.waitingOver2Days)} detail="Needs attention" icon={TimerReset} tone={inbox.metrics.waitingOver2Days > 0 ? "red" : "slate"} />
      </div>

      <Panel className="mt-6">
        <ListFilters
          searchValue={search}
          searchPlaceholder="Reference, subject, student or message"
          resetHref={base}
          fields={[
            {
              name: "status",
              label: "Status",
              value: status,
              options: [
                { value: "", label: "All statuses" },
                { value: "open", label: "Open" },
                { value: "pending", label: "Waiting on student" },
                { value: "resolved", label: "Resolved" },
                { value: "closed", label: "Closed" },
              ],
            },
          ]}
        />
        <div className="mt-5">
          {inbox.items.length ? (
            <div className="divide-y divide-slate-100">
              {inbox.items.map((ticket) => (
                <Link key={ticket.id} href={`${base}/${ticket.id}`} className="grid gap-2 py-4 transition hover:bg-slate-50 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-slate-950">{ticket.subject}</h2>
                      <StatusBadge status={ticket.status} />
                      {ticket.messageCount === 0 ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">No reply yet</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {ticket.reference} · {ticket.studentName} · {ticket.category}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-sm text-slate-500">Updated {ticket.updatedAt}</p>
                    <p className="mt-1 text-xs font-semibold text-brand-700">Open thread →</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="Nothing waiting" description="Support requests raised by students appear here." />
          )}
        </div>
      </Panel>
    </>
  );
}
