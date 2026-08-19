import Link from "next/link";
import { PageHeader } from "@/components/ui";

export default function EsewaFailurePage() {
  return (
    <>
      <PageHeader eyebrow="Payment" title="Payment not completed" description="eSewa did not confirm this payment." />
      <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm leading-6 text-slate-700">
          Nothing has been charged and your enrollment has not changed. If money did leave your account, contact the
          office with your eSewa transaction code and it will be matched manually.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/student/payments" className="inline-flex h-11 items-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
            Back to payments
          </Link>
          <Link href="/student/support" className="inline-flex h-11 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Contact support
          </Link>
        </div>
      </div>
    </>
  );
}
