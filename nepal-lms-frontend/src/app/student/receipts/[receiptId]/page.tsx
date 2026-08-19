import { notFound } from "next/navigation";
import { AuthorizedDownloadButton, PrintButton } from "@/components/api-actions";
import { ButtonLink, PageHeader, Panel } from "@/components/ui";
import { getSessionUser } from "@/lib/auth/server";
import { getStudentReceipt } from "@/lib/data/student";
import { getPublicSettings } from "@/lib/data/settings";
import { formatNpr } from "@/lib/utils";

export default async function ReceiptPage({ params }: { params: Promise<{ receiptId: string }> }) {
  const { receiptId } = await params;
  const user = await getSessionUser("student");
  if (!user) return null;
  const [receipt, settings] = await Promise.all([
    getStudentReceipt(receiptId, user.name, user.studentCode || ""),
    getPublicSettings(),
  ]);
  if (!receipt) notFound();

  return (
    <>
      <PageHeader back={{ href: "/student/payments", label: "All payments" }}
        eyebrow="Official receipt"
        title={`Receipt ${receipt.id}`}
        description="Issued after verified payment approval."
        actions={
          <>
            <PrintButton />
            <AuthorizedDownloadButton endpoint={`/api/v1/student/receipts/${encodeURIComponent(receipt.id)}/download`} label="Download PDF" />
          </>
        }
      />
      <Panel className="mx-auto max-w-3xl print:border-0 print:shadow-none">
        <div className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="text-xl font-bold text-slate-950">{settings.name}</p><p className="mt-1 text-sm text-slate-500">{settings.address}</p></div>
          <div className="sm:text-right"><p className="text-sm font-semibold text-slate-500">Receipt number</p><p className="mt-1 font-bold text-slate-950">{receipt.id}</p><p className="mt-2 text-sm text-slate-500">Issued {receipt.issuedAt}</p></div>
        </div>
        <div className="grid gap-6 border-b border-slate-200 py-6 sm:grid-cols-2">
          <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Received from</p><p className="mt-2 font-bold text-slate-950">{receipt.studentName}</p><p className="mt-1 text-sm text-slate-500">{receipt.studentCode}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Payment reference</p><p className="mt-2 font-bold text-slate-950">{receipt.paymentReference}</p><p className="mt-1 text-sm text-slate-500">{receipt.paymentMethod}</p></div>
        </div>
        <div className="py-6"><div className="flex justify-between gap-6"><div><p className="font-bold text-slate-950">{receipt.course}</p><p className="mt-1 text-sm text-slate-500">{receipt.batch}</p></div><p className="font-bold text-slate-950">{formatNpr(receipt.amountNpr)}</p></div></div>
        <div className="flex justify-between gap-6 border-t-2 border-slate-900 pt-5 text-lg font-bold"><span>Total received</span><span>{formatNpr(receipt.amountNpr)}</span></div>
        <p className="mt-8 text-xs leading-5 text-slate-400">This receipt is rendered from the authorized payment record. Verify the receipt number with the institution when required.</p>
      </Panel>
      <div className="mt-5 text-center print:hidden"><ButtonLink href={`/student/payments/${encodeURIComponent(receipt.paymentId)}`} variant="ghost">Back to payment</ButtonLink></div>
    </>
  );
}
