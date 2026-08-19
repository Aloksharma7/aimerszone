import Link from "next/link";
import { CreditCard, Plus, ReceiptText, ShieldCheck } from "lucide-react";
import { ButtonLink, EmptyState, MetricCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { getStudentPayments } from "@/lib/data/student";
import { formatNpr } from "@/lib/utils";

export default async function StudentPaymentsPage() {
  const payments = await getStudentPayments();
  const approved = payments.filter((item) => item.status === "Approved").length;
  const underReview = payments.filter((item) => ["Under review", "Submitted"].includes(item.status)).length;
  return (
    <>
      <PageHeader eyebrow="Payments and access" title="Payment history" description="Track every submitted proof, approval, rejection and receipt." actions={<ButtonLink href="/student/payments/new"><Plus className="h-4 w-4" />Submit payment</ButtonLink>} />
      <div className="grid gap-4 sm:grid-cols-3"><MetricCard label="Approved payments" value={String(approved)} detail="Receipt available after approval" icon={ShieldCheck} tone="green" /><MetricCard label="Under review" value={String(underReview)} detail="Submitted for verification" icon={CreditCard} tone="blue" /><MetricCard label="Receipts" value={String(approved)} detail="Authorised receipt records" icon={ReceiptText} tone="violet" /></div>
      <Panel className="mt-6 p-0" padded={false}>{payments.length ? <div className="divide-y divide-slate-100">{payments.map((payment) => <Link key={payment.id} href={`/student/payments/${payment.id}`} className="grid gap-3 p-5 transition hover:bg-slate-50 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-slate-950">{payment.course}</h2><StatusBadge status={payment.status} /></div><p className="mt-1 text-sm text-slate-500">{payment.batch}</p><p className="mt-2 text-xs text-slate-400">{payment.id} · {payment.method} · Submitted {payment.submitted}</p>{payment.reason ? <p className="mt-2 text-sm text-red-700">{payment.reason}</p> : null}</div><div className="text-left sm:text-right"><p className="text-lg font-bold text-slate-950">{formatNpr(payment.amount)}</p><p className="mt-1 text-xs font-semibold text-brand-700">View details →</p></div></Link>)}</div> : <div className="p-5"><EmptyState title="No payment submissions" description="New payment proofs and their review status will appear here." action={<ButtonLink href="/student/payments/new">Submit payment proof</ButtonLink>} /></div>}</Panel>
    </>
  );
}
