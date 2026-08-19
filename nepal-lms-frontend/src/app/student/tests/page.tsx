import { ClipboardCheck, Clock3, Trophy } from "lucide-react";
import { CompactTestCard } from "@/components/portal-components";
import { EmptyState, MetricCard, PageHeader, Panel } from "@/components/ui";
import { getStudentTests } from "@/lib/data/student";

export default async function StudentTestsPage() {
  const tests = await getStudentTests();
  const available = tests.filter((item) => item.status === "Available");
  const upcoming = tests.filter((item) => item.status === "Upcoming");
  const completed = tests.filter((item) => item.status === "Completed");
  return (
    <>
      <PageHeader eyebrow="Assessments" title="Tests" description="See what is available, what is scheduled and which results have been released." />
      <div className="grid gap-4 sm:grid-cols-3"><MetricCard label="Available now" value={String(available.length)} detail="Ready within the opening window" icon={ClipboardCheck} tone="violet" /><MetricCard label="Upcoming" value={String(upcoming.length)} detail="Scheduled assessments" icon={Clock3} tone="blue" /><MetricCard label="Completed" value={String(completed.length)} detail="Results shown when released" icon={Trophy} tone="green" /></div>
      <Panel className="mt-6"><div className="no-scrollbar flex gap-2 overflow-x-auto"><span className="rounded-full bg-brand-900 px-4 py-2 text-sm font-semibold text-white">All tests · {tests.length}</span><span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Available · {available.length}</span><span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Upcoming · {upcoming.length}</span><span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">Completed · {completed.length}</span></div>{tests.length ? <div className="mt-5 space-y-3">{tests.map((test) => <CompactTestCard key={test.id} test={test} href={`/student/tests/${test.id}`} />)}</div> : <div className="mt-5"><EmptyState title="No tests available" description="Assessments will appear after your teacher publishes them." /></div>}</Panel>
    </>
  );
}
