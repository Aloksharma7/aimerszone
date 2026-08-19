import Link from "next/link";
import { ArrowRight, Bell, BookOpen, CalendarDays, CheckCircle2, ClipboardCheck, CreditCard, PlayCircle } from "lucide-react";
import { AnnouncementFeed, CompactTestCard, CourseProgressCard, LiveClassCard } from "@/components/portal-components";
import { ButtonLink, EmptyState, MetricCard, PageHeader, Panel, ProgressBar } from "@/components/ui";
import { getSessionUser } from "@/lib/auth/server";
import { getStudentDashboard } from "@/lib/data/student";

export default async function StudentDashboardPage() {
  const user = await getSessionUser("student");
  const data = await getStudentDashboard(user?.name || "Student");
  const recordingHref = data.continueRecording
    ? data.continueRecording.enrollmentId
      ? `/student/courses/${data.continueRecording.enrollmentId}/recordings/${data.continueRecording.id}`
      : `/student/recordings/${data.continueRecording.id}`
    : "/student/recordings";
  const nextClassHref = data.nextClass?.enrollmentId ? `/student/courses/${data.nextClass.enrollmentId}/live` : "/student/courses";

  return (
    <>
      <PageHeader
        eyebrow="Student workspace"
        title={`Welcome back, ${data.greetingName.split(" ")[0] || "Student"}`}
        description={data.nextClass ? `Your next class is ${data.nextClass.date} at ${data.nextClass.time}. Everything you need is below.` : "Continue your courses, recordings, tests and resources from one place."}
        actions={<ButtonLink href="/student/explore" variant="outline">Explore courses</ButtonLink>}
      />

      {data.nextClass ? (
        <LiveClassCard
          title={data.nextClass.title}
          course={data.nextClass.course}
          teacher={data.nextClass.teacher}
          time={`${data.nextClass.date} · ${data.nextClass.time}`}
          status={data.nextClass.status}
          href={nextClassHref}
        />
      ) : <EmptyState title="No class scheduled" description="Your upcoming live classes will appear here after a batch schedule is published." action={<ButtonLink href="/student/courses" variant="outline">Open my courses</ButtonLink>} />}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active courses" value={String(data.metrics.activeCourses)} detail="Current learning access" icon={BookOpen} tone="blue" />
        <MetricCard label="Attendance" value={`${data.metrics.attendancePercent}%`} detail="Across active batches" icon={CheckCircle2} tone="green" />
        <MetricCard label="Upcoming tests" value={String(data.metrics.upcomingTests)} detail="Available and scheduled" icon={ClipboardCheck} tone="violet" />
        <MetricCard label="Payment review" value={String(data.metrics.paymentsUnderReview)} detail="Submitted proofs under review" icon={CreditCard} tone="amber" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <Panel>
          {data.continueRecording ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-sm font-bold uppercase tracking-wider text-brand-700">Continue learning</p><h2 className="mt-2 text-xl font-bold text-slate-950">{data.continueRecording.title}</h2><p className="mt-1 text-sm text-slate-500">{data.continueRecording.course ? `${data.continueRecording.course} · ` : ""}{data.continueRecording.module}</p></div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><PlayCircle className="h-6 w-6" /></div>
              </div>
              <div className="mt-5"><ProgressBar value={data.continueRecording.progress} label={`${data.continueRecording.duration} class recording`} /></div>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row"><ButtonLink href={recordingHref}>Continue recording</ButtonLink><ButtonLink href="/student/recordings" variant="outline">All recordings</ButtonLink></div>
            </>
          ) : <EmptyState title="No recording in progress" description="Released recordings from your courses will appear in your recording library." action={<ButtonLink href="/student/recordings" variant="outline">Open recordings</ButtonLink>} />}
        </Panel>
        <Panel>
          <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-wider text-brand-700">Next class</p><h2 className="mt-2 text-lg font-bold text-slate-950">{data.nextClass?.title || "No upcoming class"}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{data.nextClass ? `${data.nextClass.course} · ${data.nextClass.date}, ${data.nextClass.time}` : "The schedule will update when your teacher publishes a class."}</p></div><CalendarDays className="h-6 w-6 text-brand-700" /></div>
          <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm"><p className="font-semibold text-slate-900">{data.nextClass?.joinState || "No joining action required"}</p><p className="mt-1 text-slate-500">Nepal Time (NPT)</p></div>
          <ButtonLink href={nextClassHref} variant="outline" className="mt-5 w-full">View schedule</ButtonLink>
        </Panel>
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-950">My active courses</h2><p className="mt-1 text-sm text-slate-500">Continue from your most useful next action.</p></div><Link href="/student/courses" className="hidden items-center gap-1 text-sm font-bold text-brand-700 sm:flex">View all<ArrowRight className="h-4 w-4" /></Link></div>
        {data.activeEnrollments.length ? <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">{data.activeEnrollments.map((enrollment) => <CourseProgressCard key={enrollment.id} enrollmentId={enrollment.id} course={enrollment.course} progress={enrollment.progress} nextAction={enrollment.nextAction} accessExpiry={enrollment.accessExpiry} />)}</div> : <EmptyState title="No active courses" description="Explore the catalogue to enroll in your first course." action={<ButtonLink href="/student/explore">Explore courses</ButtonLink>} />}
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <Panel>
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-bold text-slate-950">Upcoming tests</h2><p className="mt-1 text-sm text-slate-500">Available and scheduled assessments.</p></div><ClipboardCheck className="h-6 w-6 text-violet-700" /></div>
          {data.upcomingTests.length ? <div className="space-y-3">{data.upcomingTests.slice(0, 2).map((test) => <CompactTestCard key={test.id} test={test} href={test.status === "Available" ? `/student/tests/${test.id}` : "/student/tests"} />)}</div> : <p className="text-sm text-slate-500">No tests are currently scheduled.</p>}
          <Link href="/student/tests" className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-brand-700">View all tests<ArrowRight className="h-4 w-4" /></Link>
        </Panel>
        <Panel>
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-bold text-slate-950">Latest announcements</h2><p className="mt-1 text-sm text-slate-500">From your enrolled batches.</p></div><Bell className="h-6 w-6 text-brand-700" /></div>
          {data.announcements.length ? <AnnouncementFeed items={data.announcements} limit={2} /> : <p className="text-sm text-slate-500">No new announcements.</p>}
          <Link href="/student/notifications" className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-brand-700">All notifications<ArrowRight className="h-4 w-4" /></Link>
        </Panel>
      </div>
    </>
  );
}
