import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";
import { PublicPageHero } from "@/components/public-page";
import { Badge, Panel } from "@/components/ui";
import { getPublicTeachers } from "@/lib/data/public";

export default async function TeachersPage() {
  const teachers = await getPublicTeachers();
  return (
    <><PublicPageHero eyebrow="Teachers" title="Meet the people guiding each batch" description="Teacher assignments, subjects and schedules remain connected to the actual batch rather than generic profile claims." />
      <section className="bg-canvas py-12 sm:py-16"><div className="mx-auto grid max-w-7xl gap-5 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-8">{teachers.map((teacher) => <Link key={teacher.slug} href={`/teachers/${teacher.slug}`} className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-card"><div className="flex items-start justify-between gap-4"><div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${teacher.accent} text-lg font-bold text-white`}>{teacher.initials}</div><Badge tone="blue">Faculty</Badge></div><h2 className="mt-5 text-xl font-bold text-slate-950 group-hover:text-brand-700">{teacher.name}</h2><p className="mt-1 font-semibold text-brand-700">{teacher.role}</p><p className="mt-4 text-sm leading-7 text-slate-600">{teacher.bio}</p><div className="mt-5 flex flex-wrap gap-2">{teacher.subjects.map((subject) => <Badge key={subject}>{subject}</Badge>)}</div><p className="mt-5 flex items-center gap-2 text-sm font-bold text-brand-700">View profile<ArrowRight className="h-4 w-4" /></p></Link>)}</div></section>
      <section className="bg-white py-14"><div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8"><Panel className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><BookOpen className="h-6 w-6" /></div><div><h2 className="text-xl font-bold text-slate-950">Teacher information stays practical</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{["Assigned subjects and batches", "Today’s class and schedule", "Minimum verified professional details", "No invented success rates or rankings"].map((item) => <p key={item} className="flex gap-2 text-sm leading-6 text-slate-600"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />{item}</p>)}</div></div></Panel></div></section>
    </>
  );
}
