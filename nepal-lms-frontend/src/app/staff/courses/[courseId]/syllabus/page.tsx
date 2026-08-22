import { SyllabusBuilder } from "@/components/admin/syllabus-builder";
import { PageHeader } from "@/components/ui";
import { getCourseSyllabus } from "@/lib/data/admin";

export default async function StaffCourseSyllabusPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const syllabus = await getCourseSyllabus(courseId, "/api/v1/staff/courses");

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Course syllabus"
        description="Modules and lessons shown on the student's course page. Reordering keeps existing progress intact."
      />
      <SyllabusBuilder
        courseId={syllabus.courseId}
        courseTitle={syllabus.courseTitle}
        initialModules={syllabus.modules}
        endpointBase="/api/v1/staff/courses"
      />
    </>
  );
}
