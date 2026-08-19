import { EnrollStudentForm } from "@/components/staff/enroll-student-form";
import { ButtonLink, PageHeader } from "@/components/ui";
import { getStaffCourses } from "@/lib/data/staff";
import { portalPath } from "@/lib/portal-path";

export default async function StaffEnrollPage() {
  const [courses, base, submissionsPath] = await Promise.all([
    getStaffCourses(),
    portalPath("/staff/students"),
    portalPath("/staff/payment-submissions"),
  ]);
  return (
    <>
      <PageHeader
        back={{ href: base, label: "All students" }}
        eyebrow="Enroll a student"
        title="Find or add the student, then record their payment"
        description="One flow: search for an existing student or create a new account, then attach the payment they made and its proof — exactly what happens when a student pays for themselves."
        actions={<ButtonLink href={base} variant="outline">Cancel</ButtonLink>}
      />
      <EnrollStudentForm courses={courses} redirectTo={submissionsPath} />
    </>
  );
}
