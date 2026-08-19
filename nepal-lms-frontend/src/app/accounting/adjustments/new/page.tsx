import { AccountingAdjustmentForm, type PaymentSummary } from "@/components/accounting/adjustment-form";
import { PageHeader } from "@/components/ui";
import { getSessionUser, requirePermission } from "@/lib/auth/server";
import { getAccountingPayment } from "@/lib/data/accounting";
import { firstParam, type PageSearchParams } from "@/lib/search-params";

export default async function NewAccountingAdjustmentPage({ searchParams }: { searchParams: PageSearchParams }) {
  const user = await getSessionUser("staff");
  if (user) await requirePermission(user, "payments.adjust");

  const raw = await searchParams;
  const paymentId = firstParam(raw.payment_id);
  let initialPayment: PaymentSummary | null = null;

  if (paymentId) {
    const payment = await getAccountingPayment(paymentId);
    if (payment) {
      initialPayment = { id: payment.id, studentName: payment.student.name, courseTitle: payment.course, amountNpr: payment.amountPaid, status: payment.status };
    }
  }

  return <><PageHeader back={{ href: "/accounting/adjustments", label: "All adjustments" }} eyebrow="Financial corrections" title="New adjustment" description="Create a separate, auditable financial action against an authoritative payment record." /><AccountingAdjustmentForm initialPayment={initialPayment} /></>;
}
