import { CourseForm } from "@/components/staff/course-form";
import { PageHeader } from "@/components/ui";
import { can } from "@/lib/auth/roles";
import { getSessionUser, requirePermission } from "@/lib/auth/server";
import { getPublicCategories } from "@/lib/data/public";

export default async function NewStaffCoursePage() {
  const user = await getSessionUser("staff");
  if (!user) return null;
  await requirePermission(user, "courses.create");
  const categories = await getPublicCategories();
  return <><PageHeader back={{ href: "/staff/courses", label: "All courses" }} eyebrow="Catalogue operations" title="Add Course" description="Create the reusable course record. Batches, schedules and teacher assignments are managed separately after the course exists." /><CourseForm categories={categories} canPublish={can(user, "courses.publish")} /></>;
}
