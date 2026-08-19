import Link from "next/link";
import { Bell } from "lucide-react";
import { EmptyState, Panel } from "@/components/ui";
import type { WorkItemNotification } from "@/lib/data/notifications";

/**
 * The expandable "all notifications" page for teacher/staff/admin — the
 * same outstanding-work items the bell dropdown shows a preview of, all
 * always unread since each one represents something not yet done rather
 * than a message to dismiss.
 */
export function NotificationFeed({ items, emptyDescription }: { items: WorkItemNotification[]; emptyDescription: string }) {
  if (!items.length) {
    return (
      <Panel>
        <EmptyState title="Nothing outstanding" description={emptyDescription} />
      </Panel>
    );
  }

  return (
    <Panel className="p-0" padded={false}>
      <div className="divide-y divide-slate-100">
        {items.map((item) => {
          const content = (
            <>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Bell className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{item.title}</p>
                {item.summary ? <p className="mt-1 text-sm leading-6 text-slate-600">{item.summary}</p> : null}
                {item.publishedAt ? <p className="mt-2 text-xs text-slate-400">{item.publishedAt}</p> : null}
              </div>
            </>
          );
          return item.href?.startsWith("/") ? (
            <Link key={item.id} href={item.href} className="flex gap-4 bg-blue-50/40 p-5 hover:bg-blue-50">{content}</Link>
          ) : (
            <article key={item.id} className="flex gap-4 bg-blue-50/40 p-5">{content}</article>
          );
        })}
      </div>
    </Panel>
  );
}
