import Image from "next/image";
import { notFound } from "next/navigation";
import { BookOpen, CalendarDays, CheckCircle2, Clock3, GraduationCap, Layers3 } from "lucide-react";
import { Badge, ButtonLink, PageHeader, Panel } from "@/components/ui";
import { FreeEnrollButton } from "@/components/student/enrollment-actions";
import { getPublicCourse } from "@/lib/data/public";
import { formatNpr } from "@/lib/utils";

export default async function StudentExploreCoursePage({ params }: { params: Promise<{ courseSlug: string }> }) {
  const { courseSlug } = await params;
  const course = await getPublicCourse(courseSlug);
  if (!course) notFound();

  return (
    <>
      <PageHeader back={{ href: "/student/explore", label: "Explore courses" }}
        eyebrow={course.category}
        title={course.title}
        description="Review the course and batch details here, then continue enrollment inside your student workspace."
        actions={<ButtonLink href="/student/explore" variant="outline">Back to courses</ButtonLink>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_370px]">
        <div className="space-y-6">
          <Panel className="overflow-hidden p-0" padded={false}>
            {/*
              * The description used to live inside this overlay, absolutely
              * positioned over a fixed-aspect-ratio image with overflow-hidden.
              * A short mock description fit; a longer real one got silently
              * clipped — worse at narrow widths, where the same text wraps
              * into more lines but the image's height doesn't grow to match.
              * Badges are short, fixed content, so they're safe to keep here;
              * the description now lives in normal flow below instead, with
              * no height limit to overflow.
              */}
            <div className="relative aspect-[16/7] min-h-56 bg-slate-100">
              <Image src={course.image} alt="" fill className="object-cover" sizes="(min-width: 1280px) 760px, 100vw" priority />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/5 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
                <div className="flex flex-wrap gap-2"><Badge tone="blue" className="bg-white/15 text-white ring-white/20">{course.status}</Badge><Badge tone="green" className="bg-white/15 text-white ring-white/20">{course.isFree ? "Free access" : "Paid batch"}</Badge></div>
              </div>
            </div>
            <div className="p-5 sm:p-7">
              <p className="text-sm leading-6 text-slate-600">{course.description}</p>
            </div>
          </Panel>

          <Panel>
            <h2 className="text-xl font-bold text-slate-950">What is included</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {course.features.map((feature) => <div key={feature} className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-800"><CheckCircle2 className="h-5 w-5 text-green-600" />{feature}</div>)}
            </div>
          </Panel>

          <Panel>
            <h2 className="text-xl font-bold text-slate-950">Course structure</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-4"><Layers3 className="h-5 w-5 text-brand-700" /><p className="mt-3 text-2xl font-bold text-slate-950">{course.modules}</p><p className="mt-1 text-sm text-slate-500">Modules</p></div>
              <div className="rounded-xl border border-slate-200 p-4"><BookOpen className="h-5 w-5 text-brand-700" /><p className="mt-3 text-2xl font-bold text-slate-950">{course.lessons}</p><p className="mt-1 text-sm text-slate-500">Lessons</p></div>
              <div className="rounded-xl border border-slate-200 p-4"><GraduationCap className="h-5 w-5 text-brand-700" /><p className="mt-3 truncate text-lg font-bold text-slate-950" title={course.teacher}>{course.teacher}</p><p className="mt-1 text-sm text-slate-500">Faculty</p></div>
            </div>
          </Panel>
        </div>

        <aside>
          <Panel className="sticky top-24">
            <p className="text-sm font-bold uppercase tracking-wider text-brand-700">Available batch</p>
            <h2 className="mt-2 line-clamp-2 text-lg font-bold text-slate-950" title={course.batch}>{course.batch}</h2>
            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex gap-3"><CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" /><div><dt className="text-slate-500">Start date</dt><dd className="mt-1 font-semibold text-slate-900">{course.startDate}</dd></div></div>
              <div className="flex gap-3"><Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" /><div><dt className="text-slate-500">Schedule</dt><dd className="mt-1 font-semibold text-slate-900">{course.schedule}</dd></div></div>
              <div className="flex gap-3"><BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" /><div><dt className="text-slate-500">Access</dt><dd className="mt-1 font-semibold text-slate-900">{course.access}</dd></div></div>
            </dl>
            <div className="my-6 border-t border-slate-200" />
            <div className="flex items-baseline gap-2"><p className="text-3xl font-bold text-slate-950">{course.isFree ? "Free" : formatNpr(course.price)}</p>{course.originalPrice ? <p className="text-sm text-slate-400 line-through">{formatNpr(course.originalPrice)}</p> : null}</div>
            {course.isFree ? (
              <div className="mt-5">
                <FreeEnrollButton batchId={course.batchId} courseTitle={course.title} />
              </div>
            ) : (
              <ButtonLink href={`/student/payments/new?course=${course.slug}&batch=${course.batchId}`} className="mt-5 w-full">Continue to payment</ButtonLink>
            )}
            <p className="mt-3 text-center text-xs leading-5 text-slate-500">Your access is created only after the request is validated or the payment is approved.</p>
          </Panel>
        </aside>
      </div>
    </>
  );
}
