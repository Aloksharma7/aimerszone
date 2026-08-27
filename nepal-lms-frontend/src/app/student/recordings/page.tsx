import { MonitorPlay } from "lucide-react";
import { Pagination } from "@/components/pagination";
import { RecordingLibrary } from "@/components/student/recording-library";
import { MetricCard, PageHeader } from "@/components/ui";
import { getSessionUser, requirePermission } from "@/lib/auth/server";
import { getStudentRecordings, getStudentRecordingsPage } from "@/lib/data/student";
import { buildQueryString, pageParam, type PageSearchParams } from "@/lib/search-params";

export default async function StudentRecordingsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const user = await getSessionUser("student");
  if (user) await requirePermission(user, "recordings.view");
  const raw = await searchParams;
  const page = pageParam(raw);
  const [recordings, { items, meta }] = await Promise.all([getStudentRecordings(), getStudentRecordingsPage({ page })]);
  const inProgress = recordings.filter((item) => item.progress > 0 && item.progress < 100).length;
  const completed = recordings.filter((item) => item.progress >= 100).length;
  return (
    <>
      <PageHeader eyebrow="Learning library" title="Recorded Classes" description="All released recordings from your active courses, kept inside the student dashboard." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <MetricCard label="Available recordings" value={String(recordings.length)} detail="Across active enrollments" icon={MonitorPlay} tone="blue" />
        <MetricCard label="In progress" value={String(inProgress)} detail="Continue where you stopped" icon={MonitorPlay} tone="amber" />
        <MetricCard label="Completed" value={String(completed)} detail="Watched recordings" icon={MonitorPlay} tone="green" />
      </div>
      <RecordingLibrary recordings={items} global />
      <Pagination meta={meta} buildHref={(target) => `/student/recordings${buildQueryString({ page: String(target) })}`} />
    </>
  );
}
