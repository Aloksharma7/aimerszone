import { ArrowRight, CheckCircle2, Gift } from "lucide-react";
import { CourseCard } from "@/components/course-card";
import { ButtonLink, Panel, SectionHeading } from "@/components/ui";
import { getSessionUser } from "@/lib/auth/server";
import { getPublicCourses } from "@/lib/data/public";

export default async function FreeLearningPage() {
  const [viewer, courses] = await Promise.all([getSessionUser(), getPublicCourses()]);
  const isStudent = Boolean(viewer?.roles.includes("student"));
  const free = courses.filter((course) => course.isFree);
  return (
    <>
      <section className="border-b border-slate-200 bg-brand-50/70 py-14 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_420px] lg:items-center lg:px-8">
          <div><p className="text-sm font-bold uppercase tracking-[0.14em] text-green-700">Free learning</p><h1 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">Start with useful learning, not a sales promise.</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">Try selected orientation content and diagnostic tests. Sign in only when you want to store progress.</p>{isStudent ? <ButtonLink href="/student/dashboard" size="lg" className="mt-7">Go to your dashboard<ArrowRight className="h-5 w-5" /></ButtonLink> : <ButtonLink href="/register" size="lg" className="mt-7">Create free account<ArrowRight className="h-5 w-5" /></ButtonLink>}</div>
          <Panel><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-700"><Gift className="h-6 w-6" /></div><h2 className="mt-5 text-xl font-bold text-slate-950">What free means here</h2><div className="mt-5 space-y-3">{["No payment proof required", "Published content only", "Progress saved after login", "Paid batch recordings stay protected"].map((item) => <p key={item} className="flex gap-3 text-sm leading-6 text-slate-600"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />{item}</p>)}</div></Panel>
        </div>
      </section>
      <section className="bg-canvas py-14 sm:py-20"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><SectionHeading title="Available free learning" description="Published free courses and tests appear here without exposing paid batch content." /><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{free.map((course) => <CourseCard key={course.slug} course={course} />)}</div></div></section>
    </>
  );
}
