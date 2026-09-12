import { CheckCircle2, Clock3, MonitorPlay, XCircle } from "lucide-react";
import { IntegrationConnection } from "@/components/admin-controls";
import { DataTable } from "@/components/portal-components";
import { MetricCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { getAdminIntegrationEvents, getAdminIntegrationRows, getAdminIntegrationStatus } from "@/lib/data/admin";

export default async function YouTubeIntegrationPage() {
  const [rows, status, events] = await Promise.all([getAdminIntegrationRows("youtube"), getAdminIntegrationStatus("youtube"), getAdminIntegrationEvents("youtube")]);
  const pending = rows.filter((row)=>Object.values(row).some((value)=>String(value).toLowerCase().includes("pending") || String(value).toLowerCase().includes("processing"))).length;
  return <><PageHeader eyebrow="Integrations" title="YouTube recording operations" description="Verify recording identifiers, availability and enrolled-student access without exposing raw private links."/><div className="mb-6 grid gap-4 sm:grid-cols-3"><MetricCard label="Connection" value={status.connected ? "Connected" : "Not connected"} detail="Server-owned OAuth" icon={status.connected ? CheckCircle2 : XCircle} tone={status.connected ? "green" : "amber"}/><MetricCard label="Recording records" value={String(rows.length)} detail="Synced records" icon={MonitorPlay} tone="blue"/><MetricCard label="Pending verification" value={String(pending)} detail="Provider processing" icon={Clock3} tone="amber"/></div><IntegrationConnection provider="youtube" initialConnected={status.connected}/><Panel className="mt-6"><h2 className="text-xl font-bold text-slate-950">Recent recording records</h2><p className="mt-1 text-sm text-slate-500">Only provider identifiers are stored; authorization remains on the LMS recording page.</p><div className="mt-5"><DataTable rowKey="id" rows={rows as unknown as Record<string,unknown>[]} columns={[{key:"title",label:"Recording",render:(row)=><div><p className="font-semibold text-slate-900">{String(row.title || row.id)}</p><p className="mt-1 text-xs text-slate-500">{String(row.batch || row.id)}</p></div>},{key:"videoId",label:"Video ID"},{key:"privacy",label:"Provider privacy"},{key:"access",label:"LMS access"},{key:"published",label:"Released"},{key:"state",label:"State",render:(row)=><StatusBadge status={String(row.state || "Unknown")}/>} ]}/></div></Panel>
    <Panel className="mt-6">
      <h2 className="text-xl font-bold text-slate-950">Recent sync activity</h2>
      <p className="mt-1 text-sm text-slate-500">Every automatic sync attempt, with the actual reason a failed one gave.</p>
      <div className="mt-5">
        <DataTable
          rowKey="id"
          rows={events as unknown as Record<string, unknown>[]}
          emptyTitle="No sync activity recorded yet"
          emptyDescription="Nothing has attempted to sync with YouTube in the period this log covers."
          columns={[
            { key: "occurredAt", label: "When" },
            { key: "action", label: "Action" },
            { key: "reference", label: "Recording", render: (row) => String(row.reference || "—") },
            { key: "status", label: "Result", render: (row) => <StatusBadge status={String(row.status) === "success" ? "Success" : String(row.status) === "failed" ? "Failed" : String(row.status)} /> },
            { key: "message", label: "Detail", render: (row) => <span className="block max-w-sm truncate" title={String(row.message || "")}>{String(row.message || "—")}</span> },
          ]}
        />
      </div>
    </Panel>
  </>;
}
