import { api } from "@/lib/api/client";
import type { ApiResponse, PaginatedResponse } from "@/lib/api/contracts";
import {
  mapAdminAnnouncementQueue,
  mapAdminBatch,
  mapAdminCategory,
  mapAdminCourseOption,
  mapAdminCourseSummary,
  mapAdminDashboard,
  mapAdminFaq,
  mapAdminPermission,
  mapAdminRole,
  mapAdminSettings,
  mapAdminTeacherOption,
  mapAdminUser,
  mapAdminUserDetail,
  mapAuditLogEntry,
  mapIntegrationEvent,
  mapIntegrationStatus,
} from "@/lib/data/admin-adapters";
import type {
  ApiAcademicReportRow,
  ApiAdminAnnouncementQueue,
  ApiAdminBatch,
  ApiAdminCategory,
  ApiAdminCourseDetail,
  ApiAdminCourseOption,
  ApiAdminCourseSummary,
  ApiAdminDashboard,
  ApiAdminFaq,
  ApiAdminPermission,
  ApiAdminRole,
  ApiAdminSettings,
  ApiAdminTeacherOption,
  ApiAdminUser,
  ApiAdminUserDetail,
  ApiAuditLogEntry,
  ApiEnrollmentReportRow,
  ApiFinanceReportRow,
  ApiIntegrationEvent,
  ApiIntegrationRecord,
  ApiIntegrationStatus,
} from "@/lib/data/api-dtos";
import type {
  AdminAnnouncementQueue,
  AdminBatch,
  AdminCategory,
  AdminCourseDetail,
  AdminCourseOption,
  AdminCourseSummary,
  AdminDashboard,
  AdminFaq,
  AdminPermission,
  AdminRole,
  AdminSettings,
  AdminTeacherOption,
  AdminUser,
  AdminUserDetail,
  AuditLogEntry,
  IntegrationEvent,
  IntegrationStatus,
} from "@/types/lms";
import type { CapturedProof } from "@/components/proof-capture";

export async function fetchAdminDashboard(): Promise<AdminDashboard> {
  const response = await api.get<ApiResponse<ApiAdminDashboard>>("/api/v1/admin/dashboard");
  return mapAdminDashboard(response.data);
}

export type AdminUsersPage = { items: AdminUser[]; nextPage: number | null };

export async function fetchAdminUsersPage(page: number, query?: string): Promise<AdminUsersPage> {
  const q = query ? `&q=${encodeURIComponent(query)}` : "";
  const response = await api.get<PaginatedResponse<ApiAdminUser>>(`/api/v1/admin/users?page=${page}${q}`);
  return {
    items: response.data.map(mapAdminUser),
    nextPage: response.meta.current_page < response.meta.last_page ? response.meta.current_page + 1 : null,
  };
}

export async function fetchAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  const response = await api.get<ApiResponse<ApiAdminUserDetail>>(`/api/v1/admin/users/${userId}`);
  return mapAdminUserDetail(response.data);
}

export type NewAdminUserInput = {
  name: string;
  email: string;
  mobile?: string;
  primaryRole: "student" | "teacher" | "staff" | "admin" | "super_admin";
  passwordSetupMethod: "link" | "temporary";
};

export async function createAdminUser(input: NewAdminUserInput): Promise<{ id: string; staffCode: string | null; temporaryPassword: string | null }> {
  const response = await api.post<ApiResponse<{ id: string; staff_code?: string; temporary_password?: string }>>("/api/v1/admin/users", {
    name: input.name,
    email: input.email,
    mobile: input.mobile || null,
    primary_role: input.primaryRole,
    password_setup_method: input.passwordSetupMethod,
  });
  return { id: response.data.id, staffCode: response.data.staff_code ?? null, temporaryPassword: response.data.temporary_password ?? null };
}

export type UpdateAdminUserInput = {
  name?: string;
  email?: string | null;
  mobile?: string | null;
  primaryRole?: "student" | "teacher" | "staff" | "admin" | "super_admin";
  language?: "en" | "ne";
};

export async function updateAdminUser(userId: string, input: UpdateAdminUserInput): Promise<void> {
  await api.patch(`/api/v1/admin/users/${userId}`, {
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    primary_role: input.primaryRole,
    language: input.language,
  });
}

export type AdminUserAction = "password-reset" | "revoke-sessions" | "mfa-reset" | "suspend" | "reactivate";

