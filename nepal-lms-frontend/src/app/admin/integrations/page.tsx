import Link from "next/link";
import { CheckCircle2, ChevronRight, MonitorPlay, Video, XCircle } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui";
import { getAdminIntegrationStatus } from "@/lib/data/admin";

const providers = [
  { key: "zoom" as const, label: "Zoom", description: "Live class meetings, sync health and fallback readiness.", icon: Video },
  { key: "youtube" as const, label: "YouTube", description: "Recording verification, availability and access control.", icon: MonitorPlay },
];

export default async function AdminIntegrationsPage() {
  const statuses = await Promise.all(providers.map((provider) => getAdminIntegrationStatus(provider.key)));

  return (
    <>
      <PageHeader eyebrow="Integrations" title="Connected providers" description="Each provider's OAuth credentials, connection state and records are managed on its own page." />
      <div className="grid gap-4 sm:grid-cols-2">
        {providers.map((provider, index) => {
          const status = statuses[index];
          const Icon = provider.icon;
          return (
            <Link key={provider.key} href={`/admin/integrations/${provider.key}`} className="block">
              <Panel className="transition hover:border-brand-300 hover:shadow-card">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${status.connected ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-950">{provider.label}</h2>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{provider.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm font-semibold">
                  {status.connected ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-amber-600" />}
                  <span className={status.connected ? "text-green-700" : "text-amber-700"}>{status.connected ? "Connected" : "Not connected"}</span>
                </div>
              </Panel>
            </Link>
          );
        })}
      </div>
    </>
  );
}
