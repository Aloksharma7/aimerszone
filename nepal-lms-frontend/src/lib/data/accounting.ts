import "server-only";

import type { ApiResponse, PaginatedResponse } from "@/lib/api/contracts";
import { isServerApiError, serverApiFetch } from "@/lib/api/server-client";
import type { ApiPaymentQueueItem } from "@/lib/data/api-dtos";
import { isMockDataEnabled } from "@/lib/data/config";
import { formatDateTime } from "@/lib/data/format";
import { paymentQueue } from "@/data/mock";
import type { PaymentQueueItem } from "@/types/lms";

export type AccountingAction = {
  id: string;
  title: string;
  detail: string;
  tone: "green" | "blue" | "amber" | "red";
  type: "approval" | "receipt" | "flag" | "refund";
};

export type AccountingDashboardData = {
  queue: PaymentQueueItem[];
  metrics: {
    pendingReview: number;
    oldestPending: string;
    approvedToday: number;
    approvedTodayAmount: number;
    flaggedDuplicates: number;
    receiptsIssued: number;
  };
  recentActions: AccountingAction[];
};

export type AccountingPaymentDetail = {
  id: string;
  status: string;
  submittedAt: string;
  submittedBy: string;
  student: { id: string; name: string; mobile: string };
  course: string;
  batch: string;
  expectedAmount: number;
  amountPaid: number;
  method: string;
  reference: string;
  paymentAt: string;
  existingEnrollment: string;
  proof: { name: string; mimeType: string; size?: string | null; available: boolean };
  duplicateCheck: { state: string; message: string };
};

export type AccountingReceipt = { id: string; payment: string; student: string; course: string; amount: string; issued: string; status: string };
export type AccountingAdjustment = { id: string; payment: string; student: string; type: string; amount: string; reason: string; date: string; status: string };
export type AccountingRefund = { id: string; payment: string; student: string; amount: string; reason: string; requested: string; status: string };
export type OutstandingRow = { id: string; student: string; course: string; expected: string; paid: string; issue: string; age: string };
export type CollectionBreakdown = { name: string; amount: string; share: number };
export type CollectionsReport = {
  metrics: { today: string; todayCount: number; week: string; weekCount: number; month: string; monthCount: number; average: string };
  methods: CollectionBreakdown[];
  courses: CollectionBreakdown[];
};

type ApiAccountingDashboard = {
  queue: ApiPaymentQueueItem[];
  metrics: {
    pending_review: number;
    oldest_pending_label: string;
    approved_today: number;
    approved_today_amount_npr: number;
    flagged_duplicates: number;
    receipts_issued: number;
  };
  recent_actions: Array<{ id: string; title: string; detail: string; tone: AccountingAction["tone"]; type: AccountingAction["type"] }>;
};

type ApiAccountingPaymentDetail = {
  id: string;
  status: string;
  submitted_at: string;
  submitted_by_name?: string | null;
  student: { id: string; student_code?: string | null; name: string; mobile?: string | null };
  course_title: string;
  batch_title: string;
  expected_amount_npr: number;
  submitted_amount_npr: number;
  payment_method: string;
  transaction_reference?: string | null;
  paid_at?: string | null;
  existing_enrollment_label?: string | null;
  proof: { original_name?: string | null; mime_type?: string | null; size_label?: string | null; available: boolean };
  duplicate_check: { state: string; message: string };
};

type ApiReceipt = { id: string; payment_id: string; student_name: string; course_title: string; amount_npr: number; issued_at: string; status: string };
type ApiAdjustment = { id: string; payment_id: string; student_name: string; type: string; amount_npr: number; reason: string; created_at: string; status: string };
type ApiRefund = { id: string; payment_id: string; student_name: string; amount_npr: number; reason: string; requested_at: string; status: string };
type ApiOutstanding = { student_id: string; student_name: string; course_title: string; expected_amount_npr: number; submitted_amount_npr?: number | null; issue: string; age_label: string };
type ApiCollectionsReport = {
  metrics: { today_npr: number; today_count: number; week_npr: number; week_count: number; month_npr: number; month_count: number; average_npr: number };
  methods: Array<{ name: string; amount_npr: number; share_percent: number }>;
  courses: Array<{ name: string; amount_npr: number; share_percent: number }>;
};

const npr = new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 });

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatNpr(value: number): string {
  return npr.format(value).replace("NPR", "NPR ").replace(/\s+/g, " ").trim();
}

