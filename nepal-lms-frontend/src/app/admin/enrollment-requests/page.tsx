import { ClipboardList, Plus } from "lucide-react";
import { ListFilters } from "@/components/list-filters";
import { DataTable } from "@/components/portal-components";
import { EnrollmentRequestDecision } from "@/components/shared/audited-actions";
import { ButtonLink, MetricCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { getAdminEnrollmentRequests } from "@/lib/data/admin";
import { firstParam, matchesQuery, type PageSearchParams } from "@/lib/search-params";

export default async function AdminEnrollmentRequestsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const raw = await searchParams;
  const q = firstParam(raw.q);
  const status = firstParam(raw.status);
  const requests = await getAdminEnrollmentRequests();
  const filtered = requests.filter(
    (item) => matchesQuery(q, item.id, item.studentName, item.courseTitle, item.batchTitle, item.basis) && (!status || item.status === status),
  );
  const pending = requests.filter((item) => item.status === "Pending").length;

  return (
    <>
      <PageHeader
        eyebrow="Enrollment exceptions"
        title="Enrollment requests"
        description="Scholarships, transfers and institutional exceptions raised by staff. Only a decision made here grants the seat — the officer who asked cannot be the one who approves."
        actions={<ButtonLink href="/admin/enrollment-requests/new" variant="outline"><Plus className="h-4 w-4" />Raise a request</ButtonLink>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Pending decision" value={String(pending)} icon={ClipboardList} tone="amber" />
        <MetricCard label="All requests" value={String(requests.length)} icon={ClipboardList} tone="blue" />
      </div>
      <Panel className="mt-6">
        <ListFilters
          searchValue={q}
          searchPlaceholder="Search student, course, batch or basis"
          resetHref="/admin/enrollment-requests"
          fields={[{ name: "status", label: "Status", value: status, options: [{ value: "", label: "All statuses" }, { value: "Pending", label: "Pending" }, { value: "Approved", label: "Approved" }, { value: "Rejected", label: "Rejected" }] }]}
        />
        <div className="mt-5">
          <DataTable
            rowKey="id"
            rows={filtered as unknown as Record<string, unknown>[]}
            columns={[
              { key: "studentName", label: "Student" },
              { key: "courseTitle", label: "Course" },
              { key: "batchTitle", label: "Batch" },
              { key: "basis", label: "Basis" },
              { key: "requestedBy", label: "Requested by" },
              { key: "createdAt", label: "Requested" },
              { key: "status", label: "Status", render: (row) => <StatusBadge status={String(row.status)} /> },
              {
                key: "actions",
                label: "Decision",
                render: (row) => (row.status === "Pending" ? <EnrollmentRequestDecision requestId={String(row.id)} /> : <span className="text-sm text-slate-400">Decided</span>),
              },
            ]}
          />
        </div>
      </Panel>
    </>
  );
}
