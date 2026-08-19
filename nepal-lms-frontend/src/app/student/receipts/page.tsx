import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/data/format";
import { getStudentReceipts } from "@/lib/data/student";

export default async function StudentReceiptsPage() {
  const receipts = await getStudentReceipts();

  return (
    <>
      <PageHeader
        eyebrow="Payments"
        title="Your receipts"
        description="A receipt is issued for every approved payment. The details are fixed at the moment it was issued."
      />

      {receipts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <FileText className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm text-slate-600">
            No receipts yet. One appears here as soon as a payment is approved.
          </p>
          <Link href="/student/payments" className="mt-4 inline-flex h-11 items-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
            Go to payments
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {receipts.map((receipt) => (
                <tr key={receipt.id}>
                  <td className="px-4 py-3 text-slate-700">{formatDateTime(receipt.issuedAt)}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{receipt.courseTitle}</p>
                    <p className="text-xs text-slate-500">{receipt.batchTitle}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{receipt.paymentMethod}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">NPR {receipt.amountNpr.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/student/receipts/${encodeURIComponent(receipt.id)}`}
                      className="inline-flex h-9 items-center rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
