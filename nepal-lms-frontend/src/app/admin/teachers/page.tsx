import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { DataTable } from "@/components/portal-components";
import { MetricCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { getAdminTeachers } from "@/lib/data/admin";
import { portalPath } from "@/lib/portal-path";

export default async function AdminTeachersPage() {
  const [teachers, base] = await Promise.all([getAdminTeachers(), portalPath("/admin/teachers")]);
  const published = teachers.filter((teacher) => teacher.isPublic).length;

  const rows = teachers.map((teacher) => ({
    id: teacher.userId || teacher.slug,
    name: teacher.name,
    role: teacher.role,
    subjects: teacher.subjects.join(", ") || "Not set",
    status: teacher.isPublic ? "Published" : "Hidden",
    href: `${base}/${encodeURIComponent(teacher.userId || teacher.slug)}`,
  }));

  return (
    <>
      <PageHeader eyebrow="Faculty directory" title="Teachers" description="What the public /teachers page shows: headline, subjects, bio and photo — independent of a teacher's own account." />
      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard label="Teacher accounts" value={String(teachers.length)} icon={GraduationCap} tone="blue" />
        <MetricCard label="Published publicly" value={String(published)} detail={`${teachers.length - published} hidden`} icon={GraduationCap} tone="green" />
      </div>
      <Panel className="mt-6">
        <DataTable
          rowKey="id"
          actions
          rows={rows as unknown as Record<string, unknown>[]}
          columns={[
            { key: "name", label: "Teacher", render: (row) => <Link href={String(row.href)} className="font-bold text-brand-700 hover:text-brand-900">{String(row.name)}</Link> },
            { key: "role", label: "Public headline" },
            { key: "subjects", label: "Subjects" },
            { key: "status", label: "Public page", render: (row) => <StatusBadge status={String(row.status)} /> },
          ]}
        />
      </Panel>
    </>
  );
}
