import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, CalendarDays, CheckCircle2 } from "lucide-react";
import { CourseCard } from "@/components/course-card";
import { Badge, Panel, SectionHeading } from "@/components/ui";
import { getPublicCourses, getPublicTeacher } from "@/lib/data/public";
import { pageMetadata } from "@/lib/metadata";

export async function generateMetadata({ params }: { params: Promise<{ teacherSlug: string }> }): Promise<Metadata> {
  const { teacherSlug } = await params;
  const teacher = await getPublicTeacher(teacherSlug);
  if (!teacher) return { title: "Teacher not found" };
  return pageMetadata({
    title: teacher.name,
    description: `${teacher.name}, ${teacher.role} at Aimers Zone, teaching ${teacher.subjects.join(" and ")}. ${teacher.bio}`,
  });
}

export default async function TeacherProfilePage({ params }: { params: Promise<{ teacherSlug: string }> }) {
  const { teacherSlug } = await params;
  const [teacher, courses] = await Promise.all([getPublicTeacher(teacherSlug), getPublicCourses()]);
  if (!teacher) notFound();
  const assigned = courses.filter((course) => course.teacherSlug === teacher.slug);
  return (
    <><section className="border-b border-slate-200 bg-canvas py-12"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><Link href="/teachers" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-brand-700"><ArrowLeft className="h-4 w-4" />All teachers</Link><div className="mt-7 grid gap-7 lg:grid-cols-[auto_1fr] lg:items-center"><div className={`flex h-32 w-32 items-center justify-center rounded-3xl bg-gradient-to-br ${teacher.accent} text-3xl font-bold text-white shadow-card`}>{teacher.initials}</div><div><div className="flex flex-wrap gap-2"><Badge tone="blue">{teacher.role}</Badge><Badge>{teacher.experience}</Badge></div><h1 className="wrap-break-word mt-4 text-4xl font-bold tracking-tight text-slate-950">{teacher.name}</h1><p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">{teacher.bio}</p></div></div></div></section>
    <section className="bg-white py-14"><div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[1fr_340px] lg:px-8"><Panel><h2 className="text-xl font-bold text-slate-950">Teaching focus</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">{teacher.subjects.map((subject) => <div key={subject} className="rounded-xl border border-slate-200 p-4"><BookOpen className="h-5 w-5 text-brand-700" /><p className="mt-3 font-semibold text-slate-900">{subject}</p><p className="mt-1 text-sm leading-6 text-slate-500">Concept explanation, guided practice and structured revision.</p></div>)}</div></Panel><Panel><h2 className="text-xl font-bold text-slate-950">Profile information</h2><div className="mt-5 space-y-4 text-sm"><p className="flex gap-3"><CalendarDays className="h-5 w-5 shrink-0 text-brand-700" /><span><span className="block text-slate-500">Experience</span><span className="font-semibold text-slate-900">{teacher.experience}</span></span></p><p className="flex gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" /><span><span className="block text-slate-500">Current assignment</span><span className="font-semibold text-slate-900">{assigned.length} published course{assigned.length === 1 ? "" : "s"}</span></span></p></div></Panel></div></section>
    {assigned.length ? <section className="bg-canvas py-14"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><SectionHeading title="Current published courses" /><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{assigned.map((course) => <CourseCard key={course.slug} course={course} />)}</div></div></section> : null}</>
  );
}
