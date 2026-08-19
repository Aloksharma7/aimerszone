import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, ListTree } from "lucide-react";
import { ArchiveControl } from "@/components/admin/archive-control";
import { CourseForm } from "@/components/staff/course-form";
import { ButtonLink, PageHeader, StatusBadge } from "@/components/ui";
import { getAdminCourse } from "@/lib/data/admin";
import { getPublicCategories } from "@/lib/data/public";

export default async function CourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const [course, categories] = await Promise.all([getAdminCourse(courseId), getPublicCategories()]);
  if (!course) notFound();
  return <><PageHeader eyebrow={`Catalogue management · ${course.code}`} title={course.title} description="Edit reusable catalogue content and publishing rules. Batch delivery remains separate." actions={<><StatusBadge status={course.published?"Published":"Draft"}/><ButtonLink href="/admin/courses" variant="outline"><ArrowLeft className="h-4 w-4"/>Courses</ButtonLink><ButtonLink href={`/admin/courses/${encodeURIComponent(course.id || course.slug)}/syllabus`} variant="outline"><ListTree className="h-4 w-4"/>Syllabus</ButtonLink><ButtonLink href={`/courses/${course.slug}`} variant="outline"><ExternalLink className="h-4 w-4"/>Public page</ButtonLink></>}/><CourseForm course={course} categories={categories} canPublish endpointBase="/api/v1/admin/courses" returnBase="/admin/courses"/><div className="mt-6"><ArchiveControl kind="course" id={course.id || course.slug} name={course.title} redirectTo="/admin/courses" slug={course.slug}/></div></>;
}
