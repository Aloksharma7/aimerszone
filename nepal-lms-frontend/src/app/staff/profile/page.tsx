import { AccountProfileManager } from "@/components/account/account-profile-manager";
import { PageHeader } from "@/components/ui";
import { requirePortalAccess } from "@/lib/auth/server";
import { getAccountProfile } from "@/lib/data/account";

export default async function StaffProfilePage() {
  const user = await requirePortalAccess("staff");
  const profile = await getAccountProfile(user, "staff");
  return <><PageHeader eyebrow="Account" title="Staff Profile & Security" description="Manage contact information and protect access to enrollment and payment tools." /><AccountProfileManager initialData={profile} role="staff" /></>;
}
