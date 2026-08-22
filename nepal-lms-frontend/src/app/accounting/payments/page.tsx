import { Filter, ImageIcon, WalletCards } from "lucide-react";
import { ApiExportLink } from "@/components/api-actions";
import { ListFilters } from "@/components/list-filters";
import { DataTable } from "@/components/portal-components";
import { MetricCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { getAccountingPayments } from "@/lib/data/accounting";
import { portalPath } from "@/lib/portal-path";
import { buildQueryString, firstParam, matchesQuery, searchTerm, type PageSearchParams } from "@/lib/search-params";
import { formatNpr } from "@/lib/utils";

export default async function AccountingPaymentsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const raw = await searchParams;
  const q = searchTerm(raw);
  const status = firstParam(raw.status);
  const method = firstParam(raw.method);
  const sort = firstParam(raw.sort) || "newest";
  const items = await getAccountingPayments();
  const needsDecision = (value: string) => ["submitted", "under review"].includes(value.toLocaleLowerCase());
  const matchesStatus = (value: string) => !status || (status.toLocaleLowerCase() === "pending" ? needsDecision(value) : value.toLocaleLowerCase() === status.toLocaleLowerCase());
  const filtered = items
    .filter((item) => matchesQuery(q, item.id, item.student, item.course, item.method, item.status, item.risk) && matchesStatus(item.status) && (!method || item.method.toLocaleLowerCase().includes(method.toLocaleLowerCase())))
    .sort((a, b) => sort === "highest" ? b.amount - a.amount : sort === "oldest" ? items.indexOf(b) - items.indexOf(a) : items.indexOf(a) - items.indexOf(b));
  const submitted = items.filter((item) => item.status === "Submitted").length;
  const review = items.filter((item) => item.status.toLocaleLowerCase() === "under review").length;
  const flagged = items.filter((item) => item.risk !== "Normal").length;
  const exportQuery = buildQueryString({ q, status, method, sort });

  /*
   * The same screen is served at /accounting/payments and /admin/payments, so
   * every link out of it has to stay in the portal the request came from —
   * otherwise an administrator opening a payment is thrown into the accounting
   * portal, which is exactly what these shared routes were added to stop.
   */
  const base = await portalPath("/accounting/payments");

  return (
    <>
      <PageHeader eyebrow="Financial review" title="Payments" description="Verify proof against external records before approving, rejecting or flagging." actions={<ApiExportLink href={`/api/v1/accounting/payments/export${exportQuery}`} label="Export queue" />} />
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Submitted" value={String(submitted)} icon={WalletCards} tone="blue" />
        <MetricCard label="Under review" value={String(review)} icon={Filter} tone="violet" />
        <MetricCard label="Flagged" value={String(flagged)} icon={Filter} tone="amber" />
      </div>
      <Panel className="mt-6">
        <ListFilters
          searchValue={q}
          searchPlaceholder="Search payment, student or course"
          resetHref={base}
          fields={[
            { name: "status", label: "Payment status", value: status, options: [{ value: "", label: "All statuses" }, { value: "pending", label: "Needs a decision" }, { value: "Submitted", label: "Submitted" }, { value: "Under review", label: "Under review" }, { value: "Approved", label: "Approved" }, { value: "Rejected", label: "Rejected" }, { value: "Refunded", label: "Refunded" }] },
            { name: "method", label: "Payment method", value: method, options: [{ value: "", label: "All methods" }, { value: "eSewa", label: "eSewa" }, { value: "Khalti", label: "Khalti" }, { value: "Bank", label: "Bank transfer" }] },
            { name: "sort", label: "Sort order", value: sort, options: [{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }, { value: "highest", label: "Highest amount" }] },
          ]}
        />
        <div className="mt-5"><DataTable actions rowKey="id" needsAttention={(row) => needsDecision(String(row.status))} rows={filtered.map((row) => ({ ...row, href: `${base}/${encodeURIComponent(row.id)}` })) as unknown as Record<string, unknown>[]} columns={[{ key: "id", label: "Payment" }, { key: "student", label: "Student" }, { key: "course", label: "Course / Batch" }, { key: "amount", label: "Amount", render: (row) => <span className="font-semibold text-slate-900">{formatNpr(Number(row.amount))}</span> }, { key: "method", label: "Method" }, { key: "proof", label: "Proof", render: (row) => (row.hasProof ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><ImageIcon className="h-3.5 w-3.5" />Attached</span> : <span className="text-xs text-slate-400">None</span>) }, { key: "submitted", label: "Submitted" }, { key: "risk", label: "Flag", render: (row) => <StatusBadge status={String(row.risk)} /> }, { key: "status", label: "Status", render: (row) => <StatusBadge status={String(row.status)} /> }]} /></div>
      </Panel>
    </>
  );
}
