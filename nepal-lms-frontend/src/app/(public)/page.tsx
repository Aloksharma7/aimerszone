import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Gift,
  GraduationCap,
  Headphones,
  Landmark,
  MessageCircle,
  MonitorPlay,
  PlayCircle,
  Radio,
  School,
  Search,
  Target,
} from "lucide-react";
import { CourseCard } from "@/components/course-card";
import { FaqList } from "@/components/faq-list";
import { HomeDashboardPreview } from "@/components/home-preview";
import { Badge, Button, ButtonLink, SectionHeading } from "@/components/ui";
import { getPublicCategories, getPublicCourses, getPublicFaqs, getPublicTeachers } from "@/lib/data/public";

const categoryIcons = { BriefcaseBusiness: GraduationCap, Target, Landmark, School, Gift };

// Only a description here — no title — so the root layout's own default
// title ("Aimers Zone — Start with an Aim, Finish with Success.") applies
// unwrapped, instead of the %s | Aimers Zone template doubling the brand
// name on the one page that already is the brand's own title.
export const metadata: Metadata = {
  description:
    "Aimers Zone is a Birgunj-based learning institute offering live Physics and Chemistry classes, recordings, focused tests and real human support for exam preparation and entrance coaching.",
  openGraph: {
    description:
      "Aimers Zone is a Birgunj-based learning institute offering live Physics and Chemistry classes, recordings, focused tests and real human support for exam preparation and entrance coaching.",
  },
};