function mapQueue(value: ApiPaymentQueueItem): PaymentQueueItem {
  return {
    id: value.id,
    student: value.student_name || "Student",
    course: value.course_title || value.batch_title || "Enrollment",
    amount: value.submitted_amount_npr || value.expected_amount_npr,
    method: value.payment_method,
    submitted: formatDateTime(value.submitted_at),
    risk: value.risk_label || "Normal",
    status: titleCase(value.status),
    hasProof: Boolean(value.proof_preview_available),
  };
}

function mockDashboard(): AccountingDashboardData {
  return {
    queue: paymentQueue,
    metrics: { pendingReview: 18, oldestPending: "1h 42m", approvedToday: 27, approvedTodayAmount: 184600, flaggedDuplicates: 3, receiptsIssued: 27 },
    recentActions: [
      { id: "act-1", title: "Payment approved", detail: "PAY-2083-0158 · 12:08 PM", tone: "green", type: "approval" },
      { id: "act-2", title: "Receipt issued", detail: "REC-2083-0142 · 11:46 AM", tone: "blue", type: "receipt" },
      { id: "act-3", title: "Duplicate flagged", detail: "PAY-2083-0160 · 10:58 AM", tone: "amber", type: "flag" },
    ],
  };
}

export async function getAccountingDashboard(): Promise<AccountingDashboardData> {
  if (isMockDataEnabled()) return mockDashboard();
  const response = await serverApiFetch<ApiResponse<ApiAccountingDashboard>>("/api/v1/accounting/dashboard");
  return {
    queue: response.data.queue.map(mapQueue),
    metrics: {
      pendingReview: response.data.metrics.pending_review,
      oldestPending: response.data.metrics.oldest_pending_label,
      approvedToday: response.data.metrics.approved_today,
      approvedTodayAmount: response.data.metrics.approved_today_amount_npr,
      flaggedDuplicates: response.data.metrics.flagged_duplicates,
      receiptsIssued: response.data.metrics.receipts_issued,
    },
    recentActions: response.data.recent_actions,
  };
}

export async function getAccountingPayments(): Promise<PaymentQueueItem[]> {
  if (isMockDataEnabled()) return paymentQueue;
  const response = await serverApiFetch<ApiResponse<ApiPaymentQueueItem[]> | PaginatedResponse<ApiPaymentQueueItem>>("/api/v1/accounting/payments?per_page=100");
  return response.data.map(mapQueue);
}

export async function getAccountingPayment(paymentId: string): Promise<AccountingPaymentDetail | null> {
  if (isMockDataEnabled()) {
    const queue = paymentQueue.find((item) => item.id === paymentId) || paymentQueue[0];
    if (!queue) return null;
    return {
      id: paymentId,
      status: queue.status === "Submitted" ? "Under review" : queue.status,
      submittedAt: "9 Aug 2026, 11:48 AM",
      submittedBy: "Enrollment Officer: Sanjay Bista",
      student: { id: "STD-2083-1002", name: queue.student, mobile: "+977 98XXXX1002" },
      course: queue.course,
      batch: "Morning Batch · 2083",
      expectedAmount: queue.amount,
      amountPaid: queue.amount,
      method: queue.method,
      reference: "ESW-2083-6162",
      paymentAt: "9 Aug 2026, 11:32 AM",
      existingEnrollment: "None",
      proof: { name: "payment-proof.pdf", mimeType: "application/pdf", size: "412 KB", available: true },
      duplicateCheck: { state: "clear", message: "No duplicate approved payment found" },
    };
  }
  try {
    const response = await serverApiFetch<ApiResponse<ApiAccountingPaymentDetail>>(`/api/v1/accounting/payments/${encodeURIComponent(paymentId)}`);
    const value = response.data;
    return {
      id: value.id,
      status: titleCase(value.status),
      submittedAt: formatDateTime(value.submitted_at),
      submittedBy: value.submitted_by_name || "Direct student submission",
      student: { id: value.student.student_code || value.student.id, name: value.student.name, mobile: value.student.mobile || "Not provided" },
      course: value.course_title,
      batch: value.batch_title,
      expectedAmount: value.expected_amount_npr,
      amountPaid: value.submitted_amount_npr,
      method: value.payment_method,
      reference: value.transaction_reference || "Not supplied",
      paymentAt: formatDateTime(value.paid_at),
      existingEnrollment: value.existing_enrollment_label || "None",
      proof: { name: value.proof.original_name || "Payment proof", mimeType: value.proof.mime_type || "application/octet-stream", size: value.proof.size_label, available: value.proof.available },
      duplicateCheck: value.duplicate_check,
    };
  } catch (error) {
    if (isServerApiError(error) && error.status === 404) return null;
    throw error;
  }
}

