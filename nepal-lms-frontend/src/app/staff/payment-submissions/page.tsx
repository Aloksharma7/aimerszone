import { Filter, ImageIcon, Plus, WalletCards } from "lucide-react";
import { ListFilters } from "@/components/list-filters";
import { Pagination } from "@/components/pagination";
import { DataTable } from "@/components/portal-components";
import { ButtonLink, MetricCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { getStaffPaymentSubmissions, getStaffPaymentSubmissionsPage } from "@/lib/data/staff";
import { portalPath } from "@/lib/portal-path";
import { buildQueryString, firstParam, pageParam, type PageSearchParams } from "@/lib/search-params";
import { formatNpr } from "@/lib/utils";

export default async function StaffPaymentSubmissionsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const raw = await searchParams;
  const q = firstParam(raw.q);
  const status = firstParam(raw.status);
  const page = pageParam(raw);
  const [payments, { items, meta }, base, newPath] = await Promise.all([
    getStaffPaymentSubmissions(),
    getStaffPaymentSubmissionsPage({ page, status }),
    portalPath("/staff/payment-submissions"),
    portalPath("/staff/enroll"),
  ]);
  const pending = payments.filter((item) => !["Approved", "Rejected", "Refunded"].includes(item.status)).length;
  const returned = payments.filter((item) => item.status === "Rejected").length;
  const rows = items.map((item) => ({ ...item, href: `${base}/${item.id}` }));

  return (
    <>
      <PageHeader eyebrow="Payment capture" title="Payment Submissions" description="Payments captured on a student's behalf activate access immediately; only a flagged one waits on a second reviewer." actions={<ButtonLink href={newPath}><Plus className="h-4 w-4" />Enroll a student</ButtonLink>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total submissions" value={String(payments.length)} icon={WalletCards} tone="amber" />
        <MetricCard label="Needs a second review" value={String(pending)} icon={Filter} tone="blue" />
        <MetricCard label="Returned / rejected" value={String(returned)} icon={Plus} tone="violet" />
      </div>
      <Panel className="mt-6">
        <ListFilters
          searchValue={q}
          searchPlaceholder="Search student, course or payment"
          resetHref={base}
          fields={[{ name: "status", label: "Submission status", value: status, options: [{ value: "", label: "All statuses" }, { value: "Submitted", label: "Submitted" }, { value: "Under review", label: "Under review" }, { value: "Approved", label: "Approved" }, { value: "Rejected", label: "Rejected" }] }]}
        />
        <div className="mt-5"><DataTable actions rowKey="id" rows={rows as unknown as Record<string, unknown>[]} columns={[{ key: "id", label: "Submission" }, { key: "student", label: "Student" }, { key: "course", label: "Course" }, { key: "amount", label: "Amount", render: (row) => <span className="font-semibold text-slate-900">{formatNpr(Number(row.amount))}</span> }, { key: "method", label: "Method" }, { key: "proof", label: "Proof", render: (row) => (row.hasProof ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><ImageIcon className="h-3.5 w-3.5" />Attached</span> : <span className="text-xs text-slate-400">None</span>) }, { key: "risk", label: "Check", render: (row) => <StatusBadge status={String(row.risk)} /> }, { key: "status", label: "Status", render: (row) => <StatusBadge status={String(row.status)} /> }]} /></div>
        <Pagination meta={meta} buildHref={(target) => `${base}${buildQueryString({ q, status, page: String(target) })}`} />
      </Panel>
    </>
  );
}
