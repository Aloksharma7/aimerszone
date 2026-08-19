import Link from "next/link";
import { Bell, Megaphone } from "lucide-react";
import { EmptyState, PageHeader, Panel } from "@/components/ui";
import { getStudentNotifications } from "@/lib/data/student";

export default async function NotificationsPage() {
  const items = await getStudentNotifications();
  return (
    <>
      <PageHeader eyebrow="Updates" title="Notifications" description="Important class, payment, content and test updates in one place." />
      <Panel className="p-0" padded={false}>
        {items.length ? <div className="divide-y divide-slate-100">{items.map((item) => {
          const content = <><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">{item.pinned ? <Megaphone className="h-5 w-5" /> : <Bell className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="font-semibold text-slate-900">{item.title}</p>{!item.read ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600" /> : null}</div><p className="mt-1 text-sm leading-6 text-slate-600">{item.body}</p><p className="mt-2 text-xs text-slate-400">{item.course} · {item.date}</p></div></>;
          return item.href?.startsWith("/") ? <Link key={item.id} href={item.href} className={`flex gap-4 p-5 hover:bg-slate-50 ${!item.read ? "bg-blue-50/40" : ""}`}>{content}</Link> : <article key={item.id} className={`flex gap-4 p-5 ${!item.read ? "bg-blue-50/40" : ""}`}>{content}</article>;
        })}</div> : <div className="p-5"><EmptyState title="No notifications" description="New class, payment, recording and test updates will appear here." /></div>}
      </Panel>
    </>
  );
}
