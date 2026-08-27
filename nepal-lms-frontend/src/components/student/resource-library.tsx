"use client";

import { useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";
import { SecureDownloadButton } from "@/components/student/secure-learning-actions";
import { EmptyState, Panel } from "@/components/ui";
import type { Resource, SyllabusModule } from "@/types/lms";
import { cn } from "@/lib/utils";

function ResourceRow({ item, global }: { item: Resource; global: boolean }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700"><FileText className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-slate-900">{item.title}</h3>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">{item.type}</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">{global && item.course ? `${item.course} · ` : ""}{item.module} · {item.size} · Released {item.released}</p>
      </div>
      <SecureDownloadButton resourceId={item.id} />
    </div>
  );
}

/**
 * `modules`, when passed, organizes the filtered list under its course's
 * syllabus modules (in syllabus order, with an "Other resources" bucket for
 * anything not attached to a lesson) instead of one flat list — mirrors
 * RecordingLibrary's grouping for the same reason: a course's own tab
 * should look different from the global "everything" library, not just be
 * the same list filtered down. A resource links to a specific lesson, not
 * a module directly, so the module is resolved via that lesson.
 */
export function ResourceLibrary({ resources, global = false, modules }: { resources: Resource[]; global?: boolean; modules?: SyllabusModule[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All");
  const types = ["All", ...Array.from(new Set(resources.map((resource) => resource.type)))];
  const visible = useMemo(() => resources.filter((resource) => {
    const text = `${resource.title} ${resource.course || ""} ${resource.module} ${resource.type}`.toLowerCase();
    return text.includes(query.trim().toLowerCase()) && (type === "All" || resource.type === type);
  }), [query, resources, type]);

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
        items: visible.filter((resource) => resource.syllabusLessonId && moduleByLessonId.get(resource.syllabusLessonId)?.id === module.id),
      }))
      .filter((group) => group.items.length > 0);
    const unassigned = visible.filter((resource) => !resource.syllabusLessonId || !moduleByLessonId.has(resource.syllabusLessonId));
    return { assigned, unassigned };
  }, [modules, visible]);

  return (
    <>
      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950">{global ? "PDFs and learning resources" : "Course resources"}</h2>
            <p className="mt-1 text-sm text-slate-500">Protected notes, practice sets and course documents from active enrollments.</p>
          </div>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100">
            <Search className="h-4 w-4 text-slate-400" />
            <span className="sr-only">Search resources</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full min-w-44 bg-transparent text-sm outline-none sm:w-56" placeholder="Search PDFs and notes" />
          </label>
        </div>
        <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto">
          {types.map((item) => <button key={item} type="button" onClick={() => setType(item)} className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-semibold", type === item ? "bg-brand-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>{item}</button>)}
        </div>
      </Panel>
      {!visible.length ? (
        <div className="mt-5"><EmptyState title="No matching resources" description="Try a different search or file type." /></div>
      ) : groups ? (
        <div className="mt-5 space-y-6">
          {groups.assigned.map(({ module, items }) => (
            <div key={module.id}>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-brand-700">{module.title}</h3>
              <div className="space-y-3">{items.map((item) => <ResourceRow key={item.id} item={item} global={global} />)}</div>
            </div>
          ))}
          {groups.unassigned.length ? (
            <div>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">Other resources</h3>
              <div className="space-y-3">{groups.unassigned.map((item) => <ResourceRow key={item.id} item={item} global={global} />)}</div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 space-y-3">{visible.map((item) => <ResourceRow key={item.id} item={item} global={global} />)}</div>
      )}
    </>
  );
}
