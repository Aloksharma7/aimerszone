import { PaymentWizard } from "@/components/payment-wizard";
import { PageHeader } from "@/components/ui";
import { getPublicCourses } from "@/lib/data/public";

export default async function NewPaymentPage({ searchParams }: { searchParams: Promise<{ course?: string; batch?: string }> }) {
  const [{ course, batch }, courses] = await Promise.all([searchParams, getPublicCourses()]);
  return <><PageHeader back={{ href: "/student/payments", label: "All payments" }} eyebrow="New payment" title="Submit payment proof" description="Follow the steps carefully. The batch, expected amount and available payment methods are confirmed by the server." /><PaymentWizard courses={courses} initialCourseSlug={course} initialBatchId={batch} /></>;
}