export async function performAdminUserAction(userId: string, action: AdminUserAction, reason?: string): Promise<{ status: string }> {
  const response = await api.post<ApiResponse<{ status: string }>>(`/api/v1/admin/users/${userId}/actions/${action}`, { reason: reason || null });
  return response.data;
}

export async function archiveAdminUser(userId: string): Promise<void> {
  await api.delete(`/api/v1/admin/users/${userId}`);
}

export async function fetchAdminCategories(): Promise<AdminCategory[]> {
  const response = await api.get<ApiResponse<ApiAdminCategory[]>>("/api/v1/admin/categories");
  return response.data.map(mapAdminCategory);
}

export type AdminCategoryInput = { name: string; description?: string; isActive: boolean };

export async function createAdminCategory(input: AdminCategoryInput): Promise<{ id: string }> {
  const response = await api.post<ApiResponse<{ id: string }>>("/api/v1/admin/categories", {
    name: input.name,
    description: input.description || null,
    is_active: input.isActive,
  });
  return response.data;
}

export async function updateAdminCategory(categoryId: string, input: AdminCategoryInput): Promise<void> {
  await api.patch(`/api/v1/admin/categories/${categoryId}`, {
    name: input.name,
    description: input.description || null,
    is_active: input.isActive,
  });
}

export async function deleteAdminCategory(categoryId: string): Promise<void> {
  await api.delete(`/api/v1/admin/categories/${categoryId}`);
}

export type AdminCoursesPage = { items: AdminCourseSummary[]; nextPage: number | null };

export async function fetchAdminCoursesPage(page: number, query?: string, status?: string): Promise<AdminCoursesPage> {
  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set("q", query);
  if (status) params.set("status", status);
  const response = await api.get<PaginatedResponse<ApiAdminCourseSummary>>(`/api/v1/admin/courses?${params.toString()}`);
  return {
    items: response.data.map(mapAdminCourseSummary),
    nextPage: response.meta.current_page < response.meta.last_page ? response.meta.current_page + 1 : null,
  };
}

export async function fetchAdminCourseDetail(courseId: string): Promise<AdminCourseDetail> {
  const response = await api.get<ApiResponse<ApiAdminCourseDetail>>(`/api/v1/admin/courses/${courseId}`);
  return mapAdminCourseSummary(response.data);
}

export type AdminCourseInput = {
  title: string;
  slug: string;
  code: string;
  categoryId: string | null;
  shortDescription: string;
  description: string;
  accessType: "free" | "paid";
  priceNpr: number;
  originalPriceNpr: number | null;
  thumbnailUrl: string | null;
  features: string[];
  published: boolean;
};

export async function createAdminCourse(input: AdminCourseInput): Promise<{ id: string; slug: string }> {
  const response = await api.post<ApiResponse<{ id: string; slug: string }>>("/api/v1/admin/courses", {
    title: input.title,
    slug: input.slug,
    code: input.code,
    category_id: input.categoryId,
    short_description: input.shortDescription,
    description: input.description,
    access_type: input.accessType,
    price_npr: input.accessType === "free" ? 0 : input.priceNpr,
    original_price_npr: input.accessType === "free" ? null : input.originalPriceNpr,
    thumbnail_url: input.thumbnailUrl,
    features: input.features,
    published: input.published,
  });
  return response.data;
}

export async function updateAdminCourse(courseId: string, input: AdminCourseInput): Promise<{ id: string; slug: string }> {
  const response = await api.patch<ApiResponse<{ id: string; slug: string }>>(`/api/v1/admin/courses/${courseId}`, {
    title: input.title,
    category_id: input.categoryId,
    short_description: input.shortDescription,
    description: input.description,
    access_type: input.accessType,
    price_npr: input.accessType === "free" ? 0 : input.priceNpr,
    original_price_npr: input.accessType === "free" ? null : input.originalPriceNpr,
    thumbnail_url: input.thumbnailUrl,
    features: input.features,
    published: input.published,
  });
  return response.data;
}

export async function uploadAdminCourseThumbnail(courseId: string, thumbnail: CapturedProof): Promise<{ thumbnailUrl: string }> {
  const form = new FormData();
  form.append("thumbnail", thumbnail as unknown as Blob);
  const response = await api.post<ApiResponse<{ thumbnail_url: string }>>(`/api/v1/admin/courses/${courseId}/thumbnail`, form);
  return { thumbnailUrl: response.data.thumbnail_url };
}

export async function deleteAdminCourseThumbnail(courseId: string): Promise<void> {
  await api.delete(`/api/v1/admin/courses/${courseId}/thumbnail`);
}

