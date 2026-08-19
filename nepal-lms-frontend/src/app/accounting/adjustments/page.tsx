import { AlertTriangle, ArrowDownUp, Plus } from "lucide-react";
import { ListFilters } from "@/components/list-filters";
import { DataTable } from "@/components/portal-components";
import { AlertBox, ButtonLink, MetricCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { getAccountingAdjustments } from "@/lib/data/accounting";
import { firstParam, matchesQuery, type PageSearchParams } from "@/lib/search-params";
import { formatNpr } from "@/lib/utils";

export default async function AccountingAdjustmentsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const raw = await searchParams;
  const q = firstParam(raw.q);
  const status = firstParam(raw.status);
  const type = firstParam(raw.type);
  const data = await getAccountingAdjustments();
  const types = [...new Set(data.items.map((item) => item.type))].sort();
  const filtered = data.items.filter((item) => matchesQuery(q, item.id, item.payment, item.student, item.reason) && (!status || item.status === status) && (!type || item.type === type));

  return (
    <>
      <PageHeader eyebrow="Financial corrections" title="Adjustments & Refunds" description="Every refund, reversal and credit requires explicit authorization and a permanent reason." actions={<ButtonLink href="/accounting/adjustments/new"><Plus className="h-4 w-4" />New adjustment</ButtonLink>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Pending review" value={String(data.metrics.pending)} icon={AlertTriangle} tone="amber" />
        <MetricCard label="Completed this month" value={String(data.metrics.completedMonth)} icon={ArrowDownUp} tone="blue" />
        <MetricCard label="Refunded this month" value={formatNpr(data.metrics.refundedMonthNpr)} icon={ArrowDownUp} tone="violet" />
      </div>
      <AlertBox title="Adjustments never delete the original payment" tone="warning"><p>The original payment, receipt and enrollment history remain traceable. A separate audited financial action records the correction.</p></AlertBox>
      <Panel className="mt-6">
        <ListFilters
          searchValue={q}
          searchPlaceholder="Search adjustment, payment or student"
          resetHref="/accounting/adjustments"
          fields={[
            { name: "type", label: "Adjustment type", value: type, options: [{ value: "", label: "All types" }, ...types.map((item) => ({ value: item, label: item }))] },
            { name: "status", label: "Adjustment status", value: status, options: [{ value: "", label: "All statuses" }, { value: "Pending", label: "Pending" }, { value: "Completed", label: "Completed" }, { value: "Rejected", label: "Rejected" }] },
          ]}
        />
        <div className="mt-5"><DataTable rowKey="id" rows={filtered as unknown as Record<string, unknown>[]} columns={[{ key: "id", label: "Adjustment" }, { key: "payment", label: "Payment" }, { key: "student", label: "Student" }, { key: "type", label: "Type" }, { key: "amount", label: "Amount" }, { key: "reason", label: "Reason" }, { key: "date", label: "Date" }, { key: "status", label: "Status", render: (row) => <StatusBadge status={String(row.status)} /> }]} /></div>
      </Panel>
    </>
  );
}
