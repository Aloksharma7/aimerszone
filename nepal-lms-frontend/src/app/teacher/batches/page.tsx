import { BookOpen, Plus, Users } from "lucide-react";
import { Pagination } from "@/components/pagination";
import { ButtonLink, MetricCard, PageHeader, Panel, ProgressBar, StatusBadge } from "@/components/ui";
import { getTeacherBatches, getTeacherBatchesPage } from "@/lib/data/teacher";
import { buildQueryString, matchesQuery, pageParam, searchTerm, type PageSearchParams } from "@/lib/search-params";

export default async function TeacherBatchesPage({ searchParams }: { searchParams: PageSearchParams }) {
  const raw = await searchParams;

  // The header search box targets this page. The backend has no search
  // filter for this endpoint, so the term is matched against whatever page
  // of results is currently on screen.
  const query = searchTerm(raw);
  const page = pageParam(raw);
  const [all, { items: pageItems, meta }] = await Promise.all([getTeacherBatches(), getTeacherBatchesPage({ page })]);
  const batches = pageItems.filter((batch) => matchesQuery(query, batch.course, batch.batch, batch.schedule, batch.status));
  const ongoing = all.filter((batch) => batch.status === "Ongoing").length;
  const upcoming = all.filter((batch) => batch.status === "Upcoming").length;
  const students = all.reduce((sum, batch) => sum + batch.students, 0);
  return <><PageHeader eyebrow="Teaching" title="My Batches" description={query ? `Batches matching “${query}”. Only batches assigned to your teacher account are shown.` : "Only batches assigned to your teacher account are shown."} /><div className="grid gap-4 sm:grid-cols-3"><MetricCard label="Ongoing" value={String(ongoing)} icon={BookOpen} tone="blue" /><MetricCard label="Upcoming" value={String(upcoming)} icon={Plus} tone="violet" /><MetricCard label="Students" value={String(students)} icon={Users} tone="green" /></div>{query && batches.length === 0 ? <Panel className="mt-6 text-center text-sm text-slate-500">No assigned batch matches “{query}”.</Panel> : null}<div className="mt-6 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">{batches.map((batch) => <Panel key={batch.id}><div className="flex items-center justify-between gap-3"><StatusBadge status={batch.status} /><span className="text-sm font-semibold text-slate-500">{batch.students} students</span></div><h2 className="mt-4 text-lg font-bold text-slate-950">{batch.course}</h2><p className="mt-1 text-sm font-semibold text-brand-700">{batch.batch}</p><dl className="mt-4 space-y-2 text-sm text-slate-500"><div className="flex justify-between gap-4"><dt>Schedule</dt><dd className="text-right font-medium text-slate-700">{batch.schedule}</dd></div><div className="flex justify-between gap-4"><dt>Next class</dt><dd className="text-right font-medium text-slate-700">{batch.nextClass}</dd></div></dl><div className="mt-5"><ProgressBar value={batch.progress} label="Syllabus coverage" /></div><ButtonLink href={`/teacher/batches/${batch.id}`} className="mt-5 w-full">Open batch workspace</ButtonLink></Panel>)}</div><Pagination meta={meta} buildHref={(target) => `/teacher/batches${buildQueryString({ search: query, page: String(target) })}`} /></>;
}