export async function archiveAdminCourse(courseId: string): Promise<void> {
  await api.delete(`/api/v1/admin/courses/${courseId}`);
}

export async function fetchAdminCourseOptions(): Promise<AdminCourseOption[]> {
  const response = await api.get<PaginatedResponse<ApiAdminCourseOption>>("/api/v1/admin/courses?per_page=100");
  return response.data.map(mapAdminCourseOption);
}

export async function fetchAdminTeacherOptions(): Promise<AdminTeacherOption[]> {
  const response = await api.get<PaginatedResponse<ApiAdminTeacherOption>>("/api/v1/admin/teachers?per_page=100");
  return response.data.map(mapAdminTeacherOption);
}

export type AdminBatchesPage = { items: AdminBatch[]; nextPage: number | null };

export async function fetchAdminBatchesPage(page: number, query?: string, status?: string): Promise<AdminBatchesPage> {
  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set("q", query);
  if (status) params.set("status", status);
  const response = await api.get<PaginatedResponse<ApiAdminBatch>>(`/api/v1/admin/batches?${params.toString()}`);
  return {
    items: response.data.map(mapAdminBatch),
    nextPage: response.meta.current_page < response.meta.last_page ? response.meta.current_page + 1 : null,
  };
}

export async function fetchAdminBatchDetail(batchId: string): Promise<AdminBatch> {
  const response = await api.get<ApiResponse<ApiAdminBatch>>(`/api/v1/admin/batches/${batchId}`);
  return mapAdminBatch(response.data);
}

export type AdminBatchInput = {
  title: string;
  courseId: string;
  teacherIds: string[];
  scheduleSummary: string;
  startDate: string | null;
  endDate: string | null;
  accessUntilDate: string | null;
  priceNpr: number;
  capacity: number;
  status: "draft" | "open" | "ongoing" | "closed" | "cancelled";
};

export async function createAdminBatch(input: AdminBatchInput): Promise<{ id: string }> {
  const response = await api.post<ApiResponse<{ id: string }>>("/api/v1/admin/batches", {
    title: input.title,
    course_id: input.courseId,
    teacher_ids: input.teacherIds,
    schedule_summary: input.scheduleSummary,
    start_at: input.startDate || null,
    end_at: input.endDate || null,
    access_until: input.accessUntilDate || null,
    price_npr: input.priceNpr,
    capacity: input.capacity,
    status: input.status,
  });
  return response.data;
}

export async function updateAdminBatch(batchId: string, input: AdminBatchInput): Promise<void> {
  await api.patch(`/api/v1/admin/batches/${batchId}`, {
    title: input.title,
    course_id: input.courseId,
    teacher_ids: input.teacherIds,
    schedule_summary: input.scheduleSummary,
    start_at: input.startDate || null,
    end_at: input.endDate || null,
    access_until: input.accessUntilDate || null,
    price_npr: input.priceNpr,
    capacity: input.capacity,
    status: input.status,
  });
}

export async function archiveAdminBatch(batchId: string): Promise<void> {
  await api.delete(`/api/v1/admin/batches/${batchId}`);
}

export async function fetchAdminAnnouncements(): Promise<AdminAnnouncementQueue> {
  const response = await api.get<ApiResponse<ApiAdminAnnouncementQueue>>("/api/v1/admin/announcements");
  return mapAdminAnnouncementQueue(response.data);
}

export type NewAdminAnnouncementInput = {
  title: string;
  summary?: string;
  body: string;
  audience: "all" | "course" | "batch" | "role";
  courseId?: string;
  batchId?: string;
  roleKey?: string;
  channel: "portal" | "email" | "sms" | "whatsapp";
  publishAt?: string;
  pinned: boolean;
  link?: string;
};

export async function createAdminAnnouncement(input: NewAdminAnnouncementInput): Promise<{ id: string; status: string }> {
  const response = await api.post<ApiResponse<{ id: string; status: string }>>("/api/v1/admin/announcements", {
    title: input.title,
    summary: input.summary || null,
    body: input.body,
    audience: input.audience,
    course_id: input.audience === "course" ? input.courseId : null,
    batch_id: input.audience === "batch" ? input.batchId : null,
    role_key: input.audience === "role" ? input.roleKey : null,
    channel: input.channel,
    publish_at: input.publishAt || null,
    pinned: input.pinned,
    link: input.link || null,
  });
  return response.data;
}

