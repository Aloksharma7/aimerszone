import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, FileText, ReceiptText } from "lucide-react";
import { AlertBox, ButtonLink, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { getStudentPayment } from "@/lib/data/student";
import { formatNpr } from "@/lib/utils";

export default async function PaymentDetailPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const payment = await getStudentPayment(paymentId);
  if (!payment) notFound();
  return (
    <>
      {/*
        * A back link, always present.
        *
        * Submitting a payment lands here through router.replace, so the
        * browser's back button returns to the wizard rather than the history
        * list, and there was no other route to it from this page.
        */}
      <PageHeader eyebrow="Payment record" title={payment.id} description={`${payment.course} · ${payment.batch}`} actions={<><ButtonLink href="/student/payments" variant="outline"><ArrowLeft className="h-4 w-4" />All payments</ButtonLink>{payment.status === "Approved" ? <ButtonLink href={`/student/receipts/REC-${payment.id}`}><ReceiptText className="h-4 w-4" />View receipt</ButtonLink> : null}</>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Panel><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold text-slate-950">Submission details</h2><StatusBadge status={payment.status} /></div><dl className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200">{[["Amount", formatNpr(payment.amount)], ["Payment method", payment.method], ["Reference", payment.reference], ["Submitted", payment.submitted], ["Course", payment.course], ["Batch", payment.batch]].map(([label, value]) => <div key={label} className="flex justify-between gap-6 p-4 text-sm"><dt className="text-slate-500">{label}</dt><dd className="text-right font-semibold text-slate-900">{value}</dd></div>)}</dl>{payment.status === "Rejected" ? <AlertBox title="Action needed" tone="danger"><p>{payment.reason || "The submission needs correction before it can be reviewed again."}</p></AlertBox> : ["Under review", "Submitted"].includes(payment.status) ? <AlertBox title="Your payment is being reviewed"><p>You do not need to submit another proof unless staff requests a correction.</p></AlertBox> : <AlertBox title="Payment approved" tone="success"><p>Your enrollment was activated and a receipt is available.</p></AlertBox>}</Panel>
        <aside className="space-y-5"><Panel><h2 className="font-bold text-slate-950">Status history</h2><div className="mt-5 space-y-5">{[[FileText, "Proof submitted", payment.submitted], [Clock3, payment.status === "Approved" ? "Review completed" : "Review status", payment.status], [CheckCircle2, payment.status === "Approved" ? "Enrollment activated" : "Awaiting decision", payment.status === "Approved" ? "Automatic after approval" : "No course access is granted from this submission yet"]].map(([Icon, title, detail], index) => { const ItemIcon = Icon as typeof FileText; return <div key={String(title)} className="flex gap-3"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${index === 0 || payment.status === "Approved" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}><ItemIcon className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-slate-900">{String(title)}</p><p className="mt-1 text-xs text-slate-500">{String(detail)}</p></div></div>; })}</div></Panel>{payment.status === "Rejected" ? <ButtonLink href="/student/payments/new" className="w-full">Resubmit corrected proof</ButtonLink> : null}</aside>
      </div>
    </>
  );
}
