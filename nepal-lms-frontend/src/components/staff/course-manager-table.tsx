"use client";

import Link from "next/link";
import { BookOpen, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState, Panel, StatusBadge } from "@/components/ui";
import { formatNpr } from "@/lib/utils";
import type { StaffCourse } from "@/types/lms";

export function CourseManagerTable({ courses, canEdit }: { courses: StaffCourse[]; canEdit: boolean }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const visible = useMemo(() => courses.filter((course) => {
    const queryMatch = `${course.title} ${course.code} ${course.category}`.toLowerCase().includes(query.toLowerCase());
    const label = course.published ? "Published" : "Draft";
    return queryMatch && (status === "All" || status === label);
  }), [courses, query, status]);

  return (
    <Panel className="p-0" padded={false}>
      <div className="flex flex-col gap-3 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
        <label className="flex h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100"><Search className="h-4 w-4 text-slate-400" /><span className="sr-only">Search courses</span><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full min-w-0 bg-transparent text-sm outline-none lg:w-72" placeholder="Search title, code or category" /></label>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm"><option>All</option><option>Published</option><option>Draft</option></select>
      </div>
      {visible.length ? <div className="soft-scrollbar overflow-x-auto"><table className="w-full min-w-[880px] border-collapse text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="border-b border-slate-200 px-5 py-3 font-bold">Course</th><th className="border-b border-slate-200 px-5 py-3 font-bold">Category</th><th className="border-b border-slate-200 px-5 py-3 font-bold">Price</th><th className="border-b border-slate-200 px-5 py-3 font-bold">Batches</th><th className="border-b border-slate-200 px-5 py-3 font-bold">Enrollments</th><th className="border-b border-slate-200 px-5 py-3 font-bold">Status</th><th className="border-b border-slate-200 px-5 py-3 text-right font-bold">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{visible.map((course) => <tr key={course.id || course.slug} className="hover:bg-slate-50/70"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><BookOpen className="h-5 w-5" /></div><div><p className="font-semibold text-slate-950">{course.title}</p><p className="mt-1 text-xs text-slate-500">{course.code}</p></div></div></td><td className="px-5 py-4 text-slate-600">{course.category}</td><td className="px-5 py-4 font-semibold text-slate-900">{course.isFree ? "Free" : formatNpr(course.price)}</td><td className="px-5 py-4 text-slate-600">{course.batchCount ?? 0}</td><td className="px-5 py-4 text-slate-600">{course.enrollments ?? 0}</td><td className="px-5 py-4"><StatusBadge status={course.published ? "Published" : "Draft"} /></td><td className="px-5 py-4 text-right"><Link href={`/staff/courses/${encodeURIComponent(course.id || course.slug)}`} className="text-sm font-bold text-brand-700 hover:text-brand-900">{canEdit ? "Manage" : "View"}</Link></td></tr>)}</tbody></table></div> : <div className="p-5"><EmptyState title="No matching courses" description="Try a different search or status filter." /></div>}
      <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">{visible.length} of {courses.length} courses shown</div>
    </Panel>
  );
}
