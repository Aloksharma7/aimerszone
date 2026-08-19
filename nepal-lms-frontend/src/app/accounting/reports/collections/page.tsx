import { Banknote, Filter, TrendingUp, WalletCards } from "lucide-react";
import { ApiExportLink } from "@/components/api-actions";
import { Button, ButtonLink, MetricCard, PageHeader, Panel, ProgressBar } from "@/components/ui";
import { getCollectionsReport } from "@/lib/data/accounting";
import { buildQueryString, firstParam, type PageSearchParams } from "@/lib/search-params";

export default async function CollectionsReportPage({ searchParams }: { searchParams: PageSearchParams }) {
  const raw = await searchParams;
  const from = firstParam(raw.from);
  const to = firstParam(raw.to);
  const courseId = firstParam(raw.course_id);
  const filters = { from, to, course_id: courseId };
  const data = await getCollectionsReport(filters);
  const query = buildQueryString(filters);

  return (
    <>
      <PageHeader eyebrow="Financial report" title="Collections" description="Approved collections by date, method, course and batch." actions={<ApiExportLink href={`/api/v1/accounting/reports/collections/export${query}`} label="Export CSV" />} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Today" value={data.metrics.today} detail={`${data.metrics.todayCount} payments`} icon={Banknote} tone="green" />
        <MetricCard label="This week" value={data.metrics.week} detail={`${data.metrics.weekCount} payments`} icon={TrendingUp} tone="blue" />
        <MetricCard label="This month" value={data.metrics.month} detail={`${data.metrics.monthCount} payments`} icon={WalletCards} tone="violet" />
        <MetricCard label="Average payment" value={data.metrics.average} detail="Approved payments" icon={Banknote} tone="amber" />
      </div>
      <Panel className="mt-6">
        <form method="get" className="grid gap-4 sm:grid-cols-3 xl:grid-cols-[1fr_1fr_1.3fr_auto] xl:items-end">
          <label className="text-sm font-semibold text-slate-700">From<input name="from" type="date" defaultValue={from} className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100" /></label>
          <label className="text-sm font-semibold text-slate-700">To<input name="to" type="date" defaultValue={to} className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100" /></label>
          <label className="text-sm font-semibold text-slate-700">Course ID or slug<input name="course_id" maxLength={100} defaultValue={courseId} className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="All courses" /></label>
          <div className="flex gap-2"><ButtonLink href="/accounting/reports/collections" variant="outline">Reset</ButtonLink><Button type="submit"><Filter className="h-4 w-4" />Apply</Button></div>
        </form>
      </Panel>
      <div className="mt-6 grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <Panel><h2 className="text-xl font-bold text-slate-950">By payment method</h2><div className="mt-6 space-y-6">{data.methods.map((item) => <div key={item.name}><div className="mb-2 flex items-center justify-between gap-4"><span className="text-sm font-semibold text-slate-700">{item.name}</span><span className="text-sm font-bold text-slate-950">{item.amount}</span></div><ProgressBar value={item.share} showValue={false} /><p className="mt-2 text-xs text-slate-500">{item.share}% of approved collections</p></div>)}</div></Panel>
        <Panel><h2 className="text-xl font-bold text-slate-950">By course</h2><div className="mt-6 space-y-6">{data.courses.map((item) => <div key={item.name}><div className="mb-2 flex items-center justify-between gap-4"><span className="text-sm font-semibold text-slate-700">{item.name}</span><span className="text-sm font-bold text-slate-950">{item.amount}</span></div><ProgressBar value={item.share} showValue={false} /></div>)}</div></Panel>
      </div>
    </>
  );
}
