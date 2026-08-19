import { notFound } from "next/navigation";
import { AlertCircle, UserRound, WalletCards } from "lucide-react";
import { ApiMutationButton, AuthorizedViewButton } from "@/components/api-actions";
import { AlertBox, ButtonLink, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { getStaffPaymentSubmission } from "@/lib/data/staff";
import { portalPath } from "@/lib/portal-path";
import { formatNpr } from "@/lib/utils";

export default async function StaffPaymentDetailPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const [payment, base, studentsPath] = await Promise.all([
    getStaffPaymentSubmission(paymentId),
    portalPath("/staff/payment-submissions"),
    portalPath("/staff/students"),
  ]);
  if (!payment) notFound();
  return <><PageHeader back={{ href: base, label: "All submissions" }} eyebrow="Payment submission" title={payment.id} description={`${payment.student} · ${payment.course}`} actions={<StatusBadge status={payment.status} />} /><div className="grid gap-6 xl:grid-cols-[1fr_350px]"><div className="space-y-6"><Panel><div className="flex items-center gap-3"><UserRound className="h-6 w-6 text-brand-700" /><h2 className="text-xl font-bold text-slate-950">Student and course</h2></div><dl className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200">{[["Student", payment.student], ["Course", payment.course], ["Submitted", payment.submitted], ["Risk check", payment.risk]].map(([label, value]) => <div key={label} className="flex justify-between gap-6 p-4 text-sm"><dt className="text-slate-500">{label}</dt><dd className="text-right font-semibold text-slate-900">{value}</dd></div>)}</dl></Panel><Panel><div className="flex items-center gap-3"><WalletCards className="h-6 w-6 text-brand-700" /><h2 className="text-xl font-bold text-slate-950">Payment details</h2></div><dl className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Amount paid</dt><dd className="mt-2 font-bold text-slate-950">{formatNpr(payment.amount)}</dd></div><div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Method</dt><dd className="mt-2 font-bold text-slate-950">{payment.method}</dd></div></dl><AuthorizedViewButton endpoint={`/api/v1/staff/payment-submissions/${encodeURIComponent(payment.id)}/proof`} label="Open authorised proof" className="mt-5" /></Panel><AlertBox title="Accountant review boundary" tone="info"><p>Enrollment staff may correct records only when the workflow state and API permission allow it.</p></AlertBox></div><aside className="space-y-5"><Panel><h2 className="text-lg font-bold text-slate-950">Enrollment officer actions</h2><div className="mt-5 grid gap-3"><ApiMutationButton endpoint={`/api/v1/staff/payment-submissions/${encodeURIComponent(payment.id)}/notify`} label="Resend status notification" successMessage="Notification queued." /><ButtonLink href={studentsPath} variant="outline" className="w-full">Open students</ButtonLink></div></Panel><Panel><div className="flex gap-3"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div><h2 className="font-bold text-slate-950">Approval boundary</h2><p className="mt-2 text-sm leading-6 text-slate-600">Approve, reject, refund and adjustment actions are intentionally absent from this workspace. Corrections require a new audited workflow rather than silently changing evidence.</p></div></div></Panel></aside></div></>;
}
