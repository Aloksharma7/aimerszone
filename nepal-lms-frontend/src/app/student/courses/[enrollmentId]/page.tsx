import { notFound } from "next/navigation";
import { CalendarDays, Clock3, PlayCircle, UserRound } from "lucide-react";
import { CourseWorkspaceHeader } from "@/components/course-workspace";
import { AnnouncementFeed, LiveClassCard } from "@/components/portal-components";
import { ButtonLink, EmptyState, Panel, ProgressBar } from "@/components/ui";
import { getStudentAnnouncements, getStudentClasses, getStudentEnrollment, getStudentRecordings } from "@/lib/data/student";

export default async function CourseOverviewPage({ params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await params;
  const enrollment = await getStudentEnrollment(enrollmentId);
  if (!enrollment) notFound();
  const [classes, announcements, recordings] = await Promise.all([
    getStudentClasses(enrollment.id),
    getStudentAnnouncements(enrollment.id),
    getStudentRecordings(enrollment.id),
  ]);
  const nextClass = classes.find((item) => item.status === "Live now") || classes.find((item) => item.status === "Upcoming") || null;
  const continueRecording = recordings.find((item) => item.progress > 0 && item.progress < 100) || recordings[0] || null;

  return (
    <>
      <CourseWorkspaceHeader enrollmentId={enrollment.id} course={enrollment.course} progress={enrollment.progress} accessExpiry={enrollment.accessExpiry} />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <div className="space-y-6">
          {nextClass ? <LiveClassCard title={nextClass.title} course={nextClass.course || enrollment.course.title} teacher={nextClass.teacher} time={`${nextClass.date} · ${nextClass.time}`} status={nextClass.status} href={`/student/courses/${enrollment.id}/live`} sessionId={nextClass.id} joinAvailable={nextClass.joinAvailable} /> : <EmptyState title="No upcoming class" description="Published class sessions for this batch will appear here." action={<ButtonLink href={`/student/courses/${enrollment.id}/live`} variant="outline">View class schedule</ButtonLink>} />}
          <Panel>
            {continueRecording ? <><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-wider text-brand-700">Continue learning</p><h2 className="mt-2 text-xl font-bold text-slate-950">{continueRecording.title}</h2><p className="mt-1 text-sm text-slate-500">{continueRecording.module} · {continueRecording.duration}</p></div><PlayCircle className="h-7 w-7 text-brand-700" /></div><div className="mt-5"><ProgressBar value={continueRecording.progress} label="Recording progress" /></div><ButtonLink href={`/student/courses/${enrollment.id}/recordings/${continueRecording.id}`} className="mt-5">{continueRecording.progress > 0 ? "Continue recording" : "Start recording"}</ButtonLink></> : <EmptyState title="No recordings released" description="Your teacher’s released recordings will appear here." action={<ButtonLink href={`/student/courses/${enrollment.id}/recordings`} variant="outline">Open recordings</ButtonLink>} />}
          </Panel>
          <Panel><h2 className="text-xl font-bold text-slate-950">Latest announcement</h2><div className="mt-4">{announcements.length ? <AnnouncementFeed items={announcements.slice(0, 1)} /> : <p className="text-sm text-slate-500">No announcements have been posted for this batch.</p>}</div></Panel>
        </div>
        <aside className="space-y-5">
          <Panel><h2 className="text-lg font-bold text-slate-950">Batch details</h2><dl className="mt-5 space-y-4 text-sm"><div className="flex gap-3"><UserRound className="h-5 w-5 text-brand-700" /><div><dt className="text-slate-500">Teacher</dt><dd className="mt-1 font-semibold text-slate-900">{enrollment.course.teacher}</dd></div></div><div className="flex gap-3"><CalendarDays className="h-5 w-5 text-brand-700" /><div><dt className="text-slate-500">Schedule</dt><dd className="mt-1 font-semibold text-slate-900">{enrollment.course.schedule}</dd></div></div><div className="flex gap-3"><Clock3 className="h-5 w-5 text-brand-700" /><div><dt className="text-slate-500">Access until</dt><dd className="mt-1 font-semibold text-slate-900">{enrollment.accessExpiry}</dd></div></div></dl></Panel>
          <Panel><h2 className="text-lg font-bold text-slate-950">Learning progress</h2><div className="mt-5 space-y-5"><ProgressBar label="Attendance" value={enrollment.attendance} /><ProgressBar label="Recordings" value={enrollment.recordings} /><ProgressBar label="Tests" value={enrollment.tests} /><ProgressBar label="Syllabus" value={enrollment.syllabus} /></div></Panel>
        </aside>
      </div>
    </>
  );
}
