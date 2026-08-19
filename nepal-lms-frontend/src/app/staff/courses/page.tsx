import { BookOpen, Layers3, Plus, Users } from "lucide-react";
import { CourseManagerTable } from "@/components/staff/course-manager-table";
import { ButtonLink, MetricCard, PageHeader } from "@/components/ui";
import { can } from "@/lib/auth/roles";
import { getSessionUser, requirePermission } from "@/lib/auth/server";
import { getStaffCourses } from "@/lib/data/staff";

export default async function StaffCoursesPage() {
  const user = await getSessionUser("staff");
  if (!user) return null;
  await requirePermission(user, "courses.view");
  const courses = await getStaffCourses();
  const published = courses.filter((course) => course.published).length;
  const draft = courses.length - published;
  const enrollments = courses.reduce((sum, course) => sum + (course.enrollments || 0), 0);
  const canCreate = can(user, "courses.create");
  const canEdit = can(user, "courses.update");
  return (
    <>
      <PageHeader eyebrow="Catalogue operations" title="Courses" description="Create and maintain the course catalogue used by public pages, batches and enrollments." actions={canCreate ? <ButtonLink href="/staff/courses/new"><Plus className="h-4 w-4" />Add course</ButtonLink> : undefined} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3"><MetricCard label="Published" value={String(published)} detail="Visible when a published batch is available" icon={BookOpen} tone="green" /><MetricCard label="Draft" value={String(draft)} detail="Not visible to students" icon={Layers3} tone="amber" /><MetricCard label="Enrollments" value={String(enrollments)} detail="Across managed courses" icon={Users} tone="blue" /></div>
      <CourseManagerTable courses={courses} canEdit={canEdit} />
    </>
  );
}
