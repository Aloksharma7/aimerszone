import { Banknote, CheckCircle2, Clock3, FileUp, QrCode, ShieldCheck } from "lucide-react";
import { PublicPageHero } from "@/components/public-page";
import { AlertBox, ButtonLink, Panel, SectionHeading } from "@/components/ui";
import { getPublicPaymentMethods } from "@/lib/data/public";

export default async function PaymentInstructionsPage() {
  const methods = await getPublicPaymentMethods();
  return (
    <>
      <PublicPageHero
        eyebrow="Payment instructions"
        title="Pay, submit proof and wait for verification"
        description="The institution does not grant paid access from a frontend button alone. A verified payment approval activates enrollment."
      />
      <section className="bg-canvas py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-7 lg:grid-cols-[1fr_370px]">
            <div>
              <SectionHeading title="Four simple steps" />
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  [QrCode, "1. Choose a method", "Use only the payment method and account information published by the institution."],
                  [Banknote, "2. Complete the payment", "Pay the exact server-confirmed amount for the selected batch."],
                  [FileUp, "3. Upload proof", "Provide payer name, reference, date, amount and a clear JPG, PNG or PDF proof."],
                  [ShieldCheck, "4. Wait for verification", "An accountant reviews the external transaction record before access begins."],
                ].map(([Icon, title, detail]) => {
                  const C = Icon as typeof QrCode;
                  return (
                    <Panel key={String(title)}>
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><C className="h-5 w-5" /></div>
                      <h2 className="mt-5 font-bold text-slate-950">{String(title)}</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{String(detail)}</p>
                    </Panel>
                  );
                })}
              </div>
              <AlertBox title="Never send passwords or OTP codes" tone="warning">
                <p>Support may ask for the transaction reference or clearer proof, but should not ask for your wallet or banking password.</p>
              </AlertBox>
            </div>
            <Panel className="h-fit">
              <h2 className="text-xl font-bold text-slate-950">Approved payment methods</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">These methods are published from the Laravel administration settings. Confirm the selected batch amount before paying.</p>
              {methods.length ? (
                <div className="mt-5 space-y-3">
                  {methods.map((method) => (
                    <div key={method.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800">{method.name}</p>
                          {method.accountName ? <p className="mt-1 text-sm text-slate-600">Account name: {method.accountName}</p> : null}
                          {method.accountIdentifier ? <p className="mt-1 break-all text-sm text-slate-600">Account / wallet: {method.accountIdentifier}</p> : null}
                          {method.instructions ? <p className="mt-2 text-xs leading-5 text-slate-500">{method.instructions}</p> : null}
                          {method.qrImageUrl ? <p className="mt-2 text-xs font-semibold text-brand-700">Approved QR is available in the signed-in payment flow.</p> : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5"><AlertBox title="Payment methods are temporarily unavailable" tone="warning"><p>Contact the enrollment team before sending any payment.</p></AlertBox></div>
              )}
              <div className="mt-5 flex gap-3 rounded-xl bg-slate-50 p-4">
                <Clock3 className="h-5 w-5 shrink-0 text-brand-700" />
                <p className="text-sm leading-6 text-slate-600">Your page shows a pending status after submission. Do not create another duplicate proof unless instructed.</p>
              </div>
              <ButtonLink href="/register" className="mt-6 w-full">Register to submit payment</ButtonLink>
            </Panel>
          </div>
        </div>
      </section>
    </>
  );
}
