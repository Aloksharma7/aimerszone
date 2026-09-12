import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EnrollmentActions } from "@/components/admin/enrollment-actions";
import { ButtonLink, PageHeader, Panel, ProgressBar, StatusBadge } from "@/components/ui";
import { getStaffEnrollment } from "@/lib/data/staff";
import { portalPath } from "@/lib/portal-path";

export default async function StaffEnrollmentDetailPage({ params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await params;
  const [enrollment, base, studentsBase, coursesBase, batchesBase] = await Promise.all([
    getStaffEnrollment(enrollmentId),
    portalPath("/staff/enrollments"),
    portalPath("/staff/students"),
    portalPath("/staff/courses"),
    portalPath("/staff/batches"),
  ]);
  if (!enrollment) notFound();

  return (
    <>
      <PageHeader
        back={{ href: base, label: "All enrollments" }}
        eyebrow="Enrollment record"
        title={enrollment.studentName}
        description={`${enrollment.courseTitle} · ${enrollment.batchTitle}`}
        actions={<><StatusBadge status={enrollment.status} /><ButtonLink href={base} variant="outline"><ArrowLeft className="h-4 w-4" />Enrollments</ButtonLink></>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_350px]">
        <div className="space-y-6">
          <Panel>
            <h2 className="text-xl font-bold text-slate-950">Student</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Name</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {enrollment.studentId ? <a href={`${studentsBase}/${encodeURIComponent(enrollment.studentId)}`} className="text-brand-700 hover:text-brand-900">{enrollment.studentName}</a> : enrollment.studentName}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Student code</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{enrollment.studentCode || "Not available"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Mobile</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{enrollment.studentMobile || "Not provided"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Email</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{enrollment.studentEmail || "Not provided"}</p>
              </div>
            </div>
          </Panel>

          <Panel>
            <h2 className="text-xl font-bold text-slate-950">Course and batch</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Course</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {enrollment.courseId ? <a href={`${coursesBase}/${encodeURIComponent(enrollment.courseId)}`} className="text-brand-700 hover:text-brand-900">{enrollment.courseTitle}</a> : enrollment.courseTitle}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Batch</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {enrollment.batchId ? <a href={`${batchesBase}/${encodeURIComponent(enrollment.batchId)}`} className="text-brand-700 hover:text-brand-900">{enrollment.batchTitle}</a> : enrollment.batchTitle}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Access window</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{enrollment.accessStartAt || "Not started"} – {enrollment.accessEndAt || "Open-ended"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Source</p>
                <p className="mt-2 text-sm font-semibold capitalize text-slate-900">{enrollment.source}</p>
              </div>
            </div>
            {enrollment.cancelledAt ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                <p className="font-semibold">Cancelled {enrollment.cancelledAt}</p>
                {enrollment.cancellationReason ? <p className="mt-1">{enrollment.cancellationReason}</p> : null}
              </div>
            ) : null}
          </Panel>

          <Panel>
            <h2 className="text-xl font-bold text-slate-950">Progress</h2>
            <div className="mt-5 space-y-4">
              <ProgressBar value={enrollment.overallPercent} label="Overall" />
              <ProgressBar value={enrollment.attendancePercent} label="Attendance" />
              <ProgressBar value={enrollment.recordingPercent} label="Recordings watched" />
              <ProgressBar value={enrollment.testPercent} label="Tests completed" />
            </div>
          </Panel>
        </div>

        <aside>
          <EnrollmentActions id={enrollment.id} studentName={enrollment.studentName} status={enrollment.status} hasPayment={enrollment.hasPayment} redirectTo={base} />
        </aside>
      </div>
    </>
  );
}
