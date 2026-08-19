import { notFound } from "next/navigation";
import { CalendarCheck, CircleSlash, Clock3, UserCheck } from "lucide-react";
import { CourseWorkspaceHeader } from "@/components/course-workspace";
import { EmptyState, MetricCard, Panel, StatusBadge } from "@/components/ui";
import { getStudentAttendance, getStudentEnrollment } from "@/lib/data/student";

/**
 * Attendance, from the student's side.
 *
 * Only finalised registers appear. A class the teacher has not closed yet is
 * not "absent", and showing it as one would have students disputing marks
 * nobody has made.
 */
export default async function StudentAttendancePage({ params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await params;
  const enrollment = await getStudentEnrollment(enrollmentId);
  if (!enrollment) notFound();
  const attendance = await getStudentAttendance(enrollment.id);

  return (
    <>
      <CourseWorkspaceHeader enrollmentId={enrollment.id} course={enrollment.course} progress={enrollment.progress} accessExpiry={enrollment.accessExpiry} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Attendance" value={`${attendance.metrics.attendancePercent}%`} detail={`${attendance.metrics.finalizedClasses} classes counted`} icon={CalendarCheck} tone={attendance.metrics.attendancePercent >= 75 ? "green" : "amber"} />
        <MetricCard label="Present" value={String(attendance.metrics.present)} icon={UserCheck} tone="green" />
        <MetricCard label="Late" value={String(attendance.metrics.late)} icon={Clock3} tone="amber" />
        <MetricCard label="Absent" value={String(attendance.metrics.absent)} icon={CircleSlash} tone={attendance.metrics.absent > 0 ? "red" : "slate"} />
      </div>

      <Panel className="mt-6">
        <h1 className="text-xl font-bold text-slate-950">Class register</h1>
        <p className="mt-1 text-sm text-slate-500">
          Only classes your teacher has finalised are counted. If something here looks wrong, raise it from Support with the class date.
        </p>
        <div className="mt-5">
          {attendance.items.length ? (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {attendance.items.map((row) => (
                <div key={row.sessionId} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-slate-900">{row.topic}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {row.date}
                      {row.minutesAttended > 0 ? ` · ${row.minutesAttended} min` : ""}
                    </p>
                    {row.note ? <p className="mt-1 text-sm text-slate-600">{row.note}</p> : null}
                  </div>
                  <StatusBadge status={row.status} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No finalised classes yet" description="Your attendance appears here once a teacher closes the register for a class." />
          )}
        </div>
      </Panel>
    </>
  );
}
