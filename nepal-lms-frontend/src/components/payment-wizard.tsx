"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, FileUp, LoaderCircle, QrCode, ReceiptText } from "lucide-react";
import { useRouter } from "next/navigation";
import { AlertBox, Button, ButtonLink, EmptyState, Panel } from "@/components/ui";
import { browserRequest, createIdempotencyKey, type NormalizedApiError } from "@/lib/api/browser-client";
import type { ApiResponse } from "@/lib/api/contracts";
import { cn, formatNpr, kathmanduToday } from "@/lib/utils";
import type { Course, Payment, PaymentOptions } from "@/types/lms";

const steps = ["Batch", "Payment method", "Proof details", "Review"];

/*
 * Must stay in step with SubmitPaymentRequest: mimes jpg,jpeg,png,webp,pdf and
 * lms.uploads.proof_max_kb (5120). The client used to accept webp nowhere and
 * allow 8 MB, so a 6 MB file passed here and came back as a 422 the student
 * could do nothing about.
 */
const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const maxProofMb = 5;
const maxProofBytes = maxProofMb * 1024 * 1024;

/** The API payload is snake_case; this component reads camelCase. */
type ApiPaymentOptions = {
  batch_id: string;
  batch_title?: string | null;
  course_title?: string | null;
  expected_amount_npr?: number | null;
  methods?: Array<{
    id: string;
    name: string;
    account_name?: string | null;
    account_identifier?: string | null;
    qr_image_url?: string | null;
    instructions?: string | null;
  }> | null;
};

/*
 * Without this the raw response was assigned straight into a camelCase type:
 * expectedAmountNpr came back undefined, the price rendered as "NPR NaN",
 * the amount field was seeded with the string "undefined", and the resulting
 * NaN failed validation so the wizard could never be submitted. The account
 * name and number on the method cards were blank for the same reason.
 */
function mapPaymentOptions(value: ApiPaymentOptions): PaymentOptions {
  return {
    batchId: value.batch_id,
    courseTitle: value.course_title || "",
    batchTitle: value.batch_title || "",
    expectedAmountNpr: Number(value.expected_amount_npr ?? 0),
    currency: "NPR",
    methods: (value.methods || []).map((method) => ({
      id: method.id,
      name: method.name,
      accountName: method.account_name,
      accountIdentifier: method.account_identifier,
      qrImageUrl: method.qr_image_url,
      instructions: method.instructions,
    })),
  };
}

function mockOptions(course: Course): PaymentOptions {
  return {
    batchId: course.batchId,
    courseTitle: course.title,
    batchTitle: course.batch,
    expectedAmountNpr: course.price,
    currency: "NPR",
    methods: [
      { id: "mock-esewa", name: "eSewa", accountName: "Institution Account", accountIdentifier: "98XXXXXXXX", instructions: "Pay the exact amount and keep the complete transaction screen." },
      { id: "mock-khalti", name: "Khalti", accountName: "Institution Account", accountIdentifier: "98XXXXXXXX", instructions: "Include the transaction ID in your submission." },
      { id: "mock-bank", name: "Bank transfer", accountName: "Institution Account", accountIdentifier: "Account details supplied by the institution", instructions: "Upload a clear transfer receipt showing the reference." },
    ],
  };
}

