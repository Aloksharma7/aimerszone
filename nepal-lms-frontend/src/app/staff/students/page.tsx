import Link from "next/link";
import { Filter, Plus, Users } from "lucide-react";
import { ApiExportLink } from "@/components/api-actions";
import { ListFilters } from "@/components/list-filters";
import { Pagination } from "@/components/pagination";
import { DataTable } from "@/components/portal-components";
import { ButtonLink, MetricCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { getStaffStudents, getStaffStudentsPage } from "@/lib/data/staff";
import { portalPath } from "@/lib/portal-path";
import { buildQueryString, firstParam, pageParam, searchTerm, type PageSearchParams } from "@/lib/search-params";

export default async function StaffStudentsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const raw = await searchParams;
  const q = searchTerm(raw);
  const status = firstParam(raw.status);
  const page = pageParam(raw);
  const [students, { items, meta }, base, enrollPath] = await Promise.all([
    getStaffStudents(),
    getStaffStudentsPage({ page, q, status }),
    portalPath("/staff/students"),
    portalPath("/staff/enroll"),
  ]);
  const active = students.filter((item) => item.status === "Active").length;
  const pending = students.filter((item) => item.status === "Pending").length;
  const exportQuery = buildQueryString({ q, status });

  return (
    <>
      <PageHeader eyebrow="Student management" title="Students" description="Create accounts, correct permitted identity fields and assist with access." actions={<><ApiExportLink href={`/api/v1/staff/students/export${exportQuery}`} label="Export" /><ButtonLink href={`${base}/new`} variant="outline">Add account only</ButtonLink><ButtonLink href={enrollPath}><Plus className="h-4 w-4" />Enroll a student</ButtonLink></>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total records" value={String(students.length)} icon={Users} tone="blue" />
        <MetricCard label="Active" value={String(active)} icon={Filter} tone="green" />
        <MetricCard label="Pending" value={String(pending)} icon={Plus} tone="amber" />
      </div>
      <Panel className="mt-6">
        <ListFilters
          searchValue={q}
          searchPlaceholder="Search name, phone or ID"
          resetHref={base}
          fields={[{ name: "status", label: "Student status", value: status, options: [{ value: "", label: "All statuses" }, { value: "Active", label: "Active" }, { value: "Pending", label: "Pending" }, { value: "Suspended", label: "Suspended" }] }]}
        />
        <div className="mt-5"><DataTable rowKey="id" actions rows={items.map((item) => ({ ...item, href: `${base}/${encodeURIComponent(String(item.id))}` })) as unknown as Record<string, unknown>[]} columns={[{ key: "name", label: "Student", render: (row) => <Link href={`${base}/${encodeURIComponent(String(row.id))}`} className="font-bold text-brand-700 hover:text-brand-900">{String(row.name)}</Link> }, { key: "id", label: "Student ID", render: (row) => String(row.studentCode || row.id) }, { key: "phone", label: "Phone" }, { key: "course", label: "Current / Intended Course" }, { key: "joined", label: "Created" }, { key: "status", label: "Status", render: (row) => <StatusBadge status={String(row.status)} /> }]} /></div>
        <Pagination meta={meta} buildHref={(target) => `${base}${buildQueryString({ search: q, status, page: String(target) })}`} />
      </Panel>
    </>
  );
}
