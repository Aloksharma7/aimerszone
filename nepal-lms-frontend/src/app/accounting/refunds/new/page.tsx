import { AccountingRefundForm } from "@/components/accounting/refund-form";
import { PageHeader } from "@/components/ui";

export default function NewAccountingRefundPage() {
  return (
    <>
      <PageHeader eyebrow="Refund control" title="New refund request" description="Find the approved payment, enter the refund amount and reason. Recording the actual payout is a separate step once the money has left the account." />
      <AccountingRefundForm />
    </>
  );
}
