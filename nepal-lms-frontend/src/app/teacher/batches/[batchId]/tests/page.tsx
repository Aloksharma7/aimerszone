import { notFound } from "next/navigation";
import { ClipboardCheck, Plus } from "lucide-react";
import { ListFilters } from "@/components/list-filters";
import { DeleteTestButton } from "@/components/teacher/delete-test-button";
import { ButtonLink, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { getTeacherBatch, getTeacherTests } from "@/lib/data/teacher";
import { portalPath } from "@/lib/portal-path";
import { firstParam, matchesQuery, type PageSearchParams } from "@/lib/search-params";

export default async function TeacherTestsPage({ params, searchParams }: { params: Promise<{ batchId: string }>; searchParams: PageSearchParams }) {
  const [{ batchId }, raw] = await Promise.all([params, searchParams]);
  const q = firstParam(raw.q);
  const status = firstParam(raw.status);
  const [detail, tests, testsBase] = await Promise.all([
    getTeacherBatch(batchId),
    getTeacherTests(batchId),
    portalPath("/teacher/tests"),
  ]);
  if (!detail) notFound();
  const statuses = [...new Set(tests.map((test) => test.status))].sort();
  const filtered = tests.filter((test) => matchesQuery(q, test.id, test.title, test.availability) && (!status || test.status === status));

  return (
    <>
      <PageHeader eyebrow="Assessment" title="Tests" description={`${detail.batch.course} · ${detail.batch.batch}`} actions={<ButtonLink href={`${testsBase}/new?batchId=${encodeURIComponent(batchId)}`}><Plus className="h-4 w-4" />Create test</ButtonLink>} />
      <Panel>
        <h2 className="text-xl font-bold text-slate-950">Batch tests</h2>
        <div className="mt-4"><ListFilters searchValue={q} searchPlaceholder="Search tests" resetHref={`/teacher/batches/${encodeURIComponent(batchId)}/tests`} fields={[{ name: "status", label: "Test status", value: status, options: [{ value: "", label: "All statuses" }, ...statuses.map((item) => ({ value: item, label: item }))] }]} /></div>
        <div className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {filtered.length ? filtered.map((test) => <div key={test.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><ClipboardCheck className="h-5 w-5" /></div><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-950">{test.title}</h3><StatusBadge status={test.status} /></div><p className="mt-1 text-sm text-slate-500">{test.availability} · {test.duration} · {test.attempts}</p></div><div className="flex shrink-0 flex-wrap gap-2"><ButtonLink href={`${testsBase}/${test.id}/results`} variant="outline" size="sm">Results</ButtonLink><ButtonLink href={`${testsBase}/${test.id}`} variant="outline" size="sm">Manage</ButtonLink><DeleteTestButton id={test.id} title={test.title} /></div></div>) : <p className="p-5 text-sm text-slate-500">No tests match the selected filters.</p>}
        </div>
      </Panel>
    </>
  );
}
