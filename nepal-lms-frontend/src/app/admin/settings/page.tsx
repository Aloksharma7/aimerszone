import { Settings } from "lucide-react";
import { SettingsManager } from "@/components/admin-controls";
import { ButtonLink, PageHeader } from "@/components/ui";
import { getAdminSettings } from "@/lib/data/admin";

export default async function AdminSettingsPage() {
  const settings = await getAdminSettings();
  return <><PageHeader eyebrow="Platform configuration" title="Settings" description="Institution identity, public payment instructions, security defaults and operational controls." actions={<ButtonLink href="/admin/audit-logs" variant="outline"><Settings className="h-4 w-4"/>View audit log</ButtonLink>}/><SettingsManager initialData={settings}/></>;
}
