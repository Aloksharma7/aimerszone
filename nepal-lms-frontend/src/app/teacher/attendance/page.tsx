import { AlertCircle, CheckCircle2, Clock3, Users } from "lucide-react";
import { ButtonLink, MetricCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { getTeacherAttendanceOverview } from "@/lib/data/teacher";
import { portalPath } from "@/lib/portal-path";

export default async function TeacherAttendancePage() {
  const data = await getTeacherAttendanceOverview();
  const classesBase = await portalPath("/teacher/classes");
  return <><PageHeader eyebrow="Academic records" title="Attendance" description="Review Zoom participation, LMS join events and enrolled students before finalizing." /><div className="grid gap-4 sm:grid-cols-3"><MetricCard label="Awaiting review" value={String(data.metrics.awaiting)} icon={AlertCircle} tone="amber" /><MetricCard label="Finalized this week" value={String(data.metrics.finalizedThisWeek)} icon={CheckCircle2} tone="green" /><MetricCard label="Assigned students" value={String(data.metrics.assignedStudents)} icon={Users} tone="blue" /></div><Panel className="mt-6"><h2 className="text-xl font-bold text-slate-950">Recent sessions</h2><div className="mt-5 space-y-3">{data.sessions.map((session) => <div key={session.id} className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Clock3 className="h-5 w-5" /></div><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-950">{session.title}</h3><StatusBadge status={session.status} /></div><p className="mt-1 text-sm text-slate-500">{session.batch} · {session.date} · {session.students} students</p></div><ButtonLink href={`${classesBase}/${session.id}/attendance`} variant={session.status.includes("Awaiting") ? "primary" : "outline"} size="sm">{session.status.includes("Awaiting") ? "Review attendance" : "View record"}</ButtonLink></div>)}</div></Panel></>;
}
