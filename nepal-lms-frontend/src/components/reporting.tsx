import { CalendarDays, Filter } from "lucide-react";
import { ApiExportLink } from "@/components/api-actions";
import { Badge, Button, ButtonLink, Panel } from "@/components/ui";
import { cn } from "@/lib/utils";

export type ReportFilterValues = {
  from?: string;
  to?: string;
  course_id?: string;
  batch_id?: string;
  teacher_id?: string;
  payment_method?: string;
  source?: string;
  status?: string;
};

function clean(values: ReportFilterValues): ReportFilterValues {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => typeof value === "string" && value.trim())) as ReportFilterValues;
}

export function ReportFilters({
  type = "academic",
  values = {},
}: {
  type?: "academic" | "enrollment" | "finance";
  values?: ReportFilterValues;
}) {
  const current = clean(values);
  const query = new URLSearchParams(current as Record<string, string>).toString();
  const reportName = type === "enrollment" ? "enrollments" : type;
  const resetHref = `/admin/reports/${reportName}`;
  const exportHref = `/api/v1/admin/reports/${reportName}/export${query ? `?${query}` : ""}`;
  const active = [
    current.from || current.to ? `${current.from || "Start"} to ${current.to || "Today"}` : null,
    current.course_id ? `Course: ${current.course_id}` : null,
    current.batch_id ? `Batch: ${current.batch_id}` : null,
    current.teacher_id ? `Teacher: ${current.teacher_id}` : null,
    current.payment_method ? `Method: ${current.payment_method}` : null,
    current.source ? `Source: ${current.source}` : null,
    current.status ? `Status: ${current.status}` : null,
  ].filter(Boolean) as string[];

  return (
    <Panel className="mb-6">
      <form method="get" className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">From</span>
            <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3">
              <CalendarDays className="h-4 w-4 text-slate-400" />
              <input name="from" type="date" defaultValue={current.from} className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none" />
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">To</span>
            <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3">
              <CalendarDays className="h-4 w-4 text-slate-400" />
              <input name="to" type="date" defaultValue={current.to} className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none" />
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Course ID / slug</span>
            <input name="course_id" defaultValue={current.course_id} maxLength={100} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="All courses" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Batch ID</span>
            <input name="batch_id" defaultValue={current.batch_id} maxLength={100} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="All batches" />
          </label>
          {type === "academic" ? (
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Teacher ID</span>
              <input name="teacher_id" defaultValue={current.teacher_id} maxLength={100} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="All teachers" />
            </label>
          ) : null}
          {type === "finance" ? (
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Payment method</span>
              <select name="payment_method" defaultValue={current.payment_method || ""} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100">
                <option value="">All methods</option><option value="esewa">eSewa</option><option value="khalti">Khalti</option><option value="bank">Bank transfer</option><option value="cash">Cash receipt</option>
              </select>
            </label>
          ) : null}
          {type === "enrollment" ? (
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Source</span>
              <select name="source" defaultValue={current.source || ""} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100">
                <option value="">All sources</option><option value="public_registration">Public registration</option><option value="enrollment_officer">Staff</option><option value="free_learning">Free learning</option>
              </select>
            </label>
          ) : null}
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Status</span>
            <select name="status" defaultValue={current.status || ""} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100">
              <option value="">All statuses</option><option value="active">Active</option><option value="pending">Pending</option><option value="completed">Completed</option><option value="rejected">Rejected</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={resetHref} variant="outline" size="sm">Reset</ButtonLink>
          <Button type="submit" size="sm"><Filter className="h-4 w-4" />Apply filters</Button>
          <ApiExportLink href={exportHref} label="Export CSV" className="h-9 px-3" />
        </div>
      </form>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
        <span className="font-semibold text-slate-700">Active filters:</span>
        {active.length ? active.map((item) => <Badge key={item} tone="blue">{item}</Badge>) : <Badge>None</Badge>}
        <span className="ml-auto">Results and exports always use the same query, so they never disagree.</span>
      </div>
    </Panel>
  );
}

export function BarTrend({ items, valueSuffix = "", valuePrefix = "" }: { items: { label: string; value: number; detail?: string }[]; valueSuffix?: string; valuePrefix?: string }) {
  const max = Math.max(...items.map((item)=>item.value),1);
  return (
    <div>
      <div className="flex h-64 items-end gap-3 sm:gap-5">
        {items.map((item)=><div key={item.label} className="flex h-full min-w-0 flex-1 flex-col justify-end"><div className="mb-2 text-center text-xs font-bold tabular-nums text-slate-700">{valuePrefix}{item.value.toLocaleString()}{valueSuffix}</div><div className="relative flex-1 rounded-t-lg bg-slate-100"><div className="absolute inset-x-0 bottom-0 rounded-t-lg bg-brand-700 transition-[height]" style={{height:`${Math.max(8,(item.value/max)*100)}%`}}/></div><p className="mt-2 truncate text-center text-xs font-semibold text-slate-500">{item.label}</p>{item.detail?<p className="mt-0.5 truncate text-center text-[10px] text-slate-400">{item.detail}</p>:null}</div>)}
      </div>
    </div>
  );
}

export function HorizontalBars({ items }: { items: { label: string; value: number; total?: number; tone?: "blue" | "green" | "amber" | "violet" }[] }) {
  return <div className="space-y-5">{items.map((item)=>{const total=item.total??100;const width=Math.max(2,Math.min(100,(item.value/total)*100));return <div key={item.label}><div className="mb-2 flex items-center justify-between gap-4 text-sm"><span className="font-semibold text-slate-700">{item.label}</span><span className="font-bold tabular-nums text-slate-900">{item.value.toLocaleString()}{item.total?` / ${item.total.toLocaleString()}`:"%"}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={cn("h-full rounded-full",item.tone==="green"?"bg-green-600":item.tone==="amber"?"bg-amber-500":item.tone==="violet"?"bg-violet-600":"bg-brand-700")} style={{width:`${width}%`}}/></div></div>})}</div>;
}

export function ReportNavigation({ active }: { active: "academic" | "enrollments" | "finance" }) {
  const items = [
    { id: "academic", label: "Academic", href: "/admin/reports/academic" },
    { id: "enrollments", label: "Enrollments", href: "/admin/reports/enrollments" },
    { id: "finance", label: "Finance", href: "/admin/reports/finance" },
  ] as const;
  return <div className="mb-6 overflow-x-auto"><nav className="flex min-w-max gap-1 rounded-xl border border-slate-200 bg-white p-1.5">{items.map((item)=><a key={item.id} href={item.href} className={cn("rounded-lg px-4 py-2.5 text-sm font-semibold",active===item.id?"bg-brand-950 text-white":"text-slate-600 hover:bg-slate-100")}>{item.label}</a>)}</nav></div>;
}
