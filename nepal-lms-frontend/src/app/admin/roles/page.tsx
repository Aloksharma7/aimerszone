import { ShieldCheck } from "lucide-react";
import { RoleMatrix } from "@/components/admin-controls";
import { RoleEditor } from "@/components/admin/role-editor";
import { PageHeader } from "@/components/ui";
import { getAdminPermissions, getAdminRoles } from "@/lib/data/admin";

export default async function AdminRolesPage() {
  const [roles, permissions] = await Promise.all([getAdminRoles(), getAdminPermissions()]);
  return (
    <>
      <PageHeader
        eyebrow="Identity and access"
        title="Roles and permissions"
        description="Review protected role boundaries and confirm that browser navigation never replaces server-side authorization."
        actions={<div className="flex h-11 items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 text-sm font-semibold text-green-800"><ShieldCheck className="h-4 w-4"/>Server policies required</div>}
      />
      <RoleMatrix roles={roles}/>
      <RoleEditor roles={roles} permissions={permissions} />
    </>
  );
}
