import { GraduationCap, Plus, Search } from "lucide-react";
import { ApiExportLink } from "@/components/api-actions";
import { ListFilters } from "@/components/list-filters";
import { DataTable } from "@/components/portal-components";
import { ButtonLink, MetricCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { getStaffEnrollments } from "@/lib/data/staff";
import { buildQueryString, firstParam, matchesQuery, type PageSearchParams } from "@/lib/search-params";
import { portalPath } from "@/lib/portal-path";

export default async function StaffEnrollmentsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const enrollmentRequestPath = await portalPath("/staff/enrollment-requests/new");
  const enrollmentsBase = await portalPath("/staff/enrollments");
  const raw = await searchParams;
  const q = firstParam(raw.q);
  const status = firstParam(raw.status);
  const enrollments = await getStaffEnrollments();
  const filtered = enrollments.filter((item) => matchesQuery(q, item.id, item.student, item.course, item.batch) && (!status || item.status === status));
  const active = enrollments.filter((item) => item.status === "Active").length;
  const expired = enrollments.filter((item) => item.status === "Expired").length;
  const exportQuery = buildQueryString({ q, status });

  return (
    <>
      <PageHeader eyebrow="Access overview" title="Enrollments" description="View enrollment status and create requests. Financial approval and access override remain outside this role." actions={<><ApiExportLink href={`/api/v1/staff/enrollments/export${exportQuery}`} label="Export" /><ButtonLink href={enrollmentRequestPath}><Plus className="h-4 w-4" />Enrollment request</ButtonLink></>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Active" value={String(active)} icon={GraduationCap} tone="green" />
        <MetricCard label="All enrollments" value={String(enrollments.length)} icon={Plus} tone="blue" />
        <MetricCard label="Expired" value={String(expired)} icon={Search} tone="slate" />
      </div>
      <Panel className="mt-6">
        <ListFilters
          searchValue={q}
          searchPlaceholder="Search student, course or batch"
          resetHref={enrollmentsBase}
          fields={[{ name: "status", label: "Enrollment status", value: status, options: [{ value: "", label: "All statuses" }, { value: "Active", label: "Active" }, { value: "Pending", label: "Pending" }, { value: "Paused", label: "Paused" }, { value: "Expired", label: "Expired" }] }]}
        />
        <div className="mt-5"><DataTable rowKey="id" rows={filtered.map((item) => ({ ...item, access: item.accessUntil })) as unknown as Record<string, unknown>[]} columns={[{ key: "id", label: "Enrollment" }, { key: "student", label: "Student" }, { key: "course", label: "Course" }, { key: "batch", label: "Batch" }, { key: "access", label: "Access until" }, { key: "status", label: "Status", render: (row) => <StatusBadge status={String(row.status)} /> }]} /></div>
      </Panel>
    </>
  );
}