export async function getAccountingReceipts(): Promise<{ items: AccountingReceipt[]; metrics: { today: number; month: number; adjusted: number } }> {
  if (isMockDataEnabled()) return { items: [
    { id: "REC-2083-0142", payment: "PAY-2083-0142", student: "Riya Thapa", course: "BBS Microeconomics", amount: "NPR 3,500", issued: "8 Aug 2026", status: "Issued" },
    { id: "REC-2083-0141", payment: "PAY-2083-0141", student: "Anisha K.C.", course: "Banking Preparation", amount: "NPR 8,500", issued: "8 Aug 2026", status: "Issued" },
    { id: "REC-2083-0139", payment: "PAY-2083-0139", student: "Nima Sherpa", course: "CMAT Foundation", amount: "NPR 6,200", issued: "7 Aug 2026", status: "Adjusted" },
  ], metrics: { today: 27, month: 412, adjusted: 4 } };
  const response = await serverApiFetch<ApiResponse<{ items: ApiReceipt[]; metrics: { today: number; month: number; adjusted: number } }>>("/api/v1/accounting/receipts?per_page=100");
  return { items: response.data.items.map((item) => ({ id: item.id, payment: item.payment_id, student: item.student_name, course: item.course_title, amount: formatNpr(item.amount_npr), issued: formatDateTime(item.issued_at), status: titleCase(item.status) })), metrics: response.data.metrics };
}

export async function getAccountingAdjustments(): Promise<{ items: AccountingAdjustment[]; metrics: { pending: number; completedMonth: number; refundedMonthNpr: number } }> {
  if (isMockDataEnabled()) return { items: [
    { id: "ADJ-2083-0032", payment: "PAY-2083-0139", student: "Nima Sherpa", type: "Partial refund", amount: "NPR -1,200", reason: "Approved batch transfer", date: "7 Aug 2026", status: "Completed" },
    { id: "ADJ-2083-0031", payment: "PAY-2083-0128", student: "Rohan K.C.", type: "Credit", amount: "NPR 800", reason: "Duplicate amount corrected", date: "6 Aug 2026", status: "Completed" },
    { id: "ADJ-2083-0030", payment: "PAY-2083-0119", student: "Sita Rai", type: "Refund request", amount: "NPR -3,500", reason: "Policy review", date: "5 Aug 2026", status: "Pending" },
  ], metrics: { pending: 3, completedMonth: 18, refundedMonthNpr: 42800 } };
  const response = await serverApiFetch<ApiResponse<{ items: ApiAdjustment[]; metrics: { pending: number; completed_month: number; refunded_month_npr: number } }>>("/api/v1/accounting/adjustments?per_page=100");
  return { items: response.data.items.map((item) => ({ id: item.id, payment: item.payment_id, student: item.student_name, type: titleCase(item.type), amount: formatNpr(item.amount_npr), reason: item.reason, date: formatDateTime(item.created_at), status: titleCase(item.status) })), metrics: { pending: response.data.metrics.pending, completedMonth: response.data.metrics.completed_month, refundedMonthNpr: response.data.metrics.refunded_month_npr } };
}

