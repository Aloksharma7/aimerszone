import { notFound } from "next/navigation";
import { CheckCircle2, Circle, LockKeyhole, PlayCircle } from "lucide-react";
import { CourseWorkspaceHeader } from "@/components/course-workspace";
import { LessonCompletionToggle } from "@/components/student/lesson-completion-toggle";
import { Badge, EmptyState, Panel, ProgressBar, StatusBadge } from "@/components/ui";
import { getStudentEnrollment, getStudentSyllabus } from "@/lib/data/student";

export default async function SyllabusPage({ params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await params;
  const enrollment = await getStudentEnrollment(enrollmentId);
  if (!enrollment) notFound();
  const modules = await getStudentSyllabus(enrollment.id);
  return (
    <>
      <CourseWorkspaceHeader enrollmentId={enrollment.id} course={enrollment.course} progress={enrollment.progress} accessExpiry={enrollment.accessExpiry} />
      <Panel><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold uppercase tracking-wider text-brand-700">Course roadmap</p><h1 className="mt-2 text-xl font-bold text-slate-950">Syllabus</h1><p className="mt-1 text-sm text-slate-500">Follow modules, released lessons and assessment progress.</p></div><div className="w-full max-w-sm"><ProgressBar value={enrollment.syllabus} label="Syllabus progress" /></div></div></Panel>
      {modules.length ? <div className="mt-5 space-y-4">{modules.map((module, moduleIndex) => <Panel key={module.id}><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge tone="blue">Module {moduleIndex + 1}</Badge><StatusBadge status={module.progress >= 100 ? "Completed" : module.progress > 0 ? "In progress" : "Not started"} /></div><h2 className="mt-3 text-lg font-bold text-slate-950">{module.title}</h2></div><div className="w-full max-w-48"><ProgressBar value={module.progress} compact /></div></div><div className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200">{module.lessons.map((lesson, lessonIndex) => { const locked = lesson.state.toLowerCase().includes("locked"); const completed = lesson.state.toLowerCase().includes("complete"); return <div key={lesson.id || `${module.id}-${lessonIndex}`} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">{locked ? <LockKeyhole className="h-4 w-4" /> : completed ? <CheckCircle2 className="h-4 w-4 text-green-700" /> : lesson.type.toLowerCase().includes("record") ? <PlayCircle className="h-4 w-4" /> : <Circle className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><h3 className="font-semibold text-slate-900">{lesson.title}</h3><p className="mt-1 text-xs text-slate-500">{lesson.type}</p></div><div className="flex items-center gap-3">{lesson.id && !locked ? <LessonCompletionToggle enrollmentId={enrollment.id} lessonId={lesson.id} initialCompleted={completed} label={lesson.title} /> : null}<StatusBadge status={lesson.state} /></div></div>; })}</div></Panel>)}</div> : <div className="mt-5"><EmptyState title="Syllabus not published" description="Course modules will appear after the academic team publishes the syllabus." /></div>}
    </>
  );
}