export function PaymentWizard({ courses, initialCourseSlug }: { courses: Course[]; initialCourseSlug?: string }) {
  const router = useRouter();
  const payableCourses = useMemo(() => courses.filter((course) => !course.isFree && course.batchId), [courses]);
  const initial = payableCourses.find((course) => course.slug === initialCourseSlug) || payableCourses[0] || null;
  const [step, setStep] = useState(0);
  const [courseSlug, setCourseSlug] = useState(initial?.slug || "");
  const [options, setOptions] = useState<PaymentOptions | null>(null);
  const [optionsBusy, setOptionsBusy] = useState(false);
  const [methodId, setMethodId] = useState("");
  const [amountPaid, setAmountPaid] = useState(initial?.price ? String(initial.price) : "");
  const [payerName, setPayerName] = useState("");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const mockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
  const selectedCourse = payableCourses.find((course) => course.slug === courseSlug) || null;
  const selectedMethod = options?.methods.find((method) => method.id === methodId) || null;

  useEffect(() => {
    // Clears options/method left over from a previously selected course so a
    // stale payment method can never carry into a submission for this one.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!selectedCourse) { setOptions(null); return; }
    let active = true;
    setOptionsBusy(true); setServerError(null); setOptions(null); setMethodId("");
    if (mockMode) {
      const next = mockOptions(selectedCourse);
      setOptions(next); setMethodId(next.methods[0]?.id || ""); setAmountPaid(String(next.expectedAmountNpr)); setOptionsBusy(false);
      return () => { active = false; };
    }
    browserRequest<ApiResponse<ApiPaymentOptions>>({ url: `/api/v1/student/payment-options?batch_id=${encodeURIComponent(selectedCourse.batchId)}`, method: "GET" })
      .then((response) => {
        if (!active) return;
        const mapped = mapPaymentOptions(response.data);
        setOptions(mapped);
        setMethodId(mapped.methods[0]?.id || "");
        setAmountPaid(mapped.expectedAmountNpr > 0 ? String(mapped.expectedAmountNpr) : "");
      })
      .catch((caught) => { if (!active) return; const error = caught as Partial<NormalizedApiError>; setServerError(error.message || "Payment options could not be loaded."); })
      .finally(() => { if (active) setOptionsBusy(false); });
    return () => { active = false; };
  }, [mockMode, selectedCourse]);

  function validateCurrent(): boolean {
    const next: Record<string, string> = {};
    if (step === 0 && (!selectedCourse || !options)) next.course = "Choose an available paid batch.";
    if (step === 1 && !selectedMethod) next.method = "Choose a payment method.";
    if (step === 2) {
      const amount = Number(amountPaid);
      if (!Number.isFinite(amount) || amount <= 0) next.amountPaid = "Enter the amount actually paid.";
      if (payerName.trim().length < 2) next.payerName = "Enter the payer name shown in the transaction.";
      if (!paidAt) next.paidAt = "Choose the payment date.";
      else if (paidAt > kathmanduToday()) next.paidAt = "The payment date cannot be in the future.";
      if (!proof) next.proof = "Upload a payment proof.";
      else if (!acceptedTypes.has(proof.type)) next.proof = "Use JPG, PNG or PDF only.";
      else if (proof.size > maxProofBytes) next.proof = `The proof must be ${maxProofMb} MB or smaller.`;
      if (reference.length > 120) next.reference = "Reference must be 120 characters or fewer.";
      if (note.length > 500) next.note = "Note must be 500 characters or fewer.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function nextStep() {
    if (!validateCurrent()) return;
    setStep((value) => Math.min(steps.length - 1, value + 1));
  }

  function chooseProof(file: File | null) {
    setProof(file);
    setErrors((current) => { const next = { ...current }; delete next.proof; return next; });
  }

  async function submit() {
    if (!options || !selectedMethod || !proof || submitting || !validateCurrent()) return;
    setSubmitting(true); setServerError(null);
    try {
      if (mockMode) {
        await new Promise((resolve) => window.setTimeout(resolve, 600));
        setSubmittedId("PREVIEW-PAYMENT");
        return;
      }
      const form = new FormData();
      form.append("batch_id", options.batchId);
      form.append("payment_method_id", selectedMethod.id);
      form.append("amount_npr", String(Math.max(1, Math.round(Number(amountPaid) || 0))));
      form.append("payer_name", payerName.trim());
      form.append("transaction_reference", reference.trim());
      /*
       * A payment made earlier today must not be stamped at midday.
       *
       * The API rejects anything after "now", so a student paying in the
       * morning and submitting straight away got "The payment date cannot be
       * in the future" with no way to proceed. For today, send the current
       * time; for any earlier day, end-of-day is safely in the past.
       */
      form.append("paid_at", paidAt === kathmanduToday() ? new Date().toISOString() : `${paidAt}T12:00:00+05:45`);
      form.append("note", note.trim());
      form.append("proof_file", proof);
      const response = await browserRequest<ApiResponse<Payment>>({
        url: "/api/v1/student/payments",
        method: "POST",
        data: form,
        headers: { "Idempotency-Key": createIdempotencyKey("student-payment") },
      });
      setSubmittedId(response.data.id);
      router.replace(`/student/payments/${encodeURIComponent(response.data.id)}`);
      router.refresh();
    } catch (caught) {
      const error = caught as Partial<NormalizedApiError>;
      setServerError(error.message || "The payment proof could not be submitted.");
      if (error.validation) {
        const next: Record<string, string> = {};
        Object.entries(error.validation).forEach(([key, messages]) => { next[key] = messages[0] || "Invalid value"; });
        setErrors(next);
      }
    } finally { setSubmitting(false); }
  }

  if (!payableCourses.length) return <EmptyState title="No paid batches available" description="A published paid batch is required before payment proof can be submitted." action={<ButtonLink href="/student/explore">Explore courses</ButtonLink>} />;
  if (submittedId) return <Panel className="mx-auto max-w-xl text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><CheckCircle2 className="h-7 w-7" /></div><h1 className="mt-5 text-2xl font-bold text-slate-950">Payment proof submitted</h1><p className="mt-3 text-sm leading-7 text-slate-600">{mockMode ? "Preview mode validated the form without storing a record." : "Your payment is recorded and waiting to be reviewed. Course access begins once it is approved — you do not need to pay or submit anything again."}</p>{mockMode ? null : <p className="mt-3 text-sm text-slate-500">Reference <span className="font-semibold text-slate-800">{submittedId}</span>. You can reopen it any time under Payments.</p>}<div className="mt-6 flex flex-wrap justify-center gap-3"><ButtonLink href={mockMode ? "/student/payments" : `/student/payments/${encodeURIComponent(submittedId)}`}>View this payment</ButtonLink><ButtonLink href="/student/payments" variant="outline">All payments</ButtonLink></div></Panel>;

  return (
    <div className="mx-auto max-w-4xl">
      <ol className="mb-6 grid grid-cols-4 gap-2">{steps.map((label, index) => <li key={label} className="min-w-0"><div className={cn("h-1.5 rounded-full", index <= step ? "bg-brand-700" : "bg-slate-200")} /><p className={cn("mt-2 truncate text-xs font-semibold", index === step ? "text-brand-700" : "text-slate-400")}>{index + 1}. {label}</p></li>)}</ol>
      {serverError ? <div className="mb-5"><AlertBox title="Payment action could not continue" tone="danger">{serverError}</AlertBox></div> : null}
      <Panel>
        {step === 0 ? <div><p className="text-sm font-bold uppercase tracking-wider text-brand-700">Select batch</p><h1 className="mt-2 text-2xl font-bold text-slate-950">Choose what you paid for</h1><label className="mt-6 block text-sm font-semibold text-slate-700">Course and batch<select value={courseSlug} onChange={(event) => setCourseSlug(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100">{payableCourses.map((course) => <option key={course.slug} value={course.slug}>{course.title} — {course.batch}</option>)}</select></label>{optionsBusy ? <div className="mt-6 flex items-center gap-2 rounded-xl bg-slate-50 p-5 text-sm text-slate-600"><LoaderCircle className="h-5 w-5 animate-spin" />Loading server-resolved price and methods…</div> : options ? <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-bold text-slate-900">{options.batchTitle}</p><p className="mt-2 text-sm text-slate-600">{selectedCourse?.schedule}</p><p className="mt-1 text-sm text-slate-600">Starts {selectedCourse?.startDate} · {selectedCourse?.access}</p></div><p className="text-2xl font-bold text-slate-950">{formatNpr(options.expectedAmountNpr)}</p></div></div> : null}{errors.course ? <p className="mt-2 text-sm text-red-700">{errors.course}</p> : null}<p className="mt-4 text-sm leading-6 text-slate-500">The expected amount and available payment methods are resolved by Laravel for the selected batch. The browser cannot set the authoritative fee.</p></div> : null}

        {step === 1 ? <div><p className="text-sm font-bold uppercase tracking-wider text-brand-700">Choose payment method</p><h1 className="mt-2 text-2xl font-bold text-slate-950">Use an approved account</h1>{options?.methods.length ? <div className="mt-6 grid gap-4 sm:grid-cols-3">{options.methods.map((method) => { const selected = method.id === methodId; return <button key={method.id} type="button" onClick={() => setMethodId(method.id)} className={cn("rounded-xl border p-4 text-left", selected ? "border-brand-600 bg-brand-50 ring-2 ring-brand-100" : "border-slate-200 hover:bg-slate-50")}><span className="flex items-center justify-between"><QrCode className="h-7 w-7 text-brand-700" /><span className={cn("h-4 w-4 rounded-full border", selected ? "border-4 border-brand-700" : "border-slate-300")} /></span><span className="mt-4 block font-bold text-slate-900">{method.name}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{method.accountName || "Institution payment account"}</span></button>; })}</div> : <EmptyState title="No active payment method" description="Contact enrollment support because this batch currently has no approved payment account." />}{selectedMethod ? <div className="mt-6 grid gap-5 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-[1fr_auto]"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Account information</p><p className="mt-2 font-bold text-slate-900">{selectedMethod.accountName || selectedMethod.name}</p><p className="mt-1 text-sm text-slate-600">{selectedMethod.accountIdentifier || "Follow the institution’s displayed instructions."}</p><p className="mt-3 text-sm leading-6 text-slate-600">{selectedMethod.instructions}</p></div>{selectedMethod.qrImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded image from Laravel storage, not a Next-optimized asset
                <img src={selectedMethod.qrImageUrl} alt={`${selectedMethod.name} scan-to-pay QR code`} className="h-32 w-32 rounded-xl border border-slate-200 bg-white object-contain p-2" />
              ) : (
                <div className="grid h-32 w-32 place-items-center rounded-xl border border-dashed border-slate-300 bg-white"><QrCode className="h-10 w-10 text-slate-400" /><span className="sr-only">No QR configured for this method</span></div>
              )}</div> : null}{errors.method ? <p className="mt-2 text-sm text-red-700">{errors.method}</p> : null}</div> : null}

        {step === 2 ? <div><p className="text-sm font-bold uppercase tracking-wider text-brand-700">Proof details</p><h1 className="mt-2 text-2xl font-bold text-slate-950">Tell us how you paid</h1><div className="mt-6 grid gap-5 sm:grid-cols-2"><Field label="Amount actually paid" error={errors.amountPaid}><input value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} type="number" min="1" step="1" className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" /></Field><Field label="Payer name" error={errors.payerName}><input value={payerName} onChange={(event) => setPayerName(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" placeholder="Name shown in payment" autoComplete="name" /></Field><Field label="Transaction/reference number" error={errors.reference}><input value={reference} onChange={(event) => setReference(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" placeholder="Reference number" maxLength={120} /></Field><Field label="Payment date" error={errors.paidAt}><input value={paidAt} onChange={(event) => setPaidAt(event.target.value)} type="date" className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" /></Field><div className="sm:col-span-2"><Field label="Note (optional)" error={errors.note}><textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 min-h-24 w-full rounded-lg border border-slate-300 p-3 font-normal" placeholder="Any detail that helps verification" maxLength={500} /></Field></div><label className={cn("flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed bg-slate-50 px-6 py-10 text-center sm:col-span-2", errors.proof ? "border-red-400" : "border-slate-300")}><FileUp className="h-8 w-8 text-brand-700" /><span className="mt-3 font-bold text-slate-800">{proof ? proof.name : "Upload JPG, PNG, WEBP or PDF proof"}</span><span className="mt-1 text-xs text-slate-500">Maximum {maxProofMb} MB. Show the complete transaction clearly.</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => chooseProof(event.target.files?.[0] || null)} className="sr-only" /></label>{errors.proof ? <p className="text-sm text-red-700 sm:col-span-2">{errors.proof}</p> : null}</div></div> : null}

        {step === 3 ? <div><p className="text-sm font-bold uppercase tracking-wider text-brand-700">Review</p><h1 className="mt-2 text-2xl font-bold text-slate-950">Confirm before submitting</h1><div className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200">{[["Course", options?.courseTitle || "—"], ["Batch", options?.batchTitle || "—"], ["Expected amount", options ? formatNpr(options.expectedAmountNpr) : "—"], ["Amount paid", formatNpr(Number(amountPaid) || 0)], ["Method", selectedMethod?.name || "—"], ["Reference", reference || "Not provided"], ["Proof", proof?.name || "—"]].map(([label, value]) => <div key={label} className="flex justify-between gap-6 p-4 text-sm"><span className="text-slate-500">{label}</span><span className="text-right font-semibold text-slate-900">{value}</span></div>)}</div><div className="mt-5 flex gap-3 rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-900"><ReceiptText className="mt-0.5 h-5 w-5 shrink-0" />Submitting proof does not grant access on its own — someone has to check it against the payment record first. Your submission is saved either way, and you can follow it under Payments.</div></div> : null}

        <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5"><Button variant="outline" disabled={step === 0 || submitting} onClick={() => setStep((value) => Math.max(0, value - 1))}><ChevronLeft className="h-4 w-4" />Back</Button>{step < steps.length - 1 ? <Button onClick={nextStep} disabled={optionsBusy}>Continue<ChevronRight className="h-4 w-4" /></Button> : <Button onClick={submit} disabled={submitting}>{submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{submitting ? "Submitting…" : "Submit proof"}</Button>}</div>
      </Panel>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="text-sm font-semibold text-slate-700">{label}{children}{error ? <span className="mt-1 block text-xs font-medium text-red-700">{error}</span> : null}</label>;
}