export type AdminAnnouncementUpdate = { title?: string; summary?: string | null; body?: string; pinned?: boolean; status?: string };

export async function updateAdminAnnouncement(announcementId: string, input: AdminAnnouncementUpdate): Promise<void> {
  await api.patch(`/api/v1/admin/announcements/${announcementId}`, input);
}

export async function fetchAdminFaqs(): Promise<AdminFaq[]> {
  const response = await api.get<ApiResponse<ApiAdminFaq[]>>("/api/v1/admin/faqs");
  return response.data.map(mapAdminFaq);
}

export type AdminFaqInput = { question: string; answer: string; category?: string; isPublished: boolean };

export async function createAdminFaq(input: AdminFaqInput): Promise<{ id: string }> {
  const response = await api.post<ApiResponse<{ id: string }>>("/api/v1/admin/faqs", {
    question: input.question,
    answer: input.answer,
    category: input.category || undefined,
    is_published: input.isPublished,
  });
  return response.data;
}

export async function updateAdminFaq(faqId: string, input: AdminFaqInput): Promise<void> {
  await api.patch(`/api/v1/admin/faqs/${faqId}`, {
    question: input.question,
    answer: input.answer,
    category: input.category || undefined,
    is_published: input.isPublished,
  });
}

export async function deleteAdminFaq(faqId: string): Promise<void> {
  await api.delete(`/api/v1/admin/faqs/${faqId}`);
}

export type IntegrationProvider = "zoom" | "youtube";

export async function fetchIntegrationStatus(provider: IntegrationProvider): Promise<IntegrationStatus> {
  const response = await api.get<ApiResponse<ApiIntegrationStatus>>(`/api/v1/admin/integrations/${provider}/status`);
  return mapIntegrationStatus(response.data);
}

export async function fetchIntegrationRecords(provider: IntegrationProvider): Promise<ApiIntegrationRecord[]> {
  const response = await api.get<ApiResponse<ApiIntegrationRecord[]>>(`/api/v1/admin/integrations/${provider}/records`);
  return response.data;
}

export async function fetchIntegrationEvents(provider: IntegrationProvider): Promise<IntegrationEvent[]> {
  const response = await api.get<PaginatedResponse<ApiIntegrationEvent>>(`/api/v1/admin/integrations/${provider}/events`);
  return response.data.map(mapIntegrationEvent);
}

export async function performIntegrationAction(provider: IntegrationProvider, action: "connect" | "disconnect" | "health-check"): Promise<IntegrationStatus> {
  const response = await api.post<ApiResponse<ApiIntegrationStatus>>(`/api/v1/admin/integrations/${provider}/${action}`);
  return mapIntegrationStatus(response.data);
}

export async function fetchAdminRoles(): Promise<AdminRole[]> {
  const response = await api.get<ApiResponse<ApiAdminRole[]>>("/api/v1/admin/roles");
  return response.data.map(mapAdminRole);
}

export async function fetchAdminPermissions(): Promise<AdminPermission[]> {
  const response = await api.get<ApiResponse<ApiAdminPermission[]>>("/api/v1/admin/permissions");
  return response.data.map(mapAdminPermission);
}

export type AdminRoleInput = { name: string; description?: string; permissions: string[] };

export async function createAdminRole(input: AdminRoleInput): Promise<{ id: string }> {
  const response = await api.post<ApiResponse<{ id: string }>>("/api/v1/admin/roles", {
    name: input.name,
    description: input.description || null,
    permissions: input.permissions,
  });
  return response.data;
}

export async function updateAdminRole(roleId: string, input: AdminRoleInput): Promise<void> {
  await api.patch(`/api/v1/admin/roles/${roleId}`, {
    name: input.name,
    description: input.description || null,
    permissions: input.permissions,
  });
}

export async function deleteAdminRole(roleId: string): Promise<void> {
  await api.delete(`/api/v1/admin/roles/${roleId}`);
}

export async function fetchAdminSettings(): Promise<AdminSettings> {
  const response = await api.get<ApiResponse<ApiAdminSettings>>("/api/v1/admin/settings");
  return mapAdminSettings(response.data);
}

