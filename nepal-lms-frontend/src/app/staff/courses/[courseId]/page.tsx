import { notFound } from "next/navigation";
import { CourseForm } from "@/components/staff/course-form";
import { Badge, PageHeader } from "@/components/ui";
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
  return <><PageHeader back={{ href: "/staff/courses", label: "All courses" }} eyebrow="Catalogue operations" title={course.title} description={`${course.code} · ${course.category}`} actions={<Badge tone={course.published ? "green" : "amber"}>{course.published ? "Published" : "Draft"}</Badge>} /><CourseForm course={course} categories={categories} canPublish={can(user, "courses.publish")} readOnly={!canEdit} /></>;
}
