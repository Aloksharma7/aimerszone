import { AlertCircle, Clock3, WalletCards } from "lucide-react";
import { DataTable } from "@/components/portal-components";
import { ApiExportLink } from "@/components/api-actions";
import { MetricCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { getOutstandingReport } from "@/lib/data/accounting";

export default async function OutstandingReportPage() {
  const data = await getOutstandingReport();
  return <><PageHeader eyebrow="Financial report" title="Outstanding & Exceptions" description="Pending proof, amount mismatch and enrollment intent requiring follow-up." actions={<ApiExportLink href="/api/v1/accounting/reports/outstanding/export" label="Export" />} /><div className="grid gap-4 sm:grid-cols-3"><MetricCard label="Under review" value={String(data.metrics.underReview)} icon={Clock3} tone="blue" /><MetricCard label="Amount mismatch" value={String(data.metrics.mismatches)} icon={AlertCircle} tone="amber" /><MetricCard label="Intent without proof" value={String(data.metrics.intentOnly)} icon={WalletCards} tone="violet" /></div><Panel className="mt-6"><DataTable rowKey="id" rows={data.items as unknown as Record<string, unknown>[]} columns={[{ key: "id", label: "Student ID" }, { key: "student", label: "Student" }, { key: "course", label: "Course" }, { key: "expected", label: "Expected" }, { key: "paid", label: "Submitted" }, { key: "issue", label: "Issue", render: (row) => <StatusBadge status={String(row.issue)} /> }, { key: "age", label: "Age" }]} /></Panel></>;
}
