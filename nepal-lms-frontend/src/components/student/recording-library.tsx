"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { RecordingRow } from "@/components/portal-components";
import { EmptyState, Panel } from "@/components/ui";
import type { Recording, SyllabusModule } from "@/types/lms";
import { cn } from "@/lib/utils";

/**
 * The global library plays a recording right where you clicked it from —
 * you're browsing across every course in whatever order you like, so
 * jumping into a specific course's structured view here would fight that.
 * A course's own recordings tab is the structured, syllabus-ordered
 * experience instead, so it's the only place that opens the course-scoped
 * detail page (with its prev/next-lesson navigation and course sidebar).
 */
function hrefFor(recording: Recording, global: boolean): string {
  if (global) return `/student/recordings/${recording.id}`;
  const enrollmentId = recording.enrollmentId;
  return enrollmentId ? `/student/courses/${enrollmentId}/recordings/${recording.id}` : `/student/recordings/${recording.id}`;
}

/**
 * `modules`, when passed, organizes the filtered list under its course's
 * syllabus modules (in syllabus order, with an "Other recordings" bucket for
 * anything not attached to a lesson) instead of one flat list — what
 * actually distinguishes a course's own recordings tab from the global
 * "everything I can watch" library, which stays a flat list on purpose. A
 * recording links to a specific lesson, not a module directly, so the
 * module is resolved by finding which module that lesson belongs to.
 */
export function RecordingLibrary({ recordings, global = false, modules }: { recordings: Recording[]; global?: boolean; modules?: SyllabusModule[] }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState("All");
  const states = ["All", "In progress", "Not started", "Completed", "Available"];
  const visible = useMemo(() => recordings.filter((recording) => {
    const text = `${recording.title} ${recording.course || ""} ${recording.module} ${recording.teacher}`.toLowerCase();
    return text.includes(query.trim().toLowerCase()) && (state === "All" || recording.state === state);
  }), [query, recordings, state]);

  const groups = useMemo(() => {
    if (!modules || !modules.length) return null;
    const moduleByLessonId = new Map<string, SyllabusModule>();
    for (const syllabusModule of modules) {
      for (const lesson of syllabusModule.lessons) {
        if (lesson.id) moduleByLessonId.set(lesson.id, syllabusModule);
      }
    }
    const assigned = modules
      .map((module) => ({
        module,
        items: visible.filter((recording) => recording.syllabusLessonId && moduleByLessonId.get(recording.syllabusLessonId)?.id === module.id),
      }))
      .filter((group) => group.items.length > 0);
    const unassigned = visible.filter((recording) => !recording.syllabusLessonId || !moduleByLessonId.has(recording.syllabusLessonId));
    return { assigned, unassigned };
  }, [modules, visible]);

  return (
    <>
      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950">{global ? "All recorded classes" : "Class recordings"}</h2>
            <p className="mt-1 text-sm text-slate-500">Continue released videos during your active access period.</p>
          </div>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100">
            <Search className="h-4 w-4 text-slate-400" />
            <span className="sr-only">Search recordings</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full min-w-44 bg-transparent text-sm outline-none sm:w-56" placeholder="Search recordings" />
          </label>
        </div>
        <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto">
          {states.map((item) => <button key={item} type="button" onClick={() => setState(item)} className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-semibold", state === item ? "bg-brand-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>{item}</button>)}
        </div>
      </Panel>
      {!visible.length ? (
        <div className="mt-5"><EmptyState title="No matching recordings" description="Try a different search or progress filter." /></div>
      ) : groups ? (
        <div className="mt-5 space-y-6">
          {groups.assigned.map(({ module, items }) => (
            <div key={module.id}>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-brand-700">{module.title}</h3>
              <div className="space-y-3">{items.map((recording) => <RecordingRow key={recording.id} recording={recording} href={hrefFor(recording, global)} showCourse={global} />)}</div>
            </div>
          ))}
          {groups.unassigned.length ? (
            <div>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">Other recordings</h3>
              <div className="space-y-3">{groups.unassigned.map((recording) => <RecordingRow key={recording.id} recording={recording} href={hrefFor(recording, global)} showCourse={global} />)}</div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 space-y-3">{visible.map((recording) => <RecordingRow key={recording.id} recording={recording} href={hrefFor(recording, global)} showCourse={global} />)}</div>
      )}
    </>
  );
}
