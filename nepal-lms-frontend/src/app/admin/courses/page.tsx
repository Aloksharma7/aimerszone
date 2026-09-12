import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import { ApiExportLink } from "@/components/api-actions";
import { ArchivedRowActions } from "@/components/admin/archived-row-actions";
import { ListFilters } from "@/components/list-filters";
import { Pagination } from "@/components/pagination";
import { DataTable } from "@/components/portal-components";
import { ButtonLink, MetricCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { getAdminCourses, getAdminCoursesPage } from "@/lib/data/admin";
import { buildQueryString, firstParam, pageParam, type PageSearchParams } from "@/lib/search-params";
import { formatNpr } from "@/lib/utils";

export default async function AdminCoursesPage({ searchParams }: { searchParams: PageSearchParams }) {
  const raw = await searchParams;
  const q = firstParam(raw.q);
  const category = firstParam(raw.category);
  const status = firstParam(raw.status);
  const page = pageParam(raw);
  const archivedView = status === "archived";
  const [courses, { items: pageCourses, meta }] = await Promise.all([
    getAdminCourses(),
    getAdminCoursesPage({ page, q, status }),
  ]);
  const categories = [...new Set(courses.map((course) => course.category))].sort();

  // The category dropdown is built from category names; the backend filters
  // by category id, which is not available at this level, so this one
  // filter is applied to whatever page of results is currently on screen.
  const filtered = pageCourses.filter((course) => !category || course.category === category);
  const rows = filtered.map((course) => ({ id: course.id || course.slug, code: course.code, title: course.title, category: course.category, batches: course.batchCount ?? 0, price: course.isFree ? "Free" : formatNpr(course.price), status: course.published ? "Published" : "Draft", href: archivedView ? undefined : `/admin/courses/${course.id || course.slug}` }));
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
            { name: "status", label: "Publication status", value: status, options: [{ value: "", label: "All statuses" }, { value: "Published", label: "Published" }, { value: "Draft", label: "Draft" }, { value: "archived", label: "Archived" }] },
          ]}
        />
        {archivedView ? (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Archived courses are hidden from the catalogue and every other list. Restore one to bring it back, or delete it for good once it has no enrolment or batch history.
          </p>
        ) : null}
        <div className="mt-5">
          <DataTable
            rowKey="id"
            actions
            rows={rows as unknown as Record<string, unknown>[]}
            columns={[
              { key: "code", label: "Code" },
              { key: "title", label: "Course", render: (row) => archivedView ? <span className="font-bold text-slate-700">{String(row.title)}</span> : <Link href={`/admin/courses/${String(row.id)}`} className="font-bold text-brand-700 hover:text-brand-900">{String(row.title)}</Link> },
              { key: "category", label: "Category" },
              { key: "batches", label: "Batches" },
              { key: "price", label: "Default price" },
              ...(archivedView
                ? [{ key: "actions", label: "", render: (row: Record<string, unknown>) => <ArchivedRowActions kind="course" id={String(row.id)} name={String(row.title)} /> }]
                : [{ key: "status", label: "Status", render: (row: Record<string, unknown>) => <StatusBadge status={String(row.status)} /> }]),
            ]}
          />
        </div>
        <Pagination meta={meta} buildHref={(target) => `/admin/courses${buildQueryString({ q, category, status, page: String(target) })}`} />
      </Panel>
    </>
  );
}
