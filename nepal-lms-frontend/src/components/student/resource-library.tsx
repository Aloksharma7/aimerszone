"use client";

import { useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";
import { SecureDownloadButton } from "@/components/student/secure-learning-actions";
import { EmptyState, Panel } from "@/components/ui";
import type { Resource } from "@/types/lms";
import { cn } from "@/lib/utils";

export function ResourceLibrary({ resources, global = false }: { resources: Resource[]; global?: boolean }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All");
  const types = ["All", ...Array.from(new Set(resources.map((resource) => resource.type)))];
  const visible = useMemo(() => resources.filter((resource) => {
    const text = `${resource.title} ${resource.course || ""} ${resource.module} ${resource.type}`.toLowerCase();
    return text.includes(query.trim().toLowerCase()) && (type === "All" || resource.type === type);
  }), [query, resources, type]);

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
      {visible.length ? <div className="mt-5 space-y-3">{visible.map((item) => (
        <div key={item.id} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
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
      ))}</div> : <div className="mt-5"><EmptyState title="No matching resources" description="Try a different search or file type." /></div>}
    </>
  );
}
