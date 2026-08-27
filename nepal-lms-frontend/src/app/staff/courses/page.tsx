import Link from "next/link";
import { BookOpen, Layers3, Plus, Users } from "lucide-react";
import { ListFilters } from "@/components/list-filters";
import { Pagination } from "@/components/pagination";
import { DataTable } from "@/components/portal-components";
import { ButtonLink, MetricCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { can } from "@/lib/auth/roles";
import { getSessionUser, requirePermission } from "@/lib/auth/server";
import { getStaffCourses, getStaffCoursesPage } from "@/lib/data/staff";
import { buildQueryString, pageParam, searchTerm, type PageSearchParams } from "@/lib/search-params";
import { formatNpr } from "@/lib/utils";

export default async function StaffCoursesPage({ searchParams }: { searchParams: PageSearchParams }) {
  const user = await getSessionUser("staff");
  if (!user) return null;
  await requirePermission(user, "courses.view");
  const raw = await searchParams;
  const q = searchTerm(raw);
  const page = pageParam(raw);
  const [courses, { items, meta }] = await Promise.all([getStaffCourses(), getStaffCoursesPage({ page, q })]);
  const published = courses.filter((course) => course.published).length;
  const draft = courses.length - published;
  const enrollments = courses.reduce((sum, course) => sum + (course.enrollments || 0), 0);
  const canCreate = can(user, "courses.create");
  const canEdit = can(user, "courses.update");
  const rows = items.map((course) => ({ id: course.id || course.slug, title: course.title, code: course.code, category: course.category, price: course.isFree ? "Free" : formatNpr(course.price), batches: course.batchCount ?? 0, enrollments: course.enrollments ?? 0, status: course.published ? "Published" : "Draft" }));
  return (
    <>
      <PageHeader eyebrow="Catalogue operations" title="Courses" description="Create and maintain the course catalogue used by public pages, batches and enrollments." actions={canCreate ? <ButtonLink href="/staff/courses/new"><Plus className="h-4 w-4" />Add course</ButtonLink> : undefined} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3"><MetricCard label="Published" value={String(published)} detail="Visible when a published batch is available" icon={BookOpen} tone="green" /><MetricCard label="Draft" value={String(draft)} detail="Not visible to students" icon={Layers3} tone="amber" /><MetricCard label="Enrollments" value={String(enrollments)} detail="Across managed courses" icon={Users} tone="blue" /></div>
      <Panel>
        <ListFilters searchValue={q} searchPlaceholder="Search title, code or category" resetHref="/staff/courses" />
        <div className="mt-5"><DataTable rowKey="id" rows={rows as unknown as Record<string, unknown>[]} columns={[{ key: "title", label: "Course", render: (row) => <Link href={`/staff/courses/${encodeURIComponent(String(row.id))}`} className="font-bold text-brand-700 hover:text-brand-900">{String(row.title)}</Link> }, { key: "code", label: "Code" }, { key: "category", label: "Category" }, { key: "price", label: "Price" }, { key: "batches", label: "Batches" }, { key: "enrollments", label: "Enrollments" }, { key: "status", label: "Status", render: (row) => <StatusBadge status={String(row.status)} /> }, { key: "id", label: "Action", render: (row) => <Link href={`/staff/courses/${encodeURIComponent(String(row.id))}`} className="text-sm font-bold text-brand-700 hover:text-brand-900">{canEdit ? "Manage" : "View"}</Link> }]} /></div>
        <Pagination meta={meta} buildHref={(target) => `/staff/courses${buildQueryString({ search: q, page: String(target) })}`} />
      </Panel>
    </>
  );
}
