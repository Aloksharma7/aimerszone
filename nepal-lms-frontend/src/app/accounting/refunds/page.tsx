import { AlertTriangle, CheckCircle2, Clock3, Plus } from "lucide-react";
import { ListFilters } from "@/components/list-filters";
import { DataTable } from "@/components/portal-components";
import { CompleteRefundButton } from "@/components/shared/audited-actions";
import { AlertBox, ButtonLink, MetricCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { getAccountingRefunds } from "@/lib/data/accounting";
import { portalPath } from "@/lib/portal-path";
import { firstParam, matchesQuery, type PageSearchParams } from "@/lib/search-params";
import { formatNpr } from "@/lib/utils";

export default async function AccountingRefundsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const raw = await searchParams;
  const q = firstParam(raw.q);
  const status = firstParam(raw.status);
  const data = await getAccountingRefunds();
  const filtered = data.items.filter((item) => matchesQuery(q, item.id, item.payment, item.student, item.reason) && (!status || item.status === status));
  const [base, adjustmentsPath, newPath] = await Promise.all([portalPath("/accounting/refunds"), portalPath("/accounting/adjustments"), portalPath("/accounting/refunds/new")]);

  return (
    <>
      <PageHeader
        eyebrow="Refund control"
        title="Refund requests"
        description="Review policy eligibility and record approved refunds without modifying the original payment record."
        actions={<>
          <ButtonLink href={adjustmentsPath} variant="outline">View all adjustments</ButtonLink>
          <ButtonLink href={newPath}><Plus className="h-4 w-4" />New refund</ButtonLink>
        </>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Pending review" value={String(data.metrics.pending)} detail="Requires policy verification" icon={Clock3} tone="amber" />
        <MetricCard label="Completed this month" value={String(data.metrics.completedMonth)} detail={formatNpr(data.metrics.completedAmountNpr)} icon={CheckCircle2} tone="green" />
        <MetricCard label="Policy exceptions" value={String(data.metrics.exceptions)} detail="Administrator review needed" icon={AlertTriangle} tone="violet" />
      </div>
      <div className="mt-6"><AlertBox title="A refund is a separate audited action" tone="warning"><p>The production API keeps the approved payment and receipt history intact, records the reason and updates access only through an authorized transaction.</p></AlertBox></div>
      <Panel className="mt-6">
        <ListFilters searchValue={q} searchPlaceholder="Search refund, payment or student" resetHref={base} fields={[{ name: "status", label: "Refund status", value: status, options: [{ value: "", label: "All statuses" }, { value: "Pending", label: "Pending" }, { value: "Completed", label: "Completed" }, { value: "Rejected", label: "Rejected" }] }]} />
        <div className="mt-5">
          <DataTable
            rowKey="id"
            rows={filtered as unknown as Record<string, unknown>[]}
            columns={[
              { key: "id", label: "Refund" },
              { key: "payment", label: "Payment" },
              { key: "student", label: "Student" },
              { key: "amount", label: "Amount" },
              { key: "reason", label: "Reason" },
              { key: "requested", label: "Requested" },
              { key: "status", label: "Status", render: (row) => <StatusBadge status={String(row.status)} /> },
              {
                key: "actions",
                label: "Payout",
                render: (row) => (row.status === "Pending" ? <CompleteRefundButton refundId={String(row.id)} /> : <span className="text-sm text-slate-400">—</span>),
              },
            ]}
          />
        </div>
      </Panel>
    </>
  );
}
