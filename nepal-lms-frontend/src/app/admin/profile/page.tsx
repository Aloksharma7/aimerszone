import { AccountProfileManager } from "@/components/account/account-profile-manager";
import { PageHeader } from "@/components/ui";
import { requirePortalAccess } from "@/lib/auth/server";
import { getAccountProfile } from "@/lib/data/account";

export default async function AdminProfilePage() {
  const user = await requirePortalAccess("admin");
  const profile = await getAccountProfile(user, "admin");
  return <><PageHeader eyebrow="Account" title="Administrator Profile & Security" description="Manage contact information and protect access to institution-wide administration." /><AccountProfileManager initialData={profile} role="admin" /></>;
}
