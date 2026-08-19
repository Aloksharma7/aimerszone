import Link from "next/link";
import { KeyRound, Plus, ShieldCheck, UserCheck, Users } from "lucide-react";
import { ApiExportLink } from "@/components/api-actions";
import { ListFilters } from "@/components/list-filters";
import { DataTable } from "@/components/portal-components";
import { ButtonLink, MetricCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { getAdminRoles, getAdminUsers } from "@/lib/data/admin";
import { buildQueryString, firstParam, matchesQuery, searchTerm, type PageSearchParams } from "@/lib/search-params";

export default async function AdminUsersPage({ searchParams }: { searchParams: PageSearchParams }) {
  const raw = await searchParams;
  const q = searchTerm(raw);
  const role = firstParam(raw.role);
  const status = firstParam(raw.status);
  const mfa = firstParam(raw.mfa);
  const [users, roles] = await Promise.all([getAdminUsers(), getAdminRoles()]);
  const filtered = users.filter((user) => matchesQuery(q, user.id, user.name, user.email, user.phone, user.role) && (!role || user.role === role) && (!status || user.status === status) && (!mfa || user.mfa === mfa));
  const exportQuery = buildQueryString({ q, role, status, mfa });

  return (
    <>
      <PageHeader eyebrow="Identity and access" title="Users" description="Search people, review account state and open permission-scoped profile actions." actions={<><ApiExportLink href={`/api/v1/admin/users/export${exportQuery}`} label="Export" /><ButtonLink href="/admin/users/new"><Plus className="h-4 w-4" />Create account</ButtonLink></>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active accounts" value={users.filter((user) => user.status === "Active").length.toLocaleString()} detail="Listed students and staff" icon={UserCheck} tone="green" />
        <MetricCard label="Privileged accounts" value={String(users.filter((user) => ["Administrator", "Accountant", "Enrollment Officer"].includes(user.role)).length)} detail="MFA should be required" icon={ShieldCheck} tone="blue" />
        <MetricCard label="Suspended" value={String(users.filter((user) => user.status === "Suspended").length)} detail="Review under retention policy" icon={KeyRound} tone="amber" />
        <MetricCard label="Roles" value={String(roles.length)} detail="Server-owned permissions" icon={Users} tone="violet" />
      </div>
      <Panel className="mt-6">
        <ListFilters
          searchValue={q}
          searchPlaceholder="Search name, email, phone or ID"
          resetHref="/admin/users"
          fields={[
            { name: "role", label: "User role", value: role, options: [{ value: "", label: "All roles" }, ...roles.map((item) => ({ value: item.name, label: item.name }))] },
            { name: "status", label: "Account status", value: status, options: [{ value: "", label: "All statuses" }, { value: "Active", label: "Active" }, { value: "Suspended", label: "Suspended" }, { value: "Pending", label: "Pending" }] },
            { name: "mfa", label: "MFA state", value: mfa, options: [{ value: "", label: "Any MFA state" }, { value: "Enabled", label: "Enabled" }, { value: "Not enabled", label: "Not enabled" }] },
          ]}
        />
        <div className="mt-5"><DataTable rowKey="id" rows={filtered as unknown as Record<string, unknown>[]} columns={[{ key: "name", label: "User", render: (row) => <div><Link href={`/admin/users/${String(row.id)}`} className="font-bold text-brand-700 hover:text-brand-900">{String(row.name)}</Link><p className="mt-1 text-xs text-slate-500">{String(row.email)} · {String(row.id)}</p></div> }, { key: "phone", label: "Phone" }, { key: "role", label: "Role" }, { key: "status", label: "Status", render: (row) => <StatusBadge status={String(row.status)} /> }, { key: "mfa", label: "MFA", render: (row) => <StatusBadge status={String(row.mfa) === "Enabled" ? "Active" : "Not enabled"} /> }, { key: "lastSeen", label: "Last activity" }]} /></div>
      </Panel>
    </>
  );
}
