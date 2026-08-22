import { notFound } from "next/navigation";
import { ListTree } from "lucide-react";
import { CourseForm } from "@/components/staff/course-form";
import { Badge, ButtonLink, PageHeader } from "@/components/ui";
import { can } from "@/lib/auth/roles";
import { getSessionUser, requirePermission } from "@/lib/auth/server";
import { getPublicCategories } from "@/lib/data/public";
import { getStaffCourse } from "@/lib/data/staff";

export default async function StaffCourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const user = await getSessionUser("staff");
  if (!user) return null;
  await requirePermission(user, "courses.view");
  const [course, categories] = await Promise.all([getStaffCourse(courseId), getPublicCategories()]);
  if (!course) notFound();
  const canEdit = can(user, "courses.update");
  const canManageSyllabus = can(user, "syllabus.manage");
  return <><PageHeader back={{ href: "/staff/courses", label: "All courses" }} eyebrow="Catalogue operations" title={course.title} description={`${course.code} · ${course.category}`} actions={<>{canManageSyllabus ? <ButtonLink href={`/staff/courses/${encodeURIComponent(course.id || course.slug)}/syllabus`} variant="outline"><ListTree className="h-4 w-4" />Syllabus</ButtonLink> : null}<Badge tone={course.published ? "green" : "amber"}>{course.published ? "Published" : "Draft"}</Badge></>} /><CourseForm course={course} categories={categories} canPublish={can(user, "courses.publish")} readOnly={!canEdit} /></>;
}
