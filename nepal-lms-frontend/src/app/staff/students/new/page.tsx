import { CreateStudentForm } from "@/components/staff/operations-forms";
import { ButtonLink, PageHeader } from "@/components/ui";

export default function NewStudentPage() {
  return <><PageHeader back={{ href: "/staff/students", label: "All students" }} eyebrow="Student account" title="Create student" description="Collect only the minimum approved identity and contact information." actions={<ButtonLink href="/staff/students" variant="outline">Cancel</ButtonLink>}/><CreateStudentForm/></>;
}
