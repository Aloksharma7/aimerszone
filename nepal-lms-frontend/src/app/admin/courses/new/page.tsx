import { ArrowLeft } from "lucide-react";
import { CourseForm } from "@/components/staff/course-form";
import { ButtonLink, PageHeader } from "@/components/ui";
import { getPublicCategories } from "@/lib/data/public";

export default async function NewCoursePage() {
  const categories = await getPublicCategories();
  return <><PageHeader eyebrow="Catalogue management" title="Create a new course" description="Define reusable course information before creating the batches that deliver it." actions={<ButtonLink href="/admin/courses" variant="outline"><ArrowLeft className="h-4 w-4"/>Back to courses</ButtonLink>}/><CourseForm categories={categories} canPublish endpointBase="/api/v1/admin/courses" returnBase="/admin/courses"/></>;
}
