import Link from "next/link";
import { Clock3, Lock } from "lucide-react";
import { CourseProgressCard } from "@/components/portal-components";
import { Badge, ButtonLink, EmptyState, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { getStudentEnrollments, getStudentPayments } from "@/lib/data/student";
import { formatNpr } from "@/lib/utils";

export default async function StudentCoursesPage() {
  const [enrollments, payments] = await Promise.all([getStudentEnrollments(), getStudentPayments()]);

  /*
   * A payment under review produces no enrolment yet, so without this the
   * student saw "No active courses" straight after paying — no trace of the
   * money anywhere on the page they would naturally check first.
   */
  const awaiting = payments.filter((payment) => ["Under review", "Submitted"].includes(payment.status));

  /*
   * A pending course is shown as a course, locked — not as an absence.
   *
   * It used to render "No active courses" with the payment mentioned in a
   * separate panel further down, so the first thing a student saw after paying
   * was the platform telling them they had nothing. Whatever the panel said
   * underneath, that reads as the money having vanished.
   */
  const pendingCourses = awaiting.map((payment) => ({
    id: payment.id,
    course: payment.course,
    batch: payment.batch,
    amount: payment.amount,
    submitted: payment.submitted,
  }));
  const active = enrollments.filter((item) => !item.status || item.status === "active");
  const completed = enrollments.filter((item) => item.progress >= 100 && item.status !== "expired");
  const expired = enrollments.filter((item) => item.status === "expired");
  return (
    <>
      <PageHeader eyebrow="My learning" title="My Courses" description="Open active batches, review completed learning and understand expired access." actions={<ButtonLink href="/student/explore">Explore more courses</ButtonLink>} />
      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto"><span className="rounded-full bg-brand-900 px-4 py-2 text-sm font-semibold text-white">Active · {active.length}</span><span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">Completed · {completed.length}</span><span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">Expired · {expired.length}</span></div>
      {pendingCourses.length ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {pendingCourses.map((pending) => (
            <Panel key={pending.id} className="border-amber-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-bold text-slate-950">{pending.course}</h2>
                  <p className="mt-1 text-sm text-slate-500">{pending.batch}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                  <Lock className="h-3.5 w-3.5" />
                  Awaiting approval
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                You paid {formatNpr(pending.amount)} on {pending.submitted}. Classes, recordings and notes open here as soon as the payment is
                approved — usually within a working day. Nothing else is needed from you.
              </p>
              <Link href={`/student/payments/${pending.id}`} className="mt-4 inline-flex text-sm font-semibold text-brand-700 hover:underline">
                View payment record →
              </Link>
            </Panel>
          ))}
        </div>
      ) : null}
      {active.length ? <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">{active.map((item) => <CourseProgressCard key={item.id} enrollmentId={item.id} course={item.course} progress={item.progress} nextAction={item.nextAction} accessExpiry={item.accessExpiry} />)}</div> : <EmptyState title="No active courses yet" description={awaiting.length ? "Nothing is unlocked yet. Your paid course is shown above and opens as soon as the payment is approved." : "Your active enrollments will appear here after free enrollment or payment approval."} action={awaiting.length ? <ButtonLink href="/student/payments" variant="outline">View payment history</ButtonLink> : <ButtonLink href="/student/explore">Explore courses</ButtonLink>} />}
            {expired.map((item) => <Panel key={item.id} className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Clock3 className="h-5 w-5" /></div><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-slate-950">{item.course.title}</h2><Badge tone="slate">Expired</Badge></div><p className="mt-1 text-sm text-slate-500">Access ended {item.accessExpiry}</p></div><ButtonLink href="/student/support" variant="outline">Ask about access</ButtonLink></Panel>)}
    </>
  );
}
