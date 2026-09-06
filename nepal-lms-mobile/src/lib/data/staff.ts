import { api } from "@/lib/api/client";
import type { ApiResponse, PaginatedResponse } from "@/lib/api/contracts";
import type {
  ApiAdjustmentQueue,
  ApiCategoryOption,
  ApiCourseOption,
  ApiLedgerReceiptQueue,
  ApiPaymentDetail,
  ApiPaymentMethodOption,
  ApiPaymentQueueItem,
  ApiRefundQueue,
  ApiStaffStudent,
  ApiSupportAssignee,
  ApiSupportQueue,
  ApiSupportTicketDetail,
} from "@/lib/data/api-dtos";
import {
  mapAdjustmentQueue,
  mapCategoryOption,
  mapCourseOption,
  mapLedgerReceiptQueue,
  mapPaymentDetail,
  mapPaymentMethodOption,
  mapPaymentQueueItem,
  mapRefundQueue,
  mapStaffStudent,
  mapSupportQueue,
  mapSupportTicketDetail,
} from "@/lib/data/staff-adapters";
import type {
  AdjustmentQueue,
  CategoryOption,
  CourseOption,
  LedgerReceiptQueue,
  PaymentDetail,
  PaymentMethodOption,
  PaymentQueueItem,
  RefundQueue,
  StaffStudent,
  SupportAssignee,
  SupportQueue,
  SupportTicketDetail,
} from "@/types/lms";
import type { CapturedProof } from "@/components/proof-capture";

export type StudentsPage = { items: StaffStudent[]; nextPage: number | null; total: number };

export async function fetchStaffStudentsPage(page: number, query?: string): Promise<StudentsPage> {
  const q = query ? `&q=${encodeURIComponent(query)}` : "";
  const response = await api.get<PaginatedResponse<ApiStaffStudent>>(`/api/v1/staff/students?page=${page}${q}`);
  return {
    items: response.data.map(mapStaffStudent),
    nextPage: response.meta.current_page < response.meta.last_page ? response.meta.current_page + 1 : null,
    total: response.meta.total,
  };
}

export async function fetchStaffStudentDetail(studentId: string): Promise<StaffStudent> {
  const response = await api.get<ApiResponse<ApiStaffStudent>>(`/api/v1/staff/students/${studentId}`);
  return mapStaffStudent(response.data);
}

export type NewStudentInput = {
  name: string;
  mobile: string;
  email?: string;
  passwordSetupMethod: "link" | "temporary";
};

export async function createStaffStudent(input: NewStudentInput): Promise<{ id: string; studentCode: string | null; temporaryPassword: string | null }> {
  const response = await api.post<ApiResponse<{ id: string; student_code: string | null; temporary_password?: string }>>("/api/v1/staff/students", {
    name: input.name,
    mobile: input.mobile,
    email: input.email || undefined,
    password_setup_method: input.passwordSetupMethod,
  });
  return { id: response.data.id, studentCode: response.data.student_code, temporaryPassword: response.data.temporary_password ?? null };
}

export type PaymentsPage = { items: PaymentQueueItem[]; nextPage: number | null; total: number };

export async function fetchPaymentQueuePage(page: number, status?: string): Promise<PaymentsPage> {
  const filter = status ? `&status=${status}` : "";
  const response = await api.get<PaginatedResponse<ApiPaymentQueueItem>>(`/api/v1/accounting/payments?page=${page}${filter}`);
  return {
    items: response.data.map(mapPaymentQueueItem),
    nextPage: response.meta.current_page < response.meta.last_page ? response.meta.current_page + 1 : null,
    total: response.meta.total,
  };
}

export async function fetchPaymentDetail(paymentId: string): Promise<PaymentDetail> {
  const response = await api.get<ApiResponse<ApiPaymentDetail>>(`/api/v1/accounting/payments/${paymentId}`);
  return mapPaymentDetail(response.data);
}

export async function fetchPaymentProofUrl(paymentId: string): Promise<{ url: string }> {
  const response = await api.post<ApiResponse<{ url: string; expires_at: string }>>(`/api/v1/accounting/payments/${paymentId}/proof`);
  return { url: response.data.url };
}

