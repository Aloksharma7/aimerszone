import { notFound } from "next/navigation";
import { CourseWorkspaceHeader } from "@/components/course-workspace";
import { CompactTestCard } from "@/components/portal-components";
import { EmptyState, Panel } from "@/components/ui";
import { getStudentEnrollment, getStudentTests } from "@/lib/data/student";

export default async function CourseTestsPage({ params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await params;
  const enrollment = await getStudentEnrollment(enrollmentId);
  if (!enrollment) notFound();
  const tests = await getStudentTests(enrollment.id);
  return <><CourseWorkspaceHeader enrollmentId={enrollment.id} course={enrollment.course} progress={enrollment.progress} accessExpiry={enrollment.accessExpiry} /><Panel><h1 className="text-xl font-bold text-slate-950">Course tests</h1><p className="mt-1 text-sm text-slate-500">Availability, attempts and result-release status remain clear.</p>{tests.length ? <div className="mt-5 space-y-3">{tests.map((test) => <CompactTestCard key={test.id} test={test} href={test.status === "Available" ? `/student/tests/${test.id}` : test.status === "Completed" ? `/student/tests/${test.id}` : "/student/tests"} />)}</div> : <div className="mt-5"><EmptyState title="No tests published" description="Published assessments for this course will appear here." /></div>}</Panel></>;
}
