import { notFound } from "next/navigation";
import { CalendarDays, Clock3, Info, UserRound } from "lucide-react";
import { CourseWorkspaceHeader } from "@/components/course-workspace";
import { JoinClassButton } from "@/components/student/secure-learning-actions";
import { Badge, EmptyState, Panel, StatusBadge } from "@/components/ui";
import { getStudentClasses, getStudentEnrollment } from "@/lib/data/student";

export default async function LivePage({ params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await params;
  const enrollment = await getStudentEnrollment(enrollmentId);
  if (!enrollment) notFound();
  const sessions = await getStudentClasses(enrollment.id);
  const primary = sessions.find((item) => item.status === "Live now") || sessions.find((item) => item.status === "Upcoming") || null;
  const upcoming = sessions.filter((item) => item.id !== primary?.id && ["Upcoming", "Rescheduled"].includes(item.status));
  const history = sessions.filter((item) => ["Completed", "Cancelled"].includes(item.status));

  return (
    <>
      <CourseWorkspaceHeader enrollmentId={enrollment.id} course={enrollment.course} progress={enrollment.progress} accessExpiry={enrollment.accessExpiry} />
      <div className="space-y-6">
        {primary ? <Panel className="overflow-hidden border-0 bg-brand-900 text-white"><div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><Badge tone={primary.status === "Live now" ? "green" : "blue"} className="bg-white/10 text-white ring-white/10">{primary.status}</Badge><h1 className="mt-4 text-2xl font-bold sm:text-3xl">{primary.title}</h1><div className="mt-4 flex flex-wrap gap-4 text-sm text-blue-100"><span className="flex items-center gap-2"><Clock3 className="h-4 w-4" />{primary.date} · {primary.time} NPT</span><span className="flex items-center gap-2"><UserRound className="h-4 w-4" />{primary.teacher}</span></div></div><JoinClassButton sessionId={primary.id} disabled={!primary.joinAvailable} label={primary.joinAvailable ? "Join class" : primary.joinState} /></div></Panel> : <EmptyState title="No class scheduled" description="The teacher or administrator has not published a class session for this batch." />}
        <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900"><Info className="mt-0.5 h-5 w-5 shrink-0" />Clicking Join securely checks your enrollment, access and the class timing on the server before taking you to the meeting.</div>
        <section><h2 className="text-xl font-bold text-slate-950">Upcoming classes</h2>{upcoming.length ? <div className="mt-4 grid gap-4 lg:grid-cols-2">{upcoming.map((session) => <Panel key={session.id}><div className="flex items-start justify-between gap-4"><StatusBadge status={session.status} /><CalendarDays className="h-5 w-5 text-brand-700" /></div><h3 className="mt-4 text-lg font-bold text-slate-950">{session.title}</h3><p className="mt-2 text-sm text-slate-500">{session.date} · {session.time}</p><p className="mt-1 text-sm text-slate-500">{session.teacher}</p><div className="mt-5"><JoinClassButton sessionId={session.id} disabled={!session.joinAvailable} label={session.joinState} /></div></Panel>)}</div> : <p className="mt-3 text-sm text-slate-500">No additional upcoming classes.</p>}</section>
        <section><h2 className="text-xl font-bold text-slate-950">Completed and changed sessions</h2>{history.length ? <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="divide-y divide-slate-100">{history.map((session) => <div key={session.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="flex-1"><p className="font-semibold text-slate-900">{session.title}</p><p className="mt-1 text-sm text-slate-500">{session.date} · {session.time} · {session.teacher}</p></div><StatusBadge status={session.status} /></div>)}</div></div> : <p className="mt-3 text-sm text-slate-500">No completed or cancelled sessions yet.</p>}</section>
      </div>
    </>
  );
}
