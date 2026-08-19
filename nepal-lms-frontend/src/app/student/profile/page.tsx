import { AccountProfileManager } from "@/components/account/account-profile-manager";
import { PageHeader } from "@/components/ui";
import { requirePortalAccess } from "@/lib/auth/server";
import { getAccountProfile } from "@/lib/data/account";

export default async function StudentProfilePage() {
  const user = await requirePortalAccess("student");
  const profile = await getAccountProfile(user, "student");
  return <><PageHeader eyebrow="Account" title="Profile & Security" description="Manage your contact information, password, two-factor protection and signed-in devices." /><AccountProfileManager initialData={profile} role="student" /></>;
}