export async function decidePayment(paymentId: string, decision: "approve" | "reject" | "flag", reason?: string): Promise<{ status: string; message: string }> {
  const response = await api.post<ApiResponse<{ status: string; message: string }>>(`/api/v1/accounting/payments/${paymentId}/decision`, {
    decision,
    reason,
  });
  return response.data;
}

export async function fetchStaffCourseOptions(): Promise<CourseOption[]> {
  const response = await api.get<PaginatedResponse<ApiCourseOption>>("/api/v1/staff/courses?per_page=100");
  return response.data.map(mapCourseOption);
}

export async function fetchPaymentMethodOptions(): Promise<PaymentMethodOption[]> {
  const response = await api.get<ApiResponse<ApiPaymentMethodOption[]>>("/api/v1/public/payment-methods");
  return response.data.map(mapPaymentMethodOption);
}

export type EnrollSubmission = {
  studentId: string;
  courseId: string;
  batchId?: string;
  paymentMethodId: string;
  amountNpr: number;
  payerName: string;
  transactionReference?: string;
  paymentDate: string;
  internalNote?: string;
  proof: { uri: string; name: string; type: string } | null;
};

export async function submitStaffEnrollment(input: EnrollSubmission): Promise<{ id: string; status: string }> {
  const form = new FormData();
  form.append("student_id", input.studentId);
  form.append("course_id", input.courseId);
  if (input.batchId) form.append("batch_id", input.batchId);
  form.append("payment_method", input.paymentMethodId);
  form.append("amount_npr", String(input.amountNpr));
  form.append("payer_name", input.payerName);
  if (input.transactionReference) form.append("transaction_reference", input.transactionReference);
  form.append("payment_date", input.paymentDate);
  if (input.internalNote) form.append("internal_note", input.internalNote);
  form.append("status", "submitted");
  if (input.proof) {
    // React Native's fetch expects this specific { uri, name, type } shape for a file part, not a Blob.
    form.append("proof", input.proof as unknown as Blob);
  }

  const response = await api.post<ApiResponse<{ id: string; status: string }>>("/api/v1/staff/payment-submissions", form);
  return response.data;
}

export async function fetchCategoryOptions(): Promise<CategoryOption[]> {
  const response = await api.get<ApiResponse<ApiCategoryOption[]>>("/api/v1/staff/categories");
  return response.data.filter((category) => category.is_active).map(mapCategoryOption);
}

export type NewCourseInput = {
  title: string;
  categoryId?: string;
  shortDescription?: string;
  description?: string;
  accessType: "free" | "paid";
  priceNpr?: number;
  publish: boolean;
};

export async function createStaffCourse(input: NewCourseInput): Promise<{ id: string; slug: string }> {
  const response = await api.post<ApiResponse<{ id: string; slug: string }>>("/api/v1/staff/courses", {
    title: input.title,
    category_id: input.categoryId || undefined,
    short_description: input.shortDescription || undefined,
    description: input.description || undefined,
    access_type: input.accessType,
    price_npr: input.accessType === "paid" ? (input.priceNpr ?? 0) : 0,
    published: input.publish,
  });
  return response.data;
}

export async function uploadCourseThumbnail(courseId: string, thumbnail: CapturedProof): Promise<void> {
  const form = new FormData();
  form.append("thumbnail", thumbnail as unknown as Blob);
  await api.post(`/api/v1/staff/courses/${courseId}/thumbnail`, form);
}

export async function fetchSupportTickets(status?: string, search?: string): Promise<SupportQueue> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  const qs = params.toString();
  const response = await api.get<ApiResponse<ApiSupportQueue>>(`/api/v1/support/tickets${qs ? `?${qs}` : ""}`);
  return mapSupportQueue(response.data);
}

export async function fetchSupportTicketDetail(ticketId: string): Promise<SupportTicketDetail> {
  const response = await api.get<ApiResponse<ApiSupportTicketDetail>>(`/api/v1/support/tickets/${ticketId}`);
  return mapSupportTicketDetail(response.data);
}

export async function fetchSupportAssignees(): Promise<SupportAssignee[]> {
  const response = await api.get<ApiResponse<ApiSupportAssignee[]>>("/api/v1/support/assignees");
  return response.data.map((item) => ({ id: item.id, name: item.name }));
}

