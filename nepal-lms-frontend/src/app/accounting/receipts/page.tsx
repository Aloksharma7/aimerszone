import { ReceiptText } from "lucide-react";
import { ApiExportLink } from "@/components/api-actions";
import { ListFilters } from "@/components/list-filters";
import { DataTable } from "@/components/portal-components";
import { MetricCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { getAccountingReceipts } from "@/lib/data/accounting";
import { portalPath } from "@/lib/portal-path";
import { buildQueryString, firstParam, matchesQuery, type PageSearchParams } from "@/lib/search-params";

export default async function AccountingReceiptsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const raw = await searchParams;
  const q = firstParam(raw.q);
  const status = firstParam(raw.status);
  const data = await getAccountingReceipts();
  const filtered = data.items.filter((item) => matchesQuery(q, item.id, item.payment, item.student, item.course) && (!status || item.status === status));
  const exportQuery = buildQueryString({ q, status });
  const base = await portalPath("/accounting/receipts");

  return (
    <>
      <PageHeader eyebrow="Financial documents" title="Receipts" description="Receipts are generated from approved authoritative payment records." actions={<ApiExportLink href={`/api/v1/accounting/receipts/export${exportQuery}`} label="Export register" />} />
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Issued today" value={String(data.metrics.today)} icon={ReceiptText} tone="green" />
        <MetricCard label="This month" value={String(data.metrics.month)} icon={ReceiptText} tone="blue" />
        <MetricCard label="Adjusted" value={String(data.metrics.adjusted)} icon={ReceiptText} tone="amber" />
      </div>
      <Panel className="mt-6">
        <ListFilters searchValue={q} searchPlaceholder="Search receipt, payment or student" resetHref={base} fields={[{ name: "status", label: "Receipt status", value: status, options: [{ value: "", label: "All statuses" }, { value: "Issued", label: "Issued" }, { value: "Adjusted", label: "Adjusted" }, { value: "Voided", label: "Voided" }] }]} />
        <div className="mt-5"><DataTable rowKey="id" rows={filtered as unknown as Record<string, unknown>[]} columns={[{ key: "id", label: "Receipt" }, { key: "payment", label: "Payment" }, { key: "student", label: "Student" }, { key: "course", label: "Course" }, { key: "amount", label: "Amount" }, { key: "issued", label: "Issued" }, { key: "status", label: "Status", render: (row) => <StatusBadge status={String(row.status)} /> }]} /></div>
      </Panel>
    </>
  );
}
