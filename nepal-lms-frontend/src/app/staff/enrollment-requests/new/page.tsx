import { Wallet } from "lucide-react";
import { EnrollmentRequestForm } from "@/components/staff/operations-forms";
import { AlertBox, ButtonLink, PageHeader } from "@/components/ui";
import { getStaffCourses, getStaffStudents } from "@/lib/data/staff";
import { portalPath } from "@/lib/portal-path";

export default async function EnrollmentRequestPage() {
  const [students,courses]=await Promise.all([getStaffStudents(),getStaffCourses()]);
  const enrollmentsPath = await portalPath("/staff/enrollments");
  const paymentSubmissionPath = await portalPath("/staff/payment-submissions/new");
  return (
    <>
      <PageHeader
        back={{ href: enrollmentsPath, label: "All enrollments" }}
        eyebrow="Enrollment request"
        title="Request a scholarship, transfer or waiver"
        description="For a genuine fee waiver only — the student is not paying for this seat. It grants no access by itself; a Super Admin must separately approve it."
        actions={<ButtonLink href={enrollmentsPath} variant="outline">Cancel</ButtonLink>}
      />
      <div className="mb-6">
        <AlertBox title="Did the student actually pay — including over WhatsApp?" tone="warning">
          <p>
            Do not use this form. Submit their payment instead, with whatever evidence you have (a screenshot of the
            WhatsApp confirmation is fine) — that is what puts money on the books and enrolls them automatically once
            approved.
          </p>
          <ButtonLink href={paymentSubmissionPath} variant="outline" className="mt-3">
            <Wallet className="h-4 w-4" />
            Submit their payment instead
          </ButtonLink>
        </AlertBox>
      </div>
      <EnrollmentRequestForm students={students} courses={courses}/>
    </>
  );
}
