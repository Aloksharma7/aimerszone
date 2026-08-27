import { FileText } from "lucide-react";
import { Pagination } from "@/components/pagination";
import { ResourceLibrary } from "@/components/student/resource-library";
import { MetricCard, PageHeader } from "@/components/ui";
import { getSessionUser, requirePermission } from "@/lib/auth/server";
import { getStudentResources, getStudentResourcesPage } from "@/lib/data/student";
import { buildQueryString, pageParam, type PageSearchParams } from "@/lib/search-params";

export default async function StudentResourcesPage({ searchParams }: { searchParams: PageSearchParams }) {
  const user = await getSessionUser("student");
  if (user) await requirePermission(user, "resources.view");
  const raw = await searchParams;
  const page = pageParam(raw);
  const [resources, { items, meta }] = await Promise.all([getStudentResources(), getStudentResourcesPage({ page })]);
  const pdfs = resources.filter((item) => item.type === "PDF").length;
  const courses = new Set(resources.map((item) => item.course).filter(Boolean)).size;
  return (
    <>
      <PageHeader eyebrow="Learning library" title="PDFs & Resources" description="Find protected notes, formula sheets, practice sets and course documents without opening each course separately." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <MetricCard label="Available files" value={String(resources.length)} detail="From active enrollments" icon={FileText} tone="blue" />
        <MetricCard label="PDF documents" value={String(pdfs)} detail="Ready for authorised download" icon={FileText} tone="violet" />
        <MetricCard label="Courses covered" value={String(courses)} detail="Current learning access" icon={FileText} tone="green" />
      </div>
      <ResourceLibrary resources={items} global />
      <Pagination meta={meta} buildHref={(target) => `/student/resources${buildQueryString({ page: String(target) })}`} />
    </>
  );
}
