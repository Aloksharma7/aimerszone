import Link from "next/link";
import { AlertCircle, ArrowRight, BookOpen, CalendarDays, CheckSquare, PlayCircle, Users } from "lucide-react";
import { LiveClassCard } from "@/components/portal-components";
import { ButtonLink, MetricCard, PageHeader, Panel, ProgressBar, StatusBadge } from "@/components/ui";
import { getSessionUser } from "@/lib/auth/server";
import { getTeacherDashboard } from "@/lib/data/teacher";

export default async function TeacherDashboardPage() {
  const user = await getSessionUser("teacher");
  const data = await getTeacherDashboard(user?.name || "Teacher");
  const next = data.nextSession;
  return (
    <>
      <PageHeader eyebrow="Teacher workspace" title={`Good day, ${data.greetingName}`} description="Your assigned classes, attendance actions and content follow-up are visible below." actions={<ButtonLink href="/teacher/classes" variant="outline">View schedule</ButtonLink>} />
      {next ? <LiveClassCard title={next.title} course={`${next.course} · ${next.batch}`} teacher={`${next.students} enrolled students`} time={`${next.date} · ${next.time}`} href={`/teacher/classes/${next.id}`} teacherMode /> : <Panel><p className="font-semibold text-slate-900">No class is currently scheduled.</p><p className="mt-1 text-sm text-slate-500">New sessions will appear after Laravel returns an assigned schedule.</p></Panel>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Assigned batches" value={String(data.metrics.assignedBatches)} detail={`${data.metrics.ongoingBatches} ongoing · ${data.metrics.upcomingBatches} upcoming`} icon={BookOpen} tone="blue" />
        <MetricCard label="Today's classes" value={String(data.metrics.classesToday)} detail="Assigned sessions in Nepal Time" icon={CalendarDays} tone="violet" />
        <MetricCard label="Attendance action" value={String(data.metrics.attendanceActions)} detail="Sessions awaiting finalization" icon={CheckSquare} tone="amber" />
        <MetricCard label="Active students" value={String(data.metrics.activeStudents)} detail="Across assigned batches" icon={Users} tone="green" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <Panel>
          <div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-950">Today&apos;s schedule</h2><p className="mt-1 text-sm text-slate-500">Start classes and complete required follow-up.</p></div><CalendarDays className="h-6 w-6 text-brand-700" /></div>
          <div className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {data.todaySessions.length ? data.todaySessions.map((session) => (
              <div key={session.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${session.status === "Live now" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>{session.status === "Live now" ? <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-green-600" /></span> : <CheckSquare className="h-5 w-5" />}</div>
                <div className="flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-950">{session.title}</p><StatusBadge status={session.status} /></div><p className="mt-1 text-sm text-slate-500">{session.course} · {session.time}</p></div>
                <ButtonLink href={`/teacher/classes/${session.id}`} variant={session.status === "Live now" ? "primary" : "outline"} size="sm">{session.status === "Live now" ? "Open class" : "View session"}</ButtonLink>
              </div>
            )) : <p className="p-5 text-sm text-slate-500">No sessions today.</p>}
          </div>
        </Panel>
        <Panel>
          <div className="flex items-center gap-3"><AlertCircle className="h-6 w-6 text-amber-600" /><div><h2 className="text-xl font-bold text-slate-950">Follow-up needed</h2><p className="mt-1 text-sm text-slate-500">Complete these after class.</p></div></div>
          <div className="mt-5 space-y-3">
            {data.followUps.length ? data.followUps.map((item) => (
              <Link key={item.id} href={item.href} className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 hover:bg-slate-50">
                {item.type === "recording" ? <PlayCircle className="h-5 w-5 text-brand-700" /> : <CheckSquare className="h-5 w-5 text-amber-600" />}
                <div className="flex-1"><p className="text-sm font-semibold text-slate-900">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.detail}</p></div><ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
            )) : <p className="text-sm text-slate-500">No pending actions.</p>}
          </div>
        </Panel>
      </div>
      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between"><div><h2 className="text-xl font-bold text-slate-950">Assigned batches</h2><p className="mt-1 text-sm text-slate-500">Academic progress for batches you are permitted to manage.</p></div><Link href="/teacher/batches" className="hidden items-center gap-1 text-sm font-bold text-brand-700 sm:flex">View all<ArrowRight className="h-4 w-4" /></Link></div>
        <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">{data.batches.map((batch) => <Panel key={batch.id}><div className="flex items-start justify-between gap-3"><StatusBadge status={batch.status} /><span className="text-sm font-bold text-slate-500">{batch.students} students</span></div><h3 className="mt-4 text-lg font-bold text-slate-950">{batch.course}</h3><p className="mt-1 text-sm text-brand-700">{batch.batch}</p><p className="mt-3 text-sm text-slate-500">{batch.schedule}</p><div className="mt-5"><ProgressBar value={batch.progress} label="Syllabus coverage" /></div><div className="mt-5 flex items-center justify-between"><p className="text-xs text-slate-500">{batch.nextClass}</p><Link href={`/teacher/batches/${batch.id}`} className="text-sm font-bold text-brand-700">Open batch →</Link></div></Panel>)}</div>
      </section>
    </>
  );
}
