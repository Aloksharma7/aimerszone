import Link from "next/link";
import { CalendarDays, Plus, Users } from "lucide-react";
import { ApiExportLink } from "@/components/api-actions";
import { ListFilters } from "@/components/list-filters";
import { DataTable } from "@/components/portal-components";
import { ButtonLink, MetricCard, PageHeader, Panel, ProgressBar, StatusBadge } from "@/components/ui";
import { getAdminBatches } from "@/lib/data/admin";
import { buildQueryString, firstParam, matchesQuery, type PageSearchParams } from "@/lib/search-params";

export default async function AdminBatchesPage({ searchParams }: { searchParams: PageSearchParams }) {
  const raw = await searchParams;
  const q = firstParam(raw.q);
  const status = firstParam(raw.status);
  const batches = await getAdminBatches();
  const students = batches.reduce((sum, batch) => sum + batch.students, 0);
  const capacity = batches.reduce((sum, batch) => sum + batch.capacity, 0);
  const filtered = batches.filter((batch) => matchesQuery(q, batch.id, batch.name, batch.course, batch.teacher, batch.schedule) && (!status || batch.status === status));
  const rows = filtered.map((batch) => ({ ...batch, capacityUse: `${batch.students}/${batch.capacity}`, capacityPercent: batch.capacity ? Math.round(batch.students / batch.capacity * 100) : 0 }));
  const exportQuery = buildQueryString({ q, status });

  return (
    <>
      <PageHeader eyebrow="Learning operations" title="Batches" description="Manage scheduled course delivery, teacher assignments, capacity, enrollment windows and provider readiness." actions={<><ApiExportLink href={`/api/v1/admin/batches/export${exportQuery}`} label="Export" /><ButtonLink href="/admin/batches/new"><Plus className="h-4 w-4" />New batch</ButtonLink></>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active and upcoming" value={String(batches.filter((batch) => ["Open", "Ongoing", "Upcoming"].includes(batch.status)).length)} detail="Published delivery records" icon={CalendarDays} tone="green" />
        <MetricCard label="Draft batches" value={String(batches.filter((batch) => batch.status === "Draft").length)} detail="Require launch information" icon={CalendarDays} tone="amber" />
        <MetricCard label="Enrolled learners" value={students.toLocaleString()} detail="Across listed batches" icon={Users} tone="blue" />
        <MetricCard label="Average capacity" value={`${capacity ? Math.round(students / capacity * 100) : 0}%`} detail="Listed batches" icon={Users} tone="violet" />
      </div>
      <Panel className="mt-6">
        <ListFilters searchValue={q} searchPlaceholder="Search batch, course or teacher" resetHref="/admin/batches" fields={[{ name: "status", label: "Batch status", value: status, options: [{ value: "", label: "All statuses" }, { value: "Open", label: "Open" }, { value: "Ongoing", label: "Ongoing" }, { value: "Upcoming", label: "Upcoming" }, { value: "Draft", label: "Draft" }, { value: "Closed", label: "Closed" }] }]} />
        <div className="mt-5"><DataTable rowKey="id" rows={rows as unknown as Record<string, unknown>[]} columns={[{ key: "name", label: "Batch", render: (row) => <div><Link href={`/admin/batches/${String(row.id)}`} className="font-bold text-brand-700 hover:text-brand-900">{String(row.name)}</Link><p className="mt-1 text-xs text-slate-500">{String(row.course)}</p></div> }, { key: "teacher", label: "Teacher" }, { key: "schedule", label: "Schedule" }, { key: "capacityUse", label: "Capacity", render: (row) => <div className="min-w-28"><p className="mb-2 text-xs font-semibold text-slate-700">{String(row.capacityUse)}</p><ProgressBar value={Number(row.capacityPercent)} showValue={false} compact /></div> }, { key: "startDate", label: "Start" }, { key: "status", label: "Status", render: (row) => <StatusBadge status={String(row.status)} /> }]} /></div>
      </Panel>
    </>
  );
}
