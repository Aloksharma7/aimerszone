import { AccountProfileManager } from "@/components/account/account-profile-manager";
import { PageHeader } from "@/components/ui";
import { requirePortalAccess } from "@/lib/auth/server";
import { getAccountProfile } from "@/lib/data/account";

export default async function TeacherProfilePage() {
  const user = await requirePortalAccess("teacher");
  const profile = await getAccountProfile(user, "teacher");
  return <><PageHeader eyebrow="Account" title="Teacher Profile & Security" description="Manage contact information and protect access to assigned academic workspaces." /><AccountProfileManager initialData={profile} role="teacher" /></>;
}
