import { SlidersHorizontal } from "lucide-react";
import { PlatformControls } from "@/components/admin/platform-controls";
import { PageHeader } from "@/components/ui";
import { getAdminSettings } from "@/lib/data/admin";

export default async function AdminPlatformPage() {
  const settings = await getAdminSettings();
  const active = Object.values(settings.features).filter((feature) => feature.enabled && feature.ready).length;

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Features and integrations"
        description="Switch capabilities on, paste provider credentials, and see at a glance what is still waiting for configuration."
        actions={
          <div className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700">
            <SlidersHorizontal className="h-4 w-4" />
            {active} active
          </div>
        }
      />
      <PlatformControls settings={settings} />
    </>
  );
}
