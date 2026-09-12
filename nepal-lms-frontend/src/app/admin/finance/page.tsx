import Link from "next/link";
import { AlertTriangle, ArrowRight, CreditCard, ReceiptText, RotateCcw, ShieldCheck, WalletCards } from "lucide-react";
import { DataTable } from "@/components/portal-components";
import { BarTrend, HorizontalBars } from "@/components/reporting";
import { ButtonLink, MetricCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { formatAdminNpr, getAdminFinanceOverview, getAdminFinanceReport } from "@/lib/data/admin";

/*
 * The risk mix was four hardcoded percentages (72 / 11 / 8 / 9) captioned as
 * queue composition. It is now derived from the risk label the API assigns to
 * each submission actually in the queue, so it moves when the queue does.
 */
// Labels come from FinanceOverviewController::riskLabel().
const riskTones = { Standard: "green", "Short payment": "amber", Overpayment: "amber", "Duplicate evidence": "violet" } as const;

export default async function AdminFinancePage() {
  const [overview, report] = await Promise.all([getAdminFinanceOverview(), getAdminFinanceReport()]);

  const riskCounts = overview.queue.reduce<Record<string, number>>((acc, row) => {
    const label = row.risk || "Unclassified";
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  const riskMix = Object.entries(riskCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({
      label: `${label} · ${count}`,
      value: Math.round((count / overview.queue.length) * 100),
      tone: (riskTones[label as keyof typeof riskTones] || "blue") as "green" | "amber" | "violet" | "blue",
    }));
  return <><PageHeader eyebrow="Administrator" title="Finance oversight" description="Payment review health and financial exposure. Open any submission to approve, reject or flag it." actions={<ButtonLink href="/admin/reports/finance"><WalletCards className="h-4 w-4"/>Open finance report</ButtonLink>}/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Net collections" value={formatAdminNpr(overview.metrics.monthNpr)} detail="Current reporting month" icon={WalletCards} tone="green"/><MetricCard label="Pending review" value={String(overview.metrics.pending)} detail="Accountant queue" icon={CreditCard} tone="amber"/><MetricCard label="Approved today" value={String(overview.metrics.approvedToday)} detail={formatAdminNpr(overview.metrics.approvedTodayNpr)} icon={ReceiptText} tone="blue"/><MetricCard label="Refund exposure" value={formatAdminNpr(overview.metrics.refundsMonthNpr)} detail="Current month" icon={RotateCcw} tone="violet"/></div><div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_.85fr]"><Panel><div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-950">Recent net collections</h2><p className="mt-1 text-sm text-slate-500">Daily value in thousands of NPR.</p></div><Link href="/admin/reports/finance" className="flex items-center gap-1 text-sm font-bold text-brand-700">Full report<ArrowRight className="h-4 w-4"/></Link></div><div className="mt-6"><BarTrend valuePrefix="रु " items={report.slice(-7).map((row)=>({label:row.date,value:Math.round(row.net/1000),detail:`${row.transactions} txns`}))}/></div></Panel><Panel><h2 className="text-xl font-bold text-slate-950">Review health</h2><p className="mt-1 text-sm text-slate-500">{overview.queue.length ? `Risk signals across ${overview.queue.length} submission${overview.queue.length === 1 ? "" : "s"} awaiting review.` : "Nothing is waiting for review."}</p><div className="mt-6">{riskMix.length ? <HorizontalBars items={riskMix}/> : <p className="text-sm text-slate-500">The queue is empty.</p>}</div></Panel></div><Panel className="mt-6"><div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-950">Current payment queue</h2><p className="mt-1 text-sm text-slate-500">Open a submission to approve, reject or flag it.</p></div><ButtonLink href="/admin/payments" variant="outline">Open review queue</ButtonLink></div><div className="mt-5"><DataTable actions rowKey="id" rows={overview.queue.map((row)=>({...row, href: `/admin/payments/${encodeURIComponent(String(row.id))}`})) as unknown as Record<string,unknown>[]} columns={[{key:"id",label:"Payment",render:(row)=><Link href={`/admin/payments/${encodeURIComponent(String(row.id))}`} className="font-semibold text-brand-700 hover:underline">{String(row.id)}</Link>},{key:"student",label:"Student"},{key:"course",label:"Course"},{key:"amount",label:"Amount",render:(row)=><span className="font-semibold tabular-nums">{formatAdminNpr(Number(row.amount))}</span>},{key:"method",label:"Method"},{key:"risk",label:"Risk",render:(row)=><StatusBadge status={String(row.risk)}/>},{key:"status",label:"Status",render:(row)=><StatusBadge status={String(row.status)}/>}]}/></div></Panel><Panel className="mt-6 border-blue-200 bg-blue-50"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700"/><div><p className="font-bold text-blue-950">Separation of duties still applies</p><p className="mt-1 text-sm leading-6 text-blue-800">Whoever submitted a payment cannot approve it, and every decision is written to the audit trail with the reviewer named. That check runs inside the approval transaction, so it holds for administrators too.</p></div><AlertTriangle className="ml-auto hidden h-5 w-5 text-blue-400 sm:block"/></div></Panel></>;
}