export async function getAccountingRefunds(): Promise<{ items: AccountingRefund[]; metrics: { pending: number; completedMonth: number; completedAmountNpr: number; exceptions: number } }> {
  if (isMockDataEnabled()) return { items: [
    { id: "REF-2083-0018", payment: "PAY-2083-0149", student: "Sita Rai", amount: "NPR 3,500", reason: "Batch cancellation review", requested: "8 Aug 2026", status: "Pending" },
    { id: "REF-2083-0017", payment: "PAY-2083-0139", student: "Nima Sherpa", amount: "NPR 1,200", reason: "Approved partial refund", requested: "7 Aug 2026", status: "Completed" },
    { id: "REF-2083-0016", payment: "PAY-2083-0122", student: "Rohan K.C.", amount: "NPR 3,500", reason: "Duplicate payment", requested: "6 Aug 2026", status: "Completed" },
  ], metrics: { pending: 3, completedMonth: 11, completedAmountNpr: 42800, exceptions: 1 } };
  const response = await serverApiFetch<ApiResponse<{ items: ApiRefund[]; metrics: { pending: number; completed_month: number; completed_amount_npr: number; exceptions: number } }>>("/api/v1/accounting/refunds?per_page=100");
  return { items: response.data.items.map((item) => ({ id: item.id, payment: item.payment_id, student: item.student_name, amount: formatNpr(item.amount_npr), reason: item.reason, requested: formatDateTime(item.requested_at), status: titleCase(item.status) })), metrics: { pending: response.data.metrics.pending, completedMonth: response.data.metrics.completed_month, completedAmountNpr: response.data.metrics.completed_amount_npr, exceptions: response.data.metrics.exceptions } };
}

export async function getCollectionsReport(filters: Record<string, string> = {}): Promise<CollectionsReport> {
  if (isMockDataEnabled()) return {
    metrics: { today: "NPR 184,600", todayCount: 27, week: "NPR 684,200", weekCount: 112, month: "NPR 2.22M", monthCount: 412, average: "NPR 5,388" },
    methods: [{ name: "eSewa", amount: "NPR 1,024,400", share: 46 }, { name: "Bank transfer", amount: "NPR 742,800", share: 34 }, { name: "Khalti", amount: "NPR 448,200", share: 20 }],
    courses: [{ name: "CMAT Preparation Foundation", amount: "NPR 684,200", share: 78 }, { name: "Banking Exam Preparation", amount: "NPR 612,500", share: 70 }, { name: "BBS Microeconomics", amount: "NPR 428,600", share: 49 }, { name: "Accountancy Revision", amount: "NPR 284,100", share: 33 }],
  };
  const params = new URLSearchParams();
  for (const key of ["from", "to", "course_id"] as const) {
    const value = filters[key]?.trim();
    if (value) params.set(key, value);
  }
  const query = params.toString();
  const response = await serverApiFetch<ApiResponse<ApiCollectionsReport>>(`/api/v1/accounting/reports/collections${query ? `?${query}` : ""}`);
  return {
    metrics: { today: formatNpr(response.data.metrics.today_npr), todayCount: response.data.metrics.today_count, week: formatNpr(response.data.metrics.week_npr), weekCount: response.data.metrics.week_count, month: formatNpr(response.data.metrics.month_npr), monthCount: response.data.metrics.month_count, average: formatNpr(response.data.metrics.average_npr) },
    methods: response.data.methods.map((item) => ({ name: item.name, amount: formatNpr(item.amount_npr), share: item.share_percent })),
    courses: response.data.courses.map((item) => ({ name: item.name, amount: formatNpr(item.amount_npr), share: item.share_percent })),
  };
}

export async function getOutstandingReport(): Promise<{ items: OutstandingRow[]; metrics: { underReview: number; mismatches: number; intentOnly: number } }> {
  if (isMockDataEnabled()) return { items: [
    { id: "STD-2083-1002", student: "Suman Rai", course: "CMAT Foundation", expected: "NPR 6,200", paid: "NPR 6,200", issue: "Under review", age: "2h" },
    { id: "STD-2083-1033", student: "Aakriti Bista", course: "Banking Preparation", expected: "NPR 8,500", paid: "NPR 8,000", issue: "Amount mismatch", age: "1d" },
    { id: "STD-2083-1098", student: "Puja Rai", course: "Microeconomics", expected: "NPR 3,500", paid: "—", issue: "Intent only", age: "3d" },
  ], metrics: { underReview: 18, mismatches: 6, intentOnly: 32 } };
  const response = await serverApiFetch<ApiResponse<{ items: ApiOutstanding[]; metrics: { under_review: number; mismatches: number; intent_only: number } }>>("/api/v1/accounting/reports/outstanding");
  return { items: response.data.items.map((item) => ({ id: item.student_id, student: item.student_name, course: item.course_title, expected: formatNpr(item.expected_amount_npr), paid: item.submitted_amount_npr == null ? "—" : formatNpr(item.submitted_amount_npr), issue: titleCase(item.issue), age: item.age_label })), metrics: { underReview: response.data.metrics.under_review, mismatches: response.data.metrics.mismatches, intentOnly: response.data.metrics.intent_only } };
}
