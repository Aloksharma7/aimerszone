"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { RecordingRow } from "@/components/portal-components";
import { EmptyState, Panel } from "@/components/ui";
import type { Recording } from "@/types/lms";
import { cn } from "@/lib/utils";

export function RecordingLibrary({ recordings, global = false }: { recordings: Recording[]; global?: boolean }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState("All");
  const states = ["All", "In progress", "Not started", "Completed", "Available"];
  const visible = useMemo(() => recordings.filter((recording) => {
    const text = `${recording.title} ${recording.course || ""} ${recording.module} ${recording.teacher}`.toLowerCase();
    return text.includes(query.trim().toLowerCase()) && (state === "All" || recording.state === state);
  }), [query, recordings, state]);

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
      {visible.length ? <div className="mt-5 space-y-3">{visible.map((recording) => {
        const enrollmentId = recording.enrollmentId;
        const href = enrollmentId ? `/student/courses/${enrollmentId}/recordings/${recording.id}` : `/student/recordings/${recording.id}`;
        return <RecordingRow key={recording.id} recording={recording} href={href} showCourse={global} />;
      })}</div> : <div className="mt-5"><EmptyState title="No matching recordings" description="Try a different search or progress filter." /></div>}
    </>
  );
}
