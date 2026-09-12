import Link from "next/link";
import { CalendarDays, Plus, Users } from "lucide-react";
import { ApiExportLink } from "@/components/api-actions";
import { ArchivedRowActions } from "@/components/admin/archived-row-actions";
import { ListFilters } from "@/components/list-filters";
import { Pagination } from "@/components/pagination";
import { DataTable } from "@/components/portal-components";
import { ButtonLink, MetricCard, PageHeader, Panel, ProgressBar, StatusBadge } from "@/components/ui";
import { getAdminBatches, getAdminBatchesPage } from "@/lib/data/admin";
import { buildQueryString, firstParam, matchesQuery, pageParam, type PageSearchParams } from "@/lib/search-params";

export default async function AdminBatchesPage({ searchParams }: { searchParams: PageSearchParams }) {
  const raw = await searchParams;
  const q = firstParam(raw.q);
  const status = firstParam(raw.status);
  const page = pageParam(raw);
  const archivedView = status === "archived";
  const [batches, { items: pageBatches, meta }] = await Promise.all([
    getAdminBatches(),
    getAdminBatchesPage({ page, status }),
  ]);
  const students = batches.reduce((sum, batch) => sum + batch.students, 0);
  const capacity = batches.reduce((sum, batch) => sum + batch.capacity, 0);

  // The backend has no text search for this endpoint, so the typed term is
  // matched against whatever page of results is currently on screen.
  const filtered = pageBatches.filter((batch) => matchesQuery(q, batch.id, batch.name, batch.course, batch.teacher, batch.schedule));
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
        <ListFilters searchValue={q} searchPlaceholder="Search batch, course or teacher" resetHref="/admin/batches" fields={[{ name: "status", label: "Batch status", value: status, options: [{ value: "", label: "All statuses" }, { value: "Open", label: "Open" }, { value: "Ongoing", label: "Ongoing" }, { value: "Upcoming", label: "Upcoming" }, { value: "Draft", label: "Draft" }, { value: "Closed", label: "Closed" }, { value: "archived", label: "Archived" }] }]} />
        {archivedView ? (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Archived batches are hidden from every list. Restore one to bring it back, or delete it for good once it has no enrolment or payment history.
          </p>
        ) : null}
        <div className="mt-5">
          <DataTable
            rowKey="id"
            rows={rows as unknown as Record<string, unknown>[]}
            columns={[
              { key: "name", label: "Batch", render: (row) => <div><span className={archivedView ? "font-bold text-slate-700" : ""}>{archivedView ? String(row.name) : <Link href={`/admin/batches/${String(row.id)}`} className="font-bold text-brand-700 hover:text-brand-900">{String(row.name)}</Link>}</span><p className="mt-1 text-xs text-slate-500">{String(row.course)}</p></div> },
              { key: "teacher", label: "Teacher" },
              { key: "schedule", label: "Schedule" },
              { key: "capacityUse", label: "Capacity", render: (row) => <div className="min-w-28"><p className="mb-2 text-xs font-semibold text-slate-700">{String(row.capacityUse)}</p><ProgressBar value={Number(row.capacityPercent)} showValue={false} compact /></div> },
              { key: "startDate", label: "Start" },
              ...(archivedView
                ? [{ key: "actions", label: "", render: (row: Record<string, unknown>) => <ArchivedRowActions kind="batch" id={String(row.id)} name={String(row.name)} /> }]
                : [{ key: "status", label: "Status", render: (row: Record<string, unknown>) => <StatusBadge status={String(row.status)} /> }]),
            ]}
          />
        </div>
        <Pagination meta={meta} buildHref={(target) => `/admin/batches${buildQueryString({ q, status, page: String(target) })}`} />
      </Panel>
    </>
  );
}