export default async function HomePage() {
  const [categories, courses, faqs, teachers] = await Promise.all([getPublicCategories(), getPublicCourses(), getPublicFaqs(), getPublicTeachers()]);
  return (
    <>
      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-brand-50/70 to-white">
        <div className="hero-grid absolute inset-0" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <Badge tone="blue" className="mb-5 px-3 py-1.5">Built for students in Nepal</Badge>
            <h1 className="text-balance text-4xl font-bold tracking-[-0.035em] text-slate-950 sm:text-5xl lg:text-[58px] lg:leading-[1.08]">
              Study with a clear plan, <span className="text-brand-700">not scattered links.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              Join live classes, revise from recordings, take focused tests and get human support—all inside one calm learning space.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/courses" size="lg" className="sm:min-w-44">Explore Courses<ArrowRight className="h-5 w-5" /></ButtonLink>
              <ButtonLink href="/free-learning" size="lg" variant="outline" className="sm:min-w-40"><Gift className="h-5 w-5" />Start Free</ButtonLink>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm font-medium text-slate-600">
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" />Clear schedules</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" />Mobile-friendly</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" />Human payment support</span>
            </div>
            <form action="/courses" method="get" role="search" className="mt-8 flex max-w-xl items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
              <Search className="ml-2 h-5 w-5 text-slate-400" aria-hidden="true" />
              <label htmlFor="home-course-search" className="sr-only">Search courses</label>
              <input id="home-course-search" name="search" maxLength={100} className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none placeholder:text-slate-400" placeholder="Search Physics, Chemistry..." />
              <Button type="submit" size="sm" className="hidden sm:inline-flex">Find a course</Button>
            </form>
          </div>
          <HomeDashboardPreview />
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-y divide-slate-200 px-4 sm:px-6 md:grid-cols-4 md:divide-y-0 lg:px-8">
          {[
            [Radio, "Scheduled live classes", "Know exactly when to join"],
            [PlayCircle, "Recordings and notes", "Revise missed or difficult topics"],
            [ClipboardCheck, "Focused tests", "Practise and monitor progress"],
            [Headphones, "Local support", "Get help through phone or WhatsApp"],
          ].map(([Icon, title, detail], index) => {
            const C = Icon as typeof Radio;
            return <div key={String(title)} className={`px-4 py-7 sm:px-6 ${index % 2 === 0 ? "pl-0 sm:pl-6" : ""}`}><C className="h-5 w-5 text-brand-700" /><p className="mt-3 text-sm font-bold text-slate-900">{String(title)}</p><p className="mt-1 text-xs leading-5 text-slate-500">{String(detail)}</p></div>;
          })}
        </div>
      </section>

      <section className="bg-canvas py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Find your direction" title="Courses organized around your real study goal" description="Browse focused categories instead of searching through an overloaded course library." action={<ButtonLink href="/courses" variant="outline">View all courses</ButtonLink>} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {categories.map((category) => {
              const Icon = categoryIcons[category.icon as keyof typeof categoryIcons] || BookOpenCheck;
              return (
                <Link key={category.name} href={`/courses?category=${encodeURIComponent(category.name)}`} className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-card">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 group-hover:bg-brand-700 group-hover:text-white"><Icon className="h-5 w-5" /></div>
                  <h3 className="mt-5 font-bold leading-6 text-slate-950">{category.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{category.detail}</p>
                  <p className="mt-4 flex items-center gap-1 text-xs font-bold text-brand-700">Explore <ChevronRight className="h-4 w-4" /></p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Upcoming and active" title="Choose a batch with the details already clear" description="See schedule, start date, access period, learning tools and price before you decide." action={<ButtonLink href="/courses" variant="outline">Browse catalogue</ButtonLink>} />
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{courses.slice(0, 3).map((course) => <CourseCard key={course.slug} course={course} />)}</div>
          <div className="mt-6 sm:hidden"><ButtonLink href="/courses" variant="outline" className="w-full">Browse all courses</ButtonLink></div>
        </div>
      </section>

      <section className="bg-brand-950 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="How learning works" title="One simple rhythm from class to revision" description="The platform keeps the next useful action visible instead of distracting you with unnecessary analytics." theme="dark" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              [MonitorPlay, "Join the right class", "See today’s class, Nepal time and one clear Join button."],
              [PlayCircle, "Catch up from recordings", "Continue exactly where you stopped and find related notes."],
              [ClipboardCheck, "Practise with purpose", "Take scheduled tests and view results when released."],
              [Headphones, "Ask a real person", "Get enrollment, payment and account help without confusion."],
            ].map(([Icon, title, detail], index) => {
              const C = Icon as typeof MonitorPlay;
              return <div key={String(title)} className="rounded-2xl border border-white/10 bg-white/[0.06] p-5"><div className="flex items-center justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-blue-200"><C className="h-5 w-5" /></div><span className="text-3xl font-bold text-white/10">0{index + 1}</span></div><h3 className="mt-5 text-lg font-bold">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{String(detail)}</p></div>;
            })}
          </div>
        </div>
      </section>

      <section className="bg-brand-50/60 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
            <div>
              <Badge tone="green">Free learning</Badge>
              <h2 className="mt-5 text-balance text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Start learning before you pay for a batch.</h2>
              <p className="mt-4 text-base leading-7 text-slate-600">Use free orientation content and diagnostic tests to understand the learning experience and your current preparation level.</p>
              <ButtonLink href="/free-learning" className="mt-6">Explore free learning<ArrowRight className="h-4 w-4" /></ButtonLink>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">{courses.filter((course) => course.isFree).map((course) => <CourseCard key={course.slug} course={course} />)}</div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Teachers" title="Clear teaching, practical guidance" description="Meet the teachers assigned to currently published courses and batches." action={<ButtonLink href="/teachers" variant="outline">Meet all teachers</ButtonLink>} />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {teachers.map((teacher) => (
              <Link key={teacher.slug} href={`/teachers/${teacher.slug}`} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-blue-200 hover:shadow-card">
                {teacher.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded asset, not a Next-optimized asset
                  <img src={teacher.avatarUrl} alt="" className="aspect-square w-full object-cover" />
                ) : (
                  <div className={`flex aspect-square w-full items-center justify-center bg-linear-to-br ${teacher.accent} text-5xl font-bold text-white`}>{teacher.initials}</div>
                )}
                <div className="p-5">
                  <h3 className="font-bold text-slate-950 group-hover:text-brand-700">{teacher.name}</h3>
                  <p className="mt-1 text-sm font-medium text-brand-700">{teacher.role}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-500">{teacher.subjects.join(" · ")}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-canvas py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Enrollment" title="Start in three understandable steps" align="center" />
          <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
            {[
              [BookOpenCheck, "Choose a batch", "Compare schedule, teacher, validity and price before enrolling."],
              [MessageCircle, "Pay and upload proof", "Use the approved QR or account details, then submit your reference."],
              [GraduationCap, "Get approved access", "After verification, your batch appears automatically in My Courses."],
            ].map(([Icon, title, detail], index) => {
              const C = Icon as typeof BookOpenCheck;
              return <div key={String(title)} className="relative rounded-2xl border border-slate-200 bg-white p-6"><span className="absolute right-5 top-5 text-4xl font-bold text-slate-100">{index + 1}</span><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><C className="h-6 w-6" /></div><h3 className="mt-5 text-lg font-bold text-slate-950">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{String(detail)}</p></div>;
            })}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Questions" title="What students usually ask before joining" align="center" />
          <FaqList items={faqs.slice(0, 5)} />
          <div className="mt-6 text-center"><Link href="/faq" className="font-bold text-brand-700 hover:text-brand-900">View all questions <ArrowRight className="ml-1 inline h-4 w-4" /></Link></div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-canvas py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl bg-brand-900 px-6 py-10 text-white shadow-card sm:px-10 lg:flex lg:items-center lg:justify-between lg:gap-10 lg:px-12">
            <div><p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-200">Need help choosing?</p><h2 className="mt-3 text-3xl font-bold tracking-tight">Talk to the enrollment team before you pay.</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100">Share your study goal, preferred time and current level. We will point you to the right published batch.</p></div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row lg:mt-0 lg:shrink-0"><ButtonLink href="/contact" className="border-white bg-white text-brand-900 hover:bg-blue-50">Contact support</ButtonLink><ButtonLink href="/courses" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10">Explore courses</ButtonLink></div>
          </div>
        </div>
      </section>
    </>
  );
}
