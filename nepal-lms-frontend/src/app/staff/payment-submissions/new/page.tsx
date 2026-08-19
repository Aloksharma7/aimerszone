import { PaymentSubmissionForm } from "@/components/staff/operations-forms";
import { ButtonLink, PageHeader } from "@/components/ui";
import { getStaffCourses, getStaffStudents } from "@/lib/data/staff";
import { portalPath } from "@/lib/portal-path";

export default async function NewStaffPaymentSubmissionPage() {
  const [students, courses, base] = await Promise.all([getStaffStudents(), getStaffCourses(), portalPath("/staff/payment-submissions")]);
  return <><PageHeader back={{ href: base, label: "All submissions" }} eyebrow="Payment capture" title="New payment submission" description="Use details supplied by the student. Only submit evidence you have already verified — access activates immediately, unless the submission gets flagged for a second reviewer." actions={<ButtonLink href={base} variant="outline">Cancel</ButtonLink>}/><PaymentSubmissionForm students={students} courses={courses}/></>;
}
