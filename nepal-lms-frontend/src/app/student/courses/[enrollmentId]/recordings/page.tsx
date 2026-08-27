import { notFound } from "next/navigation";
import { CourseWorkspaceHeader } from "@/components/course-workspace";
import { RecordingLibrary } from "@/components/student/recording-library";
import { getStudentEnrollment, getStudentRecordings, getStudentSyllabus } from "@/lib/data/student";

export default async function CourseRecordingsPage({ params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await params;
  const enrollment = await getStudentEnrollment(enrollmentId);
  if (!enrollment) notFound();
  const [recordings, modules] = await Promise.all([getStudentRecordings(enrollment.id), getStudentSyllabus(enrollment.id)]);
  return <><CourseWorkspaceHeader enrollmentId={enrollment.id} course={enrollment.course} progress={enrollment.progress} accessExpiry={enrollment.accessExpiry} /><RecordingLibrary recordings={recordings} modules={modules} /></>;
}
