import { PaymentWizard } from "@/components/payment-wizard";
import { PageHeader } from "@/components/ui";
import { getPublicCourses } from "@/lib/data/public";

export default async function NewPaymentPage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const [{ course }, courses] = await Promise.all([searchParams, getPublicCourses()]);
  return <><PageHeader back={{ href: "/student/payments", label: "All payments" }} eyebrow="New payment" title="Submit payment proof" description="Follow the steps carefully. Laravel resolves the selected batch, expected amount and available payment methods." /><PaymentWizard courses={courses} initialCourseSlug={course} /></>;
}
