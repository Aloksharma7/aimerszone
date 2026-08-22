import { api } from "@/lib/api/client";
import type { ApiResponse, PaginatedResponse } from "@/lib/api/contracts";
import type { ApiAnnouncement, ApiDashboard, ApiEnrollment, ApiPayment, ApiReceipt, ApiSupportOverview } from "@/lib/data/api-dtos";
import { mapAnnouncement, mapDashboard, mapEnrollment, mapPayment, mapReceipt, mapSupportOverview } from "@/lib/data/adapters";
import type { Dashboard, DashboardAnnouncement, EnrollmentSummary, Payment, Receipt, SupportOverview } from "@/types/lms";

export async function fetchDashboard(): Promise<Dashboard> {
  const response = await api.get<ApiResponse<ApiDashboard>>("/api/v1/student/dashboard");
  return mapDashboard(response.data);
}

export async function fetchCourses(): Promise<EnrollmentSummary[]> {
  const response = await api.get<ApiResponse<ApiEnrollment[]>>("/api/v1/student/courses");
  return response.data.map(mapEnrollment);
}

export type PaymentsPage = { items: Payment[]; nextPage: number | null };

export async function fetchPaymentsPage(page: number): Promise<PaymentsPage> {
  const response = await api.get<PaginatedResponse<ApiPayment>>(`/api/v1/student/payments?page=${page}`);
  return {
    items: response.data.map(mapPayment),
    nextPage: response.meta.current_page < response.meta.last_page ? response.meta.current_page + 1 : null,
  };
}

export type ReceiptsPage = { items: Receipt[]; nextPage: number | null };

export async function fetchReceiptsPage(page: number): Promise<ReceiptsPage> {
  const response = await api.get<PaginatedResponse<ApiReceipt>>(`/api/v1/student/receipts?page=${page}`);
  return {
    items: response.data.map(mapReceipt),
    nextPage: response.meta.current_page < response.meta.last_page ? response.meta.current_page + 1 : null,
  };
}

export async function fetchReceipt(receiptId: string): Promise<Receipt> {
  const response = await api.get<ApiResponse<ApiReceipt>>(`/api/v1/student/receipts/${receiptId}`);
  return mapReceipt(response.data);
}

export async function downloadReceipt(receiptId: string): Promise<{ url: string; expiresAt: string }> {
  const response = await api.post<ApiResponse<{ url: string; expires_at: string; filename: string }>>(
    `/api/v1/student/receipts/${receiptId}/download`,
  );
  return { url: response.data.url, expiresAt: response.data.expires_at };
}

export async function fetchNotifications(): Promise<DashboardAnnouncement[]> {
  const response = await api.get<ApiResponse<ApiAnnouncement[]>>("/api/v1/student/notifications");
  return response.data.map(mapAnnouncement);
}

export async function markAnnouncementRead(announcementId: string): Promise<void> {
  await api.post(`/api/v1/student/announcements/${announcementId}/read`);
}

export async function fetchSupportOverview(): Promise<SupportOverview> {
  const response = await api.get<ApiResponse<ApiSupportOverview>>("/api/v1/student/support");
  return mapSupportOverview(response.data);
}

export async function submitSupportTicket(input: { subject: string; category: string; message: string }): Promise<{ reference: string }> {
  const response = await api.post<ApiResponse<{ id: string; reference: string; status: string }>>("/api/v1/student/support-tickets", input);
  return { reference: response.data.reference };
}

export type ClassJoinDestination = { url: string; passcode: string | null; note: string | null };

/**
 * One-time-use: the server marks provisional attendance as a side effect of
 * this call, so it must only be invoked when the student actually presses
 * Join, never prefetched or retried speculatively.
 */
export async function joinClassSession(sessionId: string): Promise<ClassJoinDestination> {
  const response = await api.post<ApiResponse<{ url: string; passcode: string | null; note: string | null }>>(
    `/api/v1/student/classes/${sessionId}/join`,
  );
  return response.data;
}