export type AdminSettingsUpdate = {
  institution?: Partial<{
    name: string;
    short_name: string | null;
    tagline: string | null;
    primary_phone: string | null;
    support_email: string | null;
    whatsapp: string | null;
    website: string | null;
    address: string | null;
  }>;
  security?: Partial<{
    public_registration: boolean;
    email_verification: boolean;
    privileged_mfa: boolean;
    force_password_change: boolean;
    session_timeout_hours: number;
    failed_login_attempts: number;
    lockout_minutes: number;
  }>;
  operations?: Partial<{ maintenance_notice: boolean; automatic_receipts: boolean; daily_integration_health_check: boolean }>;
  features?: Partial<{
    single_device_login: boolean;
    dynamic_watermark: boolean;
    sms_notifications: boolean;
    esewa_checkout: boolean;
    student_support_tickets: boolean;
    public_free_courses: boolean;
  }>;
  sms?: Partial<{
    provider: "sparrow" | "generic";
    endpoint: string;
    sender_id: string;
    token: string;
    notify_class_starting: boolean;
    notify_payment_decision: boolean;
    notify_enrollment_activated: boolean;
  }>;
  esewa?: Partial<{ environment: "sandbox" | "live"; merchant_code: string; secret_key: string }>;
  content?: Partial<{ watermark_opacity: number; watermark_interval_seconds: number }>;
  payment_methods?: {
    id: string;
    name: string;
    account_name: string | null;
    account_reference: string | null;
    bank_name: string | null;
    branch: string | null;
    status: "active" | "disabled";
    sort_order: number;
  }[];
};

export async function updateAdminSettings(input: AdminSettingsUpdate): Promise<AdminSettings> {
  const response = await api.patch<ApiResponse<ApiAdminSettings>>("/api/v1/admin/settings", input);
  return mapAdminSettings(response.data);
}

export async function uploadInstitutionLogo(logo: CapturedProof): Promise<{ logoUrl: string | null }> {
  const form = new FormData();
  form.append("logo", logo as unknown as Blob);
  const response = await api.post<ApiResponse<{ logo_url: string | null }>>("/api/v1/admin/settings/institution/logo", form);
  return { logoUrl: response.data.logo_url };
}

export async function deleteInstitutionLogo(): Promise<void> {
  await api.delete("/api/v1/admin/settings/institution/logo");
}

export async function uploadInstitutionFavicon(favicon: CapturedProof): Promise<{ faviconUrl: string | null }> {
  const form = new FormData();
  form.append("favicon", favicon as unknown as Blob);
  const response = await api.post<ApiResponse<{ favicon_url: string | null }>>("/api/v1/admin/settings/institution/favicon", form);
  return { faviconUrl: response.data.favicon_url };
}

export async function deleteInstitutionFavicon(): Promise<void> {
  await api.delete("/api/v1/admin/settings/institution/favicon");
}

export async function uploadPaymentMethodQr(paymentMethodId: string, qr: CapturedProof): Promise<{ qrImageUrl: string }> {
  const form = new FormData();
  form.append("qr_image", qr as unknown as Blob);
  const response = await api.post<ApiResponse<{ qr_image_url: string }>>(`/api/v1/admin/payment-methods/${paymentMethodId}/qr`, form);
  return { qrImageUrl: response.data.qr_image_url };
}

export async function deletePaymentMethodQr(paymentMethodId: string): Promise<void> {
  await api.delete(`/api/v1/admin/payment-methods/${paymentMethodId}/qr`);
}

export async function fetchAcademicReport(): Promise<ApiAcademicReportRow[]> {
  const response = await api.get<ApiResponse<ApiAcademicReportRow[]>>("/api/v1/admin/reports/academic");
  return response.data;
}

export async function fetchEnrollmentReport(): Promise<ApiEnrollmentReportRow[]> {
  const response = await api.get<ApiResponse<ApiEnrollmentReportRow[]>>("/api/v1/admin/reports/enrollments");
  return response.data;
}

export async function fetchFinanceReport(): Promise<ApiFinanceReportRow[]> {
  const response = await api.get<ApiResponse<ApiFinanceReportRow[]>>("/api/v1/admin/reports/finance");
  return response.data;
}

export type AuditLogPage = { items: AuditLogEntry[]; nextPage: number | null };

export async function fetchAuditLogPage(page: number, search?: string, actionGroup?: string): Promise<AuditLogPage> {
  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set("search", search);
  if (actionGroup) params.set("action_group", actionGroup);
  const response = await api.get<PaginatedResponse<ApiAuditLogEntry>>(`/api/v1/admin/audit-logs?${params.toString()}`);
  return {
    items: response.data.map(mapAuditLogEntry),
    nextPage: response.meta.current_page < response.meta.last_page ? response.meta.current_page + 1 : null,
  };
}
