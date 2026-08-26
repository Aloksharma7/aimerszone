import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, CreditCard, FileUp, MessageCircle, ShieldCheck, UserRound } from "lucide-react";
import { AlertBox, Badge, ButtonLink, Panel, StatusBadge } from "@/components/ui";
import { CheckList } from "@/components/portal-components";
import { getSessionUser } from "@/lib/auth/server";
import { getPublicCourses } from "@/lib/data/public";
import { getPublicSettings } from "@/lib/data/settings";
import { formatNpr } from "@/lib/utils";

/**
 * The pre-filled message for "Buy via WhatsApp" — a second purchase path
 * alongside the in-app proof-upload wizard, for a buyer who would rather
 * arrange payment and enrollment in conversation. Staff completes the
 * enrollment afterward from /staff/students and /staff/payment-submissions,
 * same as any other manually-recorded payment.
 */
function buildWhatsAppBuyMessage(options: { courseTitle: string; batchTitle: string; priceLabel: string; studentName?: string | null }): string {
  const lines = [
    "Hello, I would like to buy this course:",
    `Course: ${options.courseTitle}`,
    `Batch: ${options.batchTitle}`,
    `Price: ${options.priceLabel}`,
  ];
  if (options.studentName) lines.push(`My name: ${options.studentName}`);
  lines.push("Please help me complete the enrollment.");
  return lines.join("\n");
}

export default async function BatchPage({ params }: { params: Promise<{ batchPublicId: string }> }) {
  const { batchPublicId } = await params;

  /*
   * A signed-in student must go straight to payment.
   *
   * This page previously sent everyone to /register, so an already-registered
   * student clicking through was bounced back to their dashboard by the
   * guest guard with no explanation of what had happened or what to do next.
   */
  const [viewer, courses, settings] = await Promise.all([getSessionUser(), getPublicCourses(), getPublicSettings()]);
  const course = courses.find((item) => item.batchId === batchPublicId);
  if (!course) notFound();

  // Signed-in students go straight to the payment wizard for this exact batch;
  // free courses activate directly; guests still register first.
  const isStudent = Boolean(viewer?.roles.includes("student"));
  const enrollHref = isStudent
    ? course.isFree
      ? `/student/explore/${encodeURIComponent(course.slug)}`
      : `/student/payments/new?course=${encodeURIComponent(course.slug)}&batch=${encodeURIComponent(course.batchId)}`
    : `/register?returnTo=${encodeURIComponent(`/batches/${batchPublicId}`)}`;

  const enrollLabel = isStudent
    ? course.isFree
      ? "Activate this free course"
      : "Continue to payment"
    : "Register and continue";

  // A second purchase path for a buyer who would rather arrange this in
  // conversation than fill in the proof-upload wizard themselves.
  const whatsappMessage = buildWhatsAppBuyMessage({
    courseTitle: course.title,
    batchTitle: course.batch,
    priceLabel: course.isFree ? "Free" : formatNpr(course.price),
    studentName: viewer?.name,
  });
  const whatsappHref = `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <section className="bg-canvas py-10 sm:py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Link href={`/courses/${course.slug}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-brand-700"><ArrowLeft className="h-4 w-4" />Back to course</Link>
        <div className="mt-6 grid gap-7 lg:grid-cols-[1fr_390px]">
          <div>
            <div className="flex flex-wrap gap-2"><Badge tone="blue">{course.category}</Badge><StatusBadge status={course.status} /></div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{course.batch}</h1>
            <p className="mt-2 text-lg font-semibold text-brand-700">{course.title}</p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">Review the final schedule, access and payment information before creating your submission.</p>
            <Panel className="mt-7">
              <h2 className="text-xl font-bold text-slate-950">Batch details</h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                {[
                  [CalendarDays, "Starts", course.startDate],
                  [Clock3, "Class schedule", course.schedule],
                  [UserRound, "Teacher", course.teacher],
                  [ShieldCheck, "Access period", course.access],
                ].map(([Icon, label, value]) => { const C = Icon as typeof CalendarDays; return <div key={String(label)} className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><C className="h-5 w-5" /></div><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{String(label)}</p><p className="mt-1 text-sm font-semibold leading-6 text-slate-900">{String(value)}</p></div></div>; })}
              </div>
            </Panel>
            <Panel className="mt-5">
              <h2 className="text-xl font-bold text-slate-950">Included in this batch</h2>
              <div className="mt-5"><CheckList items={["Scheduled live classes in Nepal time", "Released class recordings during your access period", "Module notes and authorised resources", "Tests and released progress information", "Enrollment and account support"]} /></div>
            </Panel>
            <AlertBox title="Access does not begin immediately after upload" tone="info"><p>Your proof must be checked against the external payment record. Approval creates the enrollment automatically.</p></AlertBox>
          </div>
          <Panel className="h-fit lg:sticky lg:top-24">
            <p className="text-sm font-semibold text-slate-500">Amount payable</p>
            <div className="mt-2 flex items-end gap-2"><p className="text-3xl font-bold text-slate-950">{course.isFree ? "Free" : formatNpr(course.price)}</p>{course.originalPrice ? <p className="pb-1 text-sm text-slate-400 line-through">{formatNpr(course.originalPrice)}</p> : null}</div>
            <div className="mt-5 rounded-xl bg-slate-50 p-4"><p className="font-semibold text-slate-900">{course.seats}</p><p className="mt-1 text-sm leading-6 text-slate-500">Seat information is shown only when it can be maintained reliably.</p></div>
            <div className="mt-5 space-y-3 text-sm text-slate-600"><p className="flex gap-3"><CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />Pay using the approved QR, wallet or bank details.</p><p className="flex gap-3"><FileUp className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />Upload a clear proof and transaction reference.</p><p className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />Receive access after accountant verification.</p></div>
            <ButtonLink href={enrollHref} size="lg" className="mt-6 w-full">{enrollLabel}</ButtonLink>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-green-600 bg-green-50 px-5 text-base font-semibold text-green-800 transition-colors hover:bg-green-100"
            >
              <MessageCircle className="h-5 w-5" />Buy via WhatsApp
            </a>
            <p className="mt-2 text-center text-xs leading-5 text-slate-500">Prefer to arrange this in conversation? Message us with the course, batch and price already filled in — our team enrolls you once payment is confirmed.</p>
            <ButtonLink href="/payment-instructions" variant="outline" size="lg" className="mt-3 w-full">View payment instructions</ButtonLink>
          </Panel>
        </div>
      </div>
    </section>
  );
}