export async function replySupportTicket(ticketId: string, body: string, isInternal: boolean): Promise<void> {
  await api.post(`/api/v1/support/tickets/${ticketId}/messages`, { body, is_internal: isInternal });
}

export type SupportTicketUpdate = { status?: string; priority?: string; assignedTo?: string; resolutionNote?: string };

export async function updateSupportTicket(ticketId: string, input: SupportTicketUpdate): Promise<void> {
  await api.patch(`/api/v1/support/tickets/${ticketId}`, {
    status: input.status,
    priority: input.priority,
    assigned_to: input.assignedTo,
    resolution_note: input.resolutionNote,
  });
}

export async function searchPaymentsForPicker(query: string): Promise<PaymentQueueItem[]> {
  const response = await api.get<PaginatedResponse<ApiPaymentQueueItem>>(`/api/v1/accounting/payments?q=${encodeURIComponent(query)}&per_page=8`);
  return response.data.map(mapPaymentQueueItem);
}

export async function fetchAdjustments(): Promise<AdjustmentQueue> {
  const response = await api.get<ApiResponse<ApiAdjustmentQueue>>("/api/v1/accounting/adjustments");
  return mapAdjustmentQueue(response.data);
}

export type NewAdjustmentInput = {
  paymentId: string;
  type: "credit" | "debit" | "reversal" | "refund";
  amountNpr: number;
  reason: string;
  authorizationReference: string;
};

export async function createAdjustment(input: NewAdjustmentInput): Promise<{ id: string }> {
  const response = await api.post<ApiResponse<{ id: string }>>("/api/v1/accounting/adjustments", {
    payment_id: input.paymentId,
    type: input.type,
    amount_npr: input.amountNpr,
    reason: input.reason,
    authorization_reference: input.authorizationReference,
  });
  return response.data;
}

export async function fetchRefunds(): Promise<RefundQueue> {
  const response = await api.get<ApiResponse<ApiRefundQueue>>("/api/v1/accounting/refunds");
  return mapRefundQueue(response.data);
}

export type NewRefundInput = { paymentId: string; amountNpr: number; reason: string; method?: string; reference?: string };

export async function createRefund(input: NewRefundInput): Promise<{ id: string; status: string }> {
  const response = await api.post<ApiResponse<{ id: string; status: string }>>("/api/v1/accounting/refunds", {
    payment_id: input.paymentId,
    amount_npr: input.amountNpr,
    reason: input.reason,
    method: input.method || undefined,
    reference: input.reference || undefined,
  });
  return response.data;
}

export async function completeRefund(refundId: string, reference: string): Promise<{ status: string }> {
  const response = await api.post<ApiResponse<{ status: string }>>(`/api/v1/accounting/refunds/${refundId}/complete`, { reference });
  return response.data;
}

export async function fetchStaffPaymentSubmissionsPage(page: number, status?: string): Promise<PaymentsPage> {
  const filter = status ? `&status=${status}` : "";
  const response = await api.get<PaginatedResponse<ApiPaymentQueueItem>>(`/api/v1/staff/payment-submissions?page=${page}${filter}`);
  return {
    items: response.data.map(mapPaymentQueueItem),
    nextPage: response.meta.current_page < response.meta.last_page ? response.meta.current_page + 1 : null,
    total: response.meta.total,
  };
}

export async function fetchStaffPaymentSubmissionDetail(paymentId: string): Promise<PaymentQueueItem> {
  const response = await api.get<ApiResponse<ApiPaymentQueueItem>>(`/api/v1/staff/payment-submissions/${paymentId}`);
  return mapPaymentQueueItem(response.data);
}

export async function fetchStaffPaymentSubmissionProofUrl(paymentId: string): Promise<{ url: string }> {
  const response = await api.post<ApiResponse<{ url: string; expires_at: string }>>(`/api/v1/staff/payment-submissions/${paymentId}/proof`);
  return { url: response.data.url };
}

export async function notifyStaffPaymentSubmission(paymentId: string, note?: string): Promise<void> {
  await api.post(`/api/v1/staff/payment-submissions/${paymentId}/notify`, { note });
}

export async function fetchLedgerReceipts(): Promise<LedgerReceiptQueue> {
  const response = await api.get<ApiResponse<ApiLedgerReceiptQueue>>("/api/v1/accounting/receipts");
  return mapLedgerReceiptQueue(response.data);
}
