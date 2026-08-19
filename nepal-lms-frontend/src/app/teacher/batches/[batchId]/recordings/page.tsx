import { notFound } from "next/navigation";
import { Plus, Youtube } from "lucide-react";
import { ListFilters } from "@/components/list-filters";
import { RecordingList } from "@/components/teacher/recording-list";
import { TeacherRecordingForm } from "@/components/teacher/teacher-actions";
import { ButtonLink, PageHeader, Panel } from "@/components/ui";
import { getSessionUser, requirePermission } from "@/lib/auth/server";
import { getTeacherBatch, getTeacherBatchRecordings, getTeacherBatchSessionOptions } from "@/lib/data/teacher";
import { firstParam, matchesQuery, type PageSearchParams } from "@/lib/search-params";

export default async function TeacherRecordingsPage({ params, searchParams }: { params: Promise<{ batchId: string }>; searchParams: PageSearchParams }) {
  const [{ batchId }, raw] = await Promise.all([params, searchParams]);
  const q = firstParam(raw.q);
  const user = await getSessionUser("teacher");
  if (!user) notFound();
  await requirePermission(user, "recordings.manage");
  const [detail, items, sessionOptions] = await Promise.all([getTeacherBatch(batchId), getTeacherBatchRecordings(batchId), getTeacherBatchSessionOptions(batchId)]);
  if (!detail) notFound();
  const filtered = items.filter((item) => matchesQuery(q, item.id, item.title, item.module, item.teacher, item.state));

  return (
    <>
      <PageHeader eyebrow="Academic content" title="Recordings" description={`${detail.batch.course} · ${detail.batch.batch}`} actions={<ButtonLink href={`/teacher/batches/${encodeURIComponent(batchId)}/recordings#add-recording`}><Plus className="h-4 w-4" />Add recording</ButtonLink>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Panel>
          <h2 className="text-xl font-bold text-slate-950">Released recordings</h2>
          <div className="mt-4"><ListFilters searchValue={q} searchPlaceholder="Search recording or module" resetHref={`/teacher/batches/${encodeURIComponent(batchId)}/recordings`} /></div>
          <div className="mt-5"><RecordingList batchId={batchId} items={filtered} /></div>
        </Panel>
        <aside id="add-recording"><Panel><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-700"><Youtube className="h-6 w-6" /></div><h2 className="mt-5 text-lg font-bold text-slate-950">Add recording</h2><TeacherRecordingForm batchId={batchId} sessionOptions={sessionOptions} /></Panel></aside>
      </div>
    </>
  );
}
