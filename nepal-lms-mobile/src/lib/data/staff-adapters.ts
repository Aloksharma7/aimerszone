import { formatDate, formatDateTime } from "@/lib/data/format";
import type {
  ApiAdjustmentQueue,
  ApiCategoryOption,
  ApiCourseOption,
  ApiLedgerAdjustment,
  ApiLedgerReceipt,
  ApiLedgerReceiptQueue,
  ApiPaymentDetail,
  ApiPaymentMethodOption,
  ApiPaymentQueueItem,
  ApiRefund,
  ApiRefundQueue,
  ApiStaffStudent,
  ApiSupportMessage,
  ApiSupportQueue,
  ApiSupportTicketDetail,
  ApiSupportTicketSummary,
} from "@/lib/data/api-dtos";
import type {
  AdjustmentQueue,
  CategoryOption,
  CourseOption,
  LedgerAdjustment,
  LedgerReceipt,
  LedgerReceiptQueue,
  PaymentDetail,
  PaymentMethodOption,
  PaymentQueueItem,
  Refund,
  RefundQueue,
  StaffStudent,
  SupportMessage,
  SupportQueue,
  SupportTicketDetail,
  SupportTicketSummary,
} from "@/types/lms";

export function mapStaffStudent(value: ApiStaffStudent): StaffStudent {
  return {
    id: value.id,
    name: value.name,
    mobile: value.mobile,
    email: value.email,
    studentCode: value.student_code,
    status: value.status,
    currentCourseTitle: value.current_course_title,
    joinedAt: value.joined_at ? formatDate(value.joined_at) : null,
  };
}

const paymentStatusMap: Record<ApiPaymentQueueItem["status"], PaymentQueueItem["status"]> = {
  approved: "Approved",
  under_review: "Under review",
  submitted: "Submitted",
  rejected: "Rejected",
  refunded: "Refunded",
  draft: "Draft",
  cancelled: "Rejected",
};

export function mapPaymentQueueItem(value: ApiPaymentQueueItem): PaymentQueueItem {
  return {
    id: value.id,
    studentName: value.student_name || "Removed account",
    status: paymentStatusMap[value.status],
    amountNpr: value.submitted_amount_npr || value.expected_amount_npr,
    method: value.payment_method,
    submittedAt: formatDateTime(value.submitted_at),
    courseTitle: value.course_title || "Course removed",
    batchTitle: value.batch_title || "Batch removed",
    riskLabel: value.risk_label,
  };
}

export function mapPaymentDetail(value: ApiPaymentDetail): PaymentDetail {
  return {
    id: value.id,
    status: value.status,
    submittedAt: formatDateTime(value.submitted_at),
    submittedByName: value.submitted_by_name,
    studentName: value.student.name,
    studentCode: value.student.student_code,
    studentMobile: value.student.mobile,
    courseTitle: value.course_title,
    batchTitle: value.batch_title,
    expectedAmountNpr: value.expected_amount_npr,
    submittedAmountNpr: value.submitted_amount_npr,
    paymentMethod: value.payment_method,
    transactionReference: value.transaction_reference,
    paidAt: value.paid_at ? formatDateTime(value.paid_at) : null,
    existingEnrollmentLabel: value.existing_enrollment_label,
    proofAvailable: value.proof.available,
    duplicateCheck: value.duplicate_check,
  };
}

export function mapCourseOption(value: ApiCourseOption): CourseOption {
  return {
    id: value.id,
    title: value.title,
    batches: (value.batches ?? []).map((batch) => ({ id: batch.id, title: batch.title, status: batch.status, priceNpr: batch.price_npr })),
  };
}

export function mapPaymentMethodOption(value: ApiPaymentMethodOption): PaymentMethodOption {
  return { id: value.id, name: value.name, accountName: value.account_name, accountIdentifier: value.account_identifier };
}

export function mapCategoryOption(value: ApiCategoryOption): CategoryOption {
  return { id: value.id, name: value.name };
}

export function mapSupportTicketSummary(value: ApiSupportTicketSummary): SupportTicketSummary {
  return {
    id: value.id,
    reference: value.reference,
    subject: value.subject,
    category: value.category,
    status: value.status,
    priority: value.priority,
    studentName: value.student_name,
    assigneeName: value.assignee_name,
    messageCount: value.message_count,
    createdAt: formatDateTime(value.created_at),
    updatedAt: formatDateTime(value.updated_at),
    resolvedAt: value.resolved_at ? formatDateTime(value.resolved_at) : null,
  };
}

export function mapSupportQueue(value: ApiSupportQueue): SupportQueue {
  return {
    items: value.items.map(mapSupportTicketSummary),
    metrics: {
      open: value.metrics.open,
      pending: value.metrics.pending,
      resolvedMonth: value.metrics.resolved_month,
      waitingOver2Days: value.metrics.waiting_over_2_days,
    },
  };
}

export function mapSupportMessage(value: ApiSupportMessage): SupportMessage {
  return { id: value.id, body: value.body, isInternal: value.is_internal, authorName: value.author_name, fromStudent: value.from_student, createdAt: formatDateTime(value.created_at) };
}

export function mapSupportTicketDetail(value: ApiSupportTicketDetail): SupportTicketDetail {
  return {
    ...mapSupportTicketSummary(value),
    message: value.message,
    email: value.email,
    mobile: value.mobile,
    resolutionNote: value.resolution_note,
    canManage: value.can_manage,
    messages: value.messages.map(mapSupportMessage),
  };
}

export function mapLedgerReceipt(value: ApiLedgerReceipt): LedgerReceipt {
  return {
    id: value.id,
    paymentId: value.payment_id,
    studentName: value.student_name,
    courseTitle: value.course_title,
    amountNpr: value.amount_npr,
    issuedAt: formatDateTime(value.issued_at),
    status: value.status,
  };
}

export function mapLedgerReceiptQueue(value: ApiLedgerReceiptQueue): LedgerReceiptQueue {
  return {
    items: value.items.map(mapLedgerReceipt),
    metrics: { today: value.metrics.today, month: value.metrics.month, adjusted: value.metrics.adjusted },
  };
}

export function mapLedgerAdjustment(value: ApiLedgerAdjustment): LedgerAdjustment {
  return {
    id: value.id,
    paymentId: value.payment_id,
    studentName: value.student_name,
    type: value.type,
    amountNpr: value.amount_npr,
    reason: value.reason,
    createdAt: formatDateTime(value.created_at),
    status: value.status,
  };
}

export function mapAdjustmentQueue(value: ApiAdjustmentQueue): AdjustmentQueue {
  return {
    items: value.items.map(mapLedgerAdjustment),
    metrics: { pending: value.metrics.pending, completedMonth: value.metrics.completed_month, refundedMonthNpr: value.metrics.refunded_month_npr },
  };
}

export function mapRefund(value: ApiRefund): Refund {
  return {
    id: value.id,
    paymentId: value.payment_id,
    studentName: value.student_name,
    amountNpr: value.amount_npr,
    reason: value.reason,
    requestedAt: formatDateTime(value.requested_at),
    status: value.status,
  };
}

export function mapRefundQueue(value: ApiRefundQueue): RefundQueue {
  return {
    items: value.items.map(mapRefund),
    metrics: {
      pending: value.metrics.pending,
      completedMonth: value.metrics.completed_month,
      completedAmountNpr: value.metrics.completed_amount_npr,
      exceptions: value.metrics.exceptions,
    },
  };
}
