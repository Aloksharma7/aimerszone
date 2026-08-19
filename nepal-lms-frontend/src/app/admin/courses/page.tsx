import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import { ApiExportLink } from "@/components/api-actions";
import { ListFilters } from "@/components/list-filters";
import { DataTable } from "@/components/portal-components";
import { ButtonLink, MetricCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { getAdminCourses } from "@/lib/data/admin";
import { buildQueryString, firstParam, matchesQuery, type PageSearchParams } from "@/lib/search-params";
import { formatNpr } from "@/lib/utils";

export default async function AdminCoursesPage({ searchParams }: { searchParams: PageSearchParams }) {
  const raw = await searchParams;
  const q = firstParam(raw.q);
  const category = firstParam(raw.category);
  const status = firstParam(raw.status);
  const courses = await getAdminCourses();
  const categories = [...new Set(courses.map((course) => course.category))].sort();
  const filtered = courses.filter((course) => {
    const courseStatus = course.published ? "Published" : "Draft";
    return matchesQuery(q, course.id, course.slug, course.code, course.title, course.category) && (!category || course.category === category) && (!status || courseStatus === status);
  });
  const rows = filtered.map((course) => ({ id: course.id || course.slug, code: course.code, title: course.title, category: course.category, batches: course.batchCount ?? 0, price: course.isFree ? "Free" : formatNpr(course.price), status: course.published ? "Published" : "Draft" }));
  const exportQuery = buildQueryString({ q, category, status });

  return (
    <>
      <PageHeader eyebrow="Catalogue management" title="Courses" description="Manage reusable academic content separately from scheduled batches." actions={<><ApiExportLink href={`/api/v1/admin/courses/export${exportQuery}`} label="Export" /><ButtonLink href="/admin/courses/new"><Plus className="h-4 w-4" />New course</ButtonLink></>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Published" value={String(courses.filter((course) => course.published).length)} icon={BookOpen} tone="green" />
        <MetricCard label="Draft" value={String(courses.filter((course) => !course.published).length)} icon={BookOpen} tone="amber" />
        <MetricCard label="Categories" value={String(categories.length)} icon={BookOpen} tone="blue" />
      </div>
      <Panel className="mt-6">
        <ListFilters
          searchValue={q}
          searchPlaceholder="Search title, code or category"
          resetHref="/admin/courses"
          fields={[
            { name: "category", label: "Course category", value: category, options: [{ value: "", label: "All categories" }, ...categories.map((item) => ({ value: item, label: item }))] },
            { name: "status", label: "Publication status", value: status, options: [{ value: "", label: "All statuses" }, { value: "Published", label: "Published" }, { value: "Draft", label: "Draft" }] },
          ]}
        />
        <div className="mt-5"><DataTable rowKey="id" rows={rows as unknown as Record<string, unknown>[]} columns={[{ key: "code", label: "Code" }, { key: "title", label: "Course", render: (row) => <Link href={`/admin/courses/${String(row.id)}`} className="font-bold text-brand-700 hover:text-brand-900">{String(row.title)}</Link> }, { key: "category", label: "Category" }, { key: "batches", label: "Batches" }, { key: "price", label: "Default price" }, { key: "status", label: "Status", render: (row) => <StatusBadge status={String(row.status)} /> }]} /></div>
      </Panel>
    </>
  );
}
