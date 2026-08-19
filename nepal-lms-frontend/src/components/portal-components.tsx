import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  Megaphone,
  MonitorPlay,
  PlayCircle,
  Radio,
  UserRound,
} from "lucide-react";
import { Badge, ButtonLink, Panel, ProgressBar, StatusBadge } from "@/components/ui";
import type { Course } from "@/types/lms";
import { cn } from "@/lib/utils";

export function LiveClassCard({
  title,
  course,
  teacher,
  time,
  status = "Live now",
  href,
  teacherMode = false,
}: {
  title: string;
  course: string;
  teacher: string;
  time: string;
  status?: string;
  href: string;
  teacherMode?: boolean;
}) {
  const live = status.toLowerCase().includes("live");
  return (
    <Panel className={cn("relative overflow-hidden border-0 text-white", live ? "bg-brand-900" : "bg-slate-900")}>
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-500/20" />
      <div className="pointer-events-none absolute -bottom-24 right-20 h-48 w-48 rounded-full bg-white/5" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold ring-1 ring-inset ring-white/15">
            {live ? <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-300 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-red-400" /></span> : <CalendarClock className="h-3.5 w-3.5" />}
            {status}
          </span>
          <span className="text-xs font-semibold text-blue-100">Nepal Time (NPT)</span>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-sm font-semibold text-blue-200">{course}</p>
            <h2 className="mt-2 max-w-2xl text-2xl font-bold leading-tight sm:text-3xl">{title}</h2>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-blue-100">
              <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4" />{time}</span>
              <span className="inline-flex items-center gap-2"><UserRound className="h-4 w-4" />{teacher}</span>
            </div>
          </div>
          <ButtonLink href={href} size="lg" className="w-full border-white bg-white text-brand-900 hover:bg-blue-50 lg:w-auto">
            {teacherMode ? <Radio className="h-5 w-5" /> : <MonitorPlay className="h-5 w-5" />}
            {teacherMode ? "Start class" : "Join class"}
          </ButtonLink>
        </div>
      </div>
    </Panel>
  );
}

export function CourseProgressCard({
  enrollmentId,
  course,
  progress,
  nextAction,
  accessExpiry,
}: {
  enrollmentId: string;
  course: Course;
  progress: number;
  nextAction: string;
  accessExpiry: string;
}) {
  return (
    <Panel className="flex h-full flex-col p-0" padded={false}>
      <div className="border-b border-slate-100 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge tone="blue">{course.batch}</Badge>
            <h3 className="mt-3 text-lg font-bold leading-7 text-slate-950">{course.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{course.teacher}</p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <BookOpen className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-5"><ProgressBar value={progress} label="Overall progress" /></div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Next action</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{nextAction}</p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <p className="text-xs text-slate-500">Access until {accessExpiry}</p>
          <Link href={`/student/courses/${enrollmentId}`} className="inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:text-brand-900">Open course<ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>
    </Panel>
  );
}

export function CompactTestCard({ test, href = "/student/tests" }: { test: { title: string; course: string; duration: string; marks: string; status: string; availability: string }; href?: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><FileText className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{test.title}</h3><StatusBadge status={test.status} /></div>
        <p className="mt-1 text-sm text-slate-500">{test.course}</p>
        <p className="mt-2 text-xs text-slate-500">{test.duration} · {test.marks} · {test.availability}</p>
      </div>
      <ButtonLink href={href} variant={test.status === "Available" ? "primary" : "outline"} size="sm" className="w-full sm:w-auto">
        {test.status === "Available" ? "Start test" : test.status === "Completed" ? "View result" : "View details"}
      </ButtonLink>
    </div>
  );
}

export function AnnouncementFeed({ items, limit }: { items: { id: string; title: string; body: string; course: string; date: string; pinned: boolean }[]; limit?: number }) {
  const visible = typeof limit === "number" ? items.slice(0, limit) : items;
  return (
    <div className="divide-y divide-slate-100">
      {visible.map((item) => (
        <article key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", item.pinned ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700")}>
            <Megaphone className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{item.title}</h3>{item.pinned ? <Badge tone="amber">Pinned</Badge> : null}</div>
            <p className="mt-1 text-sm leading-6 text-slate-600">{item.body}</p>
            <p className="mt-2 text-xs text-slate-400">{item.course} · {item.date}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

export function RecordingRow({ recording, href, showCourse = false }: { recording: { title: string; course?: string; module: string; date: string; teacher: string; duration: string; progress: number; state: string }; href: string; showCourse?: boolean }) {
  return (
    <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white"><PlayCircle className="h-6 w-6" /></div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{recording.title}</h3><StatusBadge status={recording.state} /></div>
        <p className="mt-1 text-sm text-slate-500">{showCourse && recording.course ? `${recording.course} · ` : ""}{recording.module}</p>
        <p className="mt-2 text-xs text-slate-500">{recording.date} · {recording.teacher} · {recording.duration}</p>
        {recording.progress > 0 && recording.progress < 100 ? <div className="mt-3 max-w-sm"><ProgressBar value={recording.progress} compact showValue={false} /></div> : null}
      </div>
      <ButtonLink href={href} variant={recording.progress > 0 ? "primary" : "outline"} size="sm" className="w-full sm:w-auto">
        {recording.progress > 0 && recording.progress < 100 ? "Continue watching" : recording.progress === 100 ? "Watch again" : "Start recording"}
      </ButtonLink>
    </div>
  );
}

export function ResourceRow({ item, href }: { item: { title: string; module: string; type: string; size: string; released: string }; href?: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700"><FileText className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-slate-900">{item.title}</h3>
        <p className="mt-1 text-sm text-slate-500">{item.module} · {item.type} · {item.size} · Released {item.released}</p>
      </div>
      {href ? <ButtonLink href={href} variant="outline" size="sm">Open resource</ButtonLink> : <span className="text-xs font-semibold text-slate-500">Download authorization required</span>}
    </div>
  );
}

export function DataTable({
  columns,
  rows,
  rowKey,
  actions = false,
}: {
  columns: { key: string; label: string; render?: (row: Record<string, unknown>) => React.ReactNode }[];
  rows: Record<string, unknown>[];
  rowKey: string;
  actions?: boolean;
}) {
  const showActions = actions && rows.some((row) => typeof row.href === "string" && String(row.href).startsWith("/"));
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="soft-scrollbar overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              {columns.map((column) => <th key={column.key} className="border-b border-slate-200 px-4 py-3 font-bold">{column.label}</th>)}
              {showActions ? <th className="border-b border-slate-200 px-4 py-3 text-right font-bold">Actions</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={String(row[rowKey])} className="hover:bg-slate-50/70">
                {columns.map((column) => <td key={column.key} className="px-4 py-3.5 align-middle text-slate-700">{column.render ? column.render(row) : String(row[column.key] ?? "—")}</td>)}
                {showActions ? <td className="px-4 py-3.5 text-right">{typeof row.href === "string" && row.href.startsWith("/") ? <ButtonLink href={row.href} variant="outline" size="sm">Open</ButtonLink> : null}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">Showing {rows.length} record{rows.length === 1 ? "" : "s"}.</div>
    </div>
  );
}

export function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-slate-700"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />{item}</li>)}
    </ul>
  );
}
