import { notFound } from "next/navigation";
import { CourseWorkspaceHeader } from "@/components/course-workspace";
import { ResourceLibrary } from "@/components/student/resource-library";
import { getStudentEnrollment, getStudentResources, getStudentSyllabus } from "@/lib/data/student";

export default async function CourseResourcesPage({ params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await params;
  const enrollment = await getStudentEnrollment(enrollmentId);
  if (!enrollment) notFound();
  const [resources, modules] = await Promise.all([getStudentResources(enrollment.id), getStudentSyllabus(enrollment.id)]);
  return <><CourseWorkspaceHeader enrollmentId={enrollment.id} course={enrollment.course} progress={enrollment.progress} accessExpiry={enrollment.accessExpiry} /><ResourceLibrary resources={resources} modules={modules} /></>;
}
