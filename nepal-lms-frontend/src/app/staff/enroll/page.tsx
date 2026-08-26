import { EnrollStudentForm, type FoundStudent } from "@/components/staff/enroll-student-form";
import { ButtonLink, PageHeader } from "@/components/ui";
import { getStaffCourses, getStaffStudent } from "@/lib/data/staff";
import { portalPath } from "@/lib/portal-path";

export default async function StaffEnrollPage({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const [{ student: studentId }, courses, base, submissionsPath] = await Promise.all([
    searchParams,
    getStaffCourses(),
    portalPath("/staff/students"),
    portalPath("/staff/payment-submissions"),
  ]);

  let initialStudent: FoundStudent | null = null;
  if (studentId) {
    const found = await getStaffStudent(studentId);
    if (found) initialStudent = { id: found.id, name: found.name, mobile: found.phone, email: found.email ?? null, studentCode: null };
  }

  return (
    <>
      <PageHeader
        back={{ href: base, label: "All students" }}
        eyebrow="Enroll a student"
        title="Find or add the student, then record their payment"
        description="One flow: search for an existing student or create a new account, then attach the payment they made and its proof — exactly what happens when a student pays for themselves."
        actions={<ButtonLink href={base} variant="outline">Cancel</ButtonLink>}
      />
      <EnrollStudentForm courses={courses} redirectTo={submissionsPath} initialStudent={initialStudent} />
    </>
  );
}
