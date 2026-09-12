import { AlertTriangle, CheckCircle2, Video, XCircle } from "lucide-react";
import { IntegrationConnection } from "@/components/admin-controls";
import { DataTable } from "@/components/portal-components";
import { AlertBox, MetricCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { getAdminIntegrationEvents, getAdminIntegrationRows, getAdminIntegrationStatus } from "@/lib/data/admin";

export default async function ZoomIntegrationPage() {
  const [rows, status, events] = await Promise.all([getAdminIntegrationRows("zoom"), getAdminIntegrationStatus("zoom"), getAdminIntegrationEvents("zoom")]);
  const warnings = rows.filter((row)=>Object.values(row).some((value)=>String(value).toLowerCase().includes("warning") || String(value).toLowerCase().includes("fail"))).length;
  const failedEvents = events.filter((event) => event.status === "failed");
  return <><PageHeader eyebrow="Integrations" title="Zoom meeting operations" description="Monitor connection health, session synchronization and controlled fallback readiness."/><div className="mb-6 grid gap-4 sm:grid-cols-3"><MetricCard label="Connection" value={status.connected ? "Connected" : "Not connected"} detail="Server-owned OAuth" icon={status.connected ? CheckCircle2 : XCircle} tone={status.connected ? "green" : "amber"}/><MetricCard label="Meeting records" value={String(rows.length)} detail="Synced records" icon={Video} tone="blue"/><MetricCard label="Warnings" value={String(warnings)} detail="Require reconciliation" icon={AlertTriangle} tone="amber"/></div><IntegrationConnection provider="zoom" initialConnected={status.connected}/><Panel className="mt-6"><h2 className="text-xl font-bold text-slate-950">Synchronization records</h2><p className="mt-1 text-sm text-slate-500">Provider state and local readiness are reviewed separately.</p><div className="mt-5"><DataTable rowKey="id" rows={rows as unknown as Record<string,unknown>[]} columns={[{key:"topic",label:"Meeting",render:(row)=><div><p className="font-semibold text-slate-900">{String(row.topic || row.title || row.id)}</p><p className="mt-1 text-xs text-slate-500">{String(row.batch || row.id)}</p></div>},{key:"scheduled",label:"Scheduled (NPT)"},{key:"host",label:"Host"},{key:"providerState",label:"Provider",render:(row)=><StatusBadge status={String(row.providerState || row.provider_state || "Unknown")}/>},{key:"localState",label:"Local readiness",render:(row)=><StatusBadge status={String(row.localState || row.local_state || "Unknown")}/>} ]}/></div></Panel>
    <Panel className="mt-6">
      <h2 className="text-xl font-bold text-slate-950">Recent sync activity</h2>
      <p className="mt-1 text-sm text-slate-500">Every automatic sync attempt from the last 15-minute cycles, with the actual reason a failed one gave — this is what the dashboard&apos;s warning count is counting.</p>
      {failedEvents.length > 0 ? (
        <div className="mt-4">
          <AlertBox title={`${failedEvents.length} recent failure${failedEvents.length === 1 ? "" : "s"}, most likely the same cause repeating`} tone="danger">
            <p>{failedEvents[0].message || "No failure message was recorded for this attempt."}</p>
          </AlertBox>
        </div>
      ) : null}
      <div className="mt-5">
        <DataTable
          rowKey="id"
          rows={events as unknown as Record<string, unknown>[]}
          emptyTitle="No sync activity recorded yet"
          emptyDescription="Nothing has attempted to sync with Zoom in the period this log covers."
          columns={[
            { key: "occurredAt", label: "When" },
            { key: "action", label: "Action" },
            { key: "reference", label: "Meeting", render: (row) => String(row.reference || "—") },
            { key: "status", label: "Result", render: (row) => <StatusBadge status={String(row.status) === "success" ? "Success" : String(row.status) === "failed" ? "Failed" : String(row.status)} /> },
            { key: "message", label: "Detail", render: (row) => <span className="block max-w-sm truncate" title={String(row.message || "")}>{String(row.message || "—")}</span> },
          ]}
        />
      </div>
    </Panel>
  </>;
}
