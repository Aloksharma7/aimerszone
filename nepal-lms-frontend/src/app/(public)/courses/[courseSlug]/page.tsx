import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, FileText, MonitorPlay, PlayCircle, ShieldCheck, UserRound } from "lucide-react";
import { CourseCard } from "@/components/course-card";
import { Badge, ButtonLink, Panel, SectionHeading, StatusBadge } from "@/components/ui";
import { getSessionUser } from "@/lib/auth/server";
import { getPublicCourse, getPublicCourses } from "@/lib/data/public";
import { formatNpr } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ courseSlug: string }> }): Promise<Metadata> {
  const { courseSlug } = await params;
  const course = await getPublicCourse(courseSlug);
  return course ? { title: course.title, description: course.description } : { title: "Course not found" };
}

export default async function CourseDetailPage({ params }: { params: Promise<{ courseSlug: string }> }) {
  const { courseSlug } = await params;

  // A signed-in student is sent to the batch page rather than the sign-up form,
  // which the guest guard would only bounce back to their dashboard.
  const [viewer, course, courses] = await Promise.all([getSessionUser(), getPublicCourse(courseSlug), getPublicCourses()]);
  const isStudent = Boolean(viewer?.roles.includes("student"));
  if (!course) notFound();
  const related = courses.filter((item) => item.slug !== course.slug && item.category === course.category).slice(0, 3);
  const featureDetails = [
    { icon: MonitorPlay, label: "Live classes", detail: course.features.includes("Live") ? "Scheduled Zoom classes with one clear join action." : "Not included in this course." },
    { icon: PlayCircle, label: "Recordings", detail: course.features.includes("Recordings") ? "Released class recordings available during access." : "Not included in this course." },
    { icon: FileText, label: "Tests and notes", detail: "Focused practice, released results and module resources." },
    { icon: ShieldCheck, label: "Human support", detail: "Enrollment and account support through phone or WhatsApp." },
  ];

  return (
    <>
      <section className="border-b border-slate-200 bg-canvas py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Link href="/courses" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-brand-700"><ArrowLeft className="h-4 w-4" />Back to courses</Link>
          <div className="mt-6 grid gap-8 lg:grid-cols-[1.08fr_.92fr] lg:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2"><Badge tone="blue">{course.category}</Badge>{course.isFree ? <Badge tone="green">Free learning</Badge> : <StatusBadge status={course.status} />}</div>
              <h1 className="mt-5 text-balance text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">{course.title}</h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">{course.description}</p>
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-600">
                <span className="flex items-center gap-2"><UserRound className="h-4 w-4 text-brand-700" />{course.teacher}</span>
                <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-brand-700" />{course.startDate}</span>
                <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-brand-700" />{course.access}</span>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
              <div className="relative aspect-[16/9]"><Image src={course.image} alt="" fill className="object-cover" priority /></div>
              <div className="p-5 sm:p-6">
                <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold text-slate-500">Current batch price</p>{course.isFree ? <p className="mt-1 text-3xl font-bold text-green-700">Free</p> : <div className="mt-1 flex items-end gap-2"><p className="text-3xl font-bold text-slate-950">{formatNpr(course.price)}</p>{course.originalPrice ? <p className="pb-1 text-sm text-slate-400 line-through">{formatNpr(course.originalPrice)}</p> : null}</div>}</div><Badge tone={course.seats?.includes("Limited") ? "amber" : "green"}>{course.seats || "Open"}</Badge></div>
                {/*
                  * Every enrollable batch, not just the first.
                  *
                  * This panel used to render course.batch / course.schedule —
                  * the flattened batches[0] — so a course with a morning and an
                  * evening batch offered only one of them, and the other was
                  * unreachable and unbuyable from anywhere on the public site.
                  */}
                {course.batches.length ? (
                  <div className="mt-5 space-y-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {course.batches.length === 1 ? "Available batch" : `${course.batches.length} batches available`}
                    </p>
                    {course.batches.map((option) => (
                      <div key={option.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-bold text-slate-900">{option.title}</p>
                          {course.isFree ? null : <p className="font-bold text-slate-900">{formatNpr(option.priceNpr)}</p>}
                        </div>
                        <p className="mt-2 text-slate-600">{option.schedule}</p>
                        <p className="mt-1 text-slate-600">Starts {option.startDate}</p>
                        {option.teacherNames.length ? <p className="mt-1 text-slate-500">Taught by {option.teacherNames.join(", ")}</p> : null}
                        <ButtonLink href={course.isFree && !isStudent ? "/register" : `/batches/${option.id}`} className="mt-4 w-full">
                          {course.isFree ? "Enroll free" : "Choose this batch"}
                        </ButtonLink>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm">
                    <p className="font-bold text-slate-900">No batch open right now</p>
                    <p className="mt-2 text-slate-600">Ask us when the next one starts and we will let you know.</p>
                  </div>
                )}
                {/* No separate WhatsApp CTA here: the floating WhatsApp button
                    (public layout) already covers a general question on this
                    same page, without duplicating the batch page's real
                    "Buy via WhatsApp" deep link under a misleading label. */}
                <p className="mt-4 text-center text-xs leading-5 text-slate-500">Paid access begins only after payment verification.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading title="What you receive" description="Every learning tool is organized inside the selected batch workspace." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{featureDetails.map(({ icon: Icon, label, detail }) => <Panel key={label}><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></div><h3 className="mt-5 font-bold text-slate-950">{label}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p></Panel>)}</div>
        </div>
      </section>

      <section className="bg-canvas py-14 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-7 px-4 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-wider text-brand-700">Syllabus preview</p><h2 className="mt-2 text-2xl font-bold text-slate-950">A clear path through {course.modules} modules</h2></div><Badge>{course.lessons} lessons</Badge></div>
            <div className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200">{["Foundation concepts and orientation", "Core concepts with worked examples", "Guided practice and live problem solving", "Revision, mock tests and feedback"].map((title, index) => <div key={title} className="flex items-center gap-4 p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-700">{index + 1}</span><div><p className="font-semibold text-slate-900">{title}</p><p className="mt-1 text-sm text-slate-500">Lessons, resources and progress are released by the batch schedule.</p></div></div>)}</div>
          </Panel>
          <Panel>
            <p className="text-sm font-bold uppercase tracking-wider text-brand-700">Batch information</p>
            <dl className="mt-5 space-y-4 text-sm"><div><dt className="text-slate-500">Teacher</dt><dd className="mt-1 font-semibold text-slate-900">{course.teacher}</dd></div><div><dt className="text-slate-500">Weekly schedule</dt><dd className="mt-1 font-semibold text-slate-900">{course.schedule}</dd></div><div><dt className="text-slate-500">Start date</dt><dd className="mt-1 font-semibold text-slate-900">{course.startDate}</dd></div><div><dt className="text-slate-500">Access validity</dt><dd className="mt-1 font-semibold text-slate-900">{course.access}</dd></div></dl>
            <div className="mt-6 border-t border-slate-100 pt-5"><p className="flex gap-3 text-sm leading-6 text-slate-600"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />Schedule and access details remain visible before payment.</p></div>
          </Panel>
        </div>
      </section>

      {related.length ? <section className="bg-white py-14 sm:py-20"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><SectionHeading title="Related courses" /><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{related.map((item) => <CourseCard key={item.slug} course={item} />)}</div></div></section> : null}
    </>
  );
}
