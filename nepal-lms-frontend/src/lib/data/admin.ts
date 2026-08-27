import "server-only";

import type { ApiResponse, PageMeta, PaginatedResponse } from "@/lib/api/contracts";
import { pageMetaFrom } from "@/lib/api/contracts";
import { isServerApiError, serverApiFetch } from "@/lib/api/server-client";
import { mapCourse, mapTeacher } from "@/lib/data/adapters";
import type { ApiCourseDetail, ApiCourseSummary, ApiTeacher } from "@/lib/data/api-dtos";
import { isMockDataEnabled } from "@/lib/data/config";
import { formatDate, formatDateTime } from "@/lib/data/format";
import {
  academicReportRows,
  adminAnnouncements,
  adminBatches,
  adminUsers,
  enrollmentReportRows,
  financeReportRows,
  roleDefinitions,
  youtubeRecordings,
  zoomMeetings,
} from "@/data/admin";
import { auditEntries, courses, paymentQueue, teachers } from "@/data/mock";
import type {
  AdminAnnouncement,
  AdminBatch,
  AdminUser,
  AuditEntry,
  Course,
  RoleDefinition,
  StaffCourse,
  Teacher,
} from "@/types/lms";

export type AdminAttentionItem = { id: string; title: string; detail: string; href: string; tone: "amber" | "blue" | "red" | "violet" };
export type AdminServiceStatus = { name: string; value: number; status: string };
export type AdminDashboardData = {
  metrics: {
    activeStudents: number;
    activeBatches: number;
    publishedCourses: number;
    categories: number;
    activeEnrollments: number;
    pendingPayments: number;
    collectionsMonthNpr: number;
    approvedPayments: number;
  };
  attention: AdminAttentionItem[];
  services: AdminServiceStatus[];
  audit: AuditEntry[];
  readiness: { brand: number; launchData: number; policies: number; technical: number };
};

export type AdminUserDetail = {
  user: AdminUser & { studentCode?: string | null; emailVerified: boolean; initials: string };
  metrics: { activeEnrollments: number; approvedPayments: number; learningProgress: number; lastSignIn: string };
  enrollments: Array<{ id: string; course: string; batch: string; access: string; payment: string; status: string }>;
  activity: Array<{ id: string; time: string; action: string; detail: string }>;
};

export type AdminFinanceOverview = {
  queue: Array<{ id: string; student: string; course: string; amount: number; method: string; submitted: string; risk: string; status: string }>;
  metrics: { pending: number; approvedToday: number; approvedTodayNpr: number; monthNpr: number; refundsMonthNpr: number };
};

export type AcademicReportRow = { id: string; batch: string; students: number; attendance: string; testAverage: string; syllabus: string; recordings: string; followUp: number };
export type EnrollmentReportRow = { id: string; period: string; new: number; approved: number; pending: number; rejected: number; free: number; transfers: number };
export type FinanceReportRow = { id: string; date: string; transactions: number; gross: number; refunds: number; adjustments: number; net: number; pending: number };
export type IntegrationRow = Record<string, string> & { id: string };

export type AdminSettingsData = {
  institution: { name: string; shortName: string; tagline: string; primaryPhone: string; supportEmail: string; whatsapp: string; website: string; address: string; logoUrl: string | null; faviconUrl: string | null };
  paymentMethods: Array<{ id: string; name: string; accountName: string; accountReference: string; bankName: string; branch: string; qrImageUrl: string | null; status: string; sort: number }>;
  security: { publicRegistration: boolean; emailVerification: boolean; privilegedMfa: boolean; forcePasswordChange: boolean; sessionTimeoutHours: number; failedLoginAttempts: number; lockoutMinutes: number };
  operations: { maintenanceNotice: boolean; automaticReceipts: boolean; dailyIntegrationHealthCheck: boolean };
  features: Record<FeatureKey, FeatureStatus>;
  sms: { provider: string; endpoint: string; senderId: string; tokenConfigured: boolean; notifyClassStarting: boolean; notifyPaymentDecision: boolean; notifyEnrollmentActivated: boolean };
  esewa: { environment: "sandbox" | "live"; merchantCode: string; secretKeyConfigured: boolean };
  content: { watermarkOpacity: number; watermarkIntervalSeconds: number };
};

export type FeatureKey =
  | "single_device_login"
  | "dynamic_watermark"
  | "sms_notifications"
  | "esewa_checkout"
  | "student_support_tickets"
  | "public_free_courses";

/**
 * `enabled` is the switch; `ready` is whether it can actually run. A feature
 * turned on without credentials reports enabled + not ready, and `missing`
 * names what it is still waiting for.
 */
export type FeatureStatus = { enabled: boolean; ready: boolean; missing: string[] };

type ApiAdminBatch = {
  id: string;
  title: string;
  course_title: string;
  teacher_name?: string | null;
  teacher_names?: string[] | null;
  schedule_summary?: string | null;
  students_count: number;
  capacity: number;
  start_at?: string | null;
  end_at?: string | null;
  status: string;
  course_id?: string | null;
  teacher_ids?: string[] | null;
  start_date?: string | null;
  end_date?: string | null;
  access_until_date?: string | null;
  price_npr?: number | null;
};

type ApiAdminUser = {
  id: string;
  name: string;
  email?: string | null;
  mobile?: string | null;
  primary_role: string;
  status: string;
  last_seen_at?: string | null;
  mfa_enabled: boolean;
};

type ApiRoleDefinition = { id: string; key: string; name: string; users_count: number; description: string; permissions: string[]; protected: boolean };
type ApiAdminAnnouncement = { id: string; title: string; audience_label: string; author_name: string; channel_label: string; scheduled_label: string; status: string };
type ApiAuditEntry = { id: string; actor_label: string; action: string; target_label: string; occurred_at: string; reason?: string | null };

type ApiAdminDashboard = {
  metrics: { active_students: number; active_batches: number; published_courses: number; categories: number; active_enrollments: number; pending_payments: number; collections_month_npr: number; approved_payments: number };
  attention: Array<{ id: string; title: string; detail: string; href: string; tone: AdminAttentionItem["tone"] }>;
  services: Array<{ name: string; health_percent: number; status: string }>;
  audit: ApiAuditEntry[];
  readiness: { brand: number; launch_data: number; policies: number; technical: number };
};

type ApiAdminUserDetail = {
  user: ApiAdminUser & { student_code?: string | null; email_verified: boolean };
  metrics: { active_enrollments: number; approved_payments: number; learning_progress_percent: number; last_sign_in_label: string };
  enrollments: Array<{ id: string; course_title: string; batch_title: string; access_label: string; basis_label: string; status: string }>;
  activity: Array<{ id: string; occurred_at: string; action: string; detail: string }>;
};

type ApiAdminSettings = {
  institution: { name: string; short_name: string; tagline?: string | null; primary_phone?: string | null; support_email?: string | null; whatsapp?: string | null; website?: string | null; address?: string | null; logo_url?: string | null; favicon_url?: string | null };
  payment_methods: Array<{ id: string; name: string; account_name?: string | null; account_reference?: string | null; bank_name?: string | null; branch?: string | null; qr_image_url?: string | null; status: string; sort_order: number }>;
  security: { public_registration: boolean; email_verification: boolean; privileged_mfa: boolean; force_password_change: boolean; session_timeout_hours: number; failed_login_attempts: number; lockout_minutes: number };
  operations: { maintenance_notice: boolean; automatic_receipts: boolean; daily_integration_health_check: boolean };
  features: Record<FeatureKey, FeatureStatus>;
  sms: { provider: string; endpoint: string; sender_id: string; token_configured: boolean; notify_class_starting: boolean; notify_payment_decision: boolean; notify_enrollment_activated: boolean };
  esewa: { environment: "sandbox" | "live"; merchant_code: string; secret_key_configured: boolean };
  content: { watermark_opacity: number; watermark_interval_seconds: number };
};

const npr = new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 });

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function mapBatch(value: ApiAdminBatch): AdminBatch {
  return {
    id: value.id,
    name: value.title,
    course: value.course_title,
    teacher: (value.teacher_names?.length ? value.teacher_names.join(", ") : value.teacher_name) || "Not assigned",
    schedule: value.schedule_summary || "Schedule required",
    students: value.students_count,
    capacity: value.capacity,
    startDate: formatDate(value.start_at),
    endDate: formatDate(value.end_at),
    status: titleCase(value.status),
    courseId: value.course_id || "",
    teacherIds: value.teacher_ids || [],
    startAt: value.start_date || "",
    endAt: value.end_date || "",
    accessUntil: value.access_until_date || "",
    priceNpr: value.price_npr ?? 0,
  };
}

function mapUser(value: ApiAdminUser): AdminUser {
  return {
    id: value.id,
    name: value.name,
    email: value.email || "Not provided",
    phone: value.mobile || "Not provided",
    role: titleCase(value.primary_role),
    status: titleCase(value.status),
    lastSeen: value.last_seen_at ? formatDateTime(value.last_seen_at) : "Never",
    mfa: value.mfa_enabled ? "Enabled" : "Not enabled",
  };
}

function mapRole(value: ApiRoleDefinition): RoleDefinition {
  return { id: value.id, key: value.key, name: value.name, users: value.users_count, description: value.description, permissions: value.permissions, protected: value.protected };
}

function mapAnnouncement(value: ApiAdminAnnouncement): AdminAnnouncement {
  return { id: value.id, title: value.title, audience: value.audience_label, author: value.author_name, channel: value.channel_label, scheduled: value.scheduled_label, status: titleCase(value.status) };
}

function mapAudit(value: ApiAuditEntry): AuditEntry {
  return { id: value.id, actor: value.actor_label, action: value.action, target: value.target_label, time: formatDateTime(value.occurred_at), reason: value.reason || "Not supplied" };
}

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  if (isMockDataEnabled()) return {
    metrics: { activeStudents: 1248, activeBatches: 18, publishedCourses: 25, categories: 5, activeEnrollments: 1144, pendingPayments: 38, collectionsMonthNpr: 2220000, approvedPayments: 412 },
    attention: [
      { id: "payment-pending", title: "18 payments pending", detail: "Oldest submission is 1h 42m", href: "/admin/payments", tone: "amber" },
      { id: "attendance-pending", title: "1 attendance pending", detail: "Teacher finalization required", href: "/admin/attendance", tone: "blue" },
      { id: "zoom-warning", title: "2 Zoom sync warnings", detail: "Manual fallback available", href: "/admin/integrations/zoom", tone: "red" },
      { id: "draft-batches", title: "4 draft batches", detail: "Missing launch information", href: "/admin/batches", tone: "violet" },
    ],
    services: [{ name: "Web application", value: 100, status: "Operational" }, { name: "Laravel API", value: 100, status: "Operational" }, { name: "Zoom integration", value: 78, status: "Degraded" }, { name: "Email delivery", value: 100, status: "Operational" }],
    audit: auditEntries,
    readiness: { brand: 72, launchData: 64, policies: 48, technical: 82 },
  };
  const response = await serverApiFetch<ApiResponse<ApiAdminDashboard>>("/api/v1/admin/dashboard");
  return {
    metrics: { activeStudents: response.data.metrics.active_students, activeBatches: response.data.metrics.active_batches, publishedCourses: response.data.metrics.published_courses, categories: response.data.metrics.categories, activeEnrollments: response.data.metrics.active_enrollments, pendingPayments: response.data.metrics.pending_payments, collectionsMonthNpr: response.data.metrics.collections_month_npr, approvedPayments: response.data.metrics.approved_payments },
    attention: response.data.attention,
    services: response.data.services.map((service) => ({ name: service.name, value: service.health_percent, status: service.status })),
    audit: response.data.audit.map(mapAudit),
    readiness: { brand: response.data.readiness.brand, launchData: response.data.readiness.launch_data, policies: response.data.readiness.policies, technical: response.data.readiness.technical },
  };
}

function mockAdminCourses(): StaffCourse[] {
  return (courses as unknown as Course[]).map((course) => ({ ...course, id: course.id || course.slug, published: course.published ?? true, enrollments: 0, batchCount: 1, lastUpdated: course.updatedAt || "Recently" }));
}

export async function getAdminCourses(): Promise<StaffCourse[]> {
  if (isMockDataEnabled()) return mockAdminCourses();
  const response = await serverApiFetch<ApiResponse<ApiCourseSummary[]> | PaginatedResponse<ApiCourseSummary>>("/api/v1/admin/courses?per_page=100");
  return response.data.map((item) => ({ ...mapCourse(item), enrollments: 0, batchCount: item.available_batches ?? item.batches?.length ?? 0, lastUpdated: item.updated_at ? formatDateTime(item.updated_at) : "Not available" }));
}

const ADMIN_COURSES_PER_PAGE = 20;

/**
 * Paginated, server-filtered course list for the /admin/courses table
 * itself. Kept separate from getAdminCourses() — that one returns an
 * unpaginated batch and is also used by the batch create/edit forms' course
 * picker and this same page's own metric cards, neither of which should be
 * capped to a single page's worth of results.
 *
 * The backend (Admin\CourseController) filters on `q`, `status` and
 * `category_id`. The page's category dropdown is built from category
 * *names* rather than ids (there is no lookup from name to id at this
 * level), so that one filter still applies to whatever page is on screen.
 */
export async function getAdminCoursesPage(params: { page?: number; q?: string; status?: string } = {}): Promise<{ items: StaffCourse[]; meta: PageMeta }> {
  const page = params.page && params.page > 0 ? params.page : 1;

  if (isMockDataEnabled()) {
    const term = (params.q || "").trim().toLocaleLowerCase();
    const filtered = mockAdminCourses().filter((item) => {
      const status = item.published ? "Published" : "Draft";
      return (!term || [item.title, item.slug, item.code, item.category].some((value) => String(value ?? "").toLocaleLowerCase().includes(term)))
        && (!params.status || status === params.status);
    });
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / ADMIN_COURSES_PER_PAGE));
    const currentPage = Math.min(page, lastPage);
    const start = (currentPage - 1) * ADMIN_COURSES_PER_PAGE;
    const items = filtered.slice(start, start + ADMIN_COURSES_PER_PAGE);
    return { items, meta: { currentPage, lastPage, total, from: total ? start + 1 : null, to: total ? start + items.length : null } };
  }

  const query = new URLSearchParams({ per_page: String(ADMIN_COURSES_PER_PAGE), page: String(page) });
  if (params.q) query.set("q", params.q);
  if (params.status) query.set("status", params.status);
  const response = await serverApiFetch<PaginatedResponse<ApiCourseSummary>>(`/api/v1/admin/courses?${query.toString()}`);
  return { items: response.data.map((item) => ({ ...mapCourse(item), enrollments: 0, batchCount: item.available_batches ?? item.batches?.length ?? 0, lastUpdated: item.updated_at ? formatDateTime(item.updated_at) : "Not available" })), meta: pageMetaFrom(response.meta) };
}

export async function getAdminCourse(courseId: string): Promise<StaffCourse | null> {
  if (isMockDataEnabled()) {
    const course = (courses as unknown as Course[]).find((item) => item.slug === courseId || item.id === courseId);
    return course ? { ...course, id: course.id || course.slug, published: course.published ?? true, enrollments: 0, batchCount: 1, lastUpdated: course.updatedAt || "Recently" } : null;
  }
  try {
    const response = await serverApiFetch<ApiResponse<ApiCourseDetail>>(`/api/v1/admin/courses/${encodeURIComponent(courseId)}`);
    return { ...mapCourse(response.data), enrollments: 0, batchCount: response.data.batches?.length ?? 0, lastUpdated: response.data.updated_at ? formatDateTime(response.data.updated_at) : "Not available" };
  } catch (error) {
    if (isServerApiError(error) && error.status === 404) return null;
    throw error;
  }
}

export async function getAdminBatches(): Promise<AdminBatch[]> {
  if (isMockDataEnabled()) return adminBatches;
  const response = await serverApiFetch<ApiResponse<ApiAdminBatch[]> | PaginatedResponse<ApiAdminBatch>>("/api/v1/admin/batches?per_page=100");
  return response.data.map(mapBatch);
}

const ADMIN_BATCHES_PER_PAGE = 20;

/**
 * Paginated, server-filtered batch list for the /admin/batches table itself.
 * Kept separate from getAdminBatches() — that one returns an unpaginated
 * batch and is also used by the announcements batch picker and this same
 * page's own metric cards, neither of which should be capped to a single
 * page's worth of results.
 *
 * The backend (Admin\BatchController) filters on `status` and `course_id`
 * only — there is no server-side text search for this endpoint, so a typed
 * search term is matched against whatever page is currently on screen.
 */
export async function getAdminBatchesPage(params: { page?: number; status?: string } = {}): Promise<{ items: AdminBatch[]; meta: PageMeta }> {
  const page = params.page && params.page > 0 ? params.page : 1;

  if (isMockDataEnabled()) {
    const filtered = adminBatches.filter((item) => !params.status || item.status === params.status);
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / ADMIN_BATCHES_PER_PAGE));
    const currentPage = Math.min(page, lastPage);
    const start = (currentPage - 1) * ADMIN_BATCHES_PER_PAGE;
    const items = filtered.slice(start, start + ADMIN_BATCHES_PER_PAGE);
    return { items, meta: { currentPage, lastPage, total, from: total ? start + 1 : null, to: total ? start + items.length : null } };
  }

  const query = new URLSearchParams({ per_page: String(ADMIN_BATCHES_PER_PAGE), page: String(page) });
  if (params.status) query.set("status", params.status);
  const response = await serverApiFetch<PaginatedResponse<ApiAdminBatch>>(`/api/v1/admin/batches?${query.toString()}`);
  return { items: response.data.map(mapBatch), meta: pageMetaFrom(response.meta) };
}

export async function getAdminBatch(batchId: string): Promise<AdminBatch | null> {
  if (isMockDataEnabled()) return adminBatches.find((batch) => batch.id === batchId) ?? null;
  try {
    const response = await serverApiFetch<ApiResponse<ApiAdminBatch>>(`/api/v1/admin/batches/${encodeURIComponent(batchId)}`);
    return mapBatch(response.data);
  } catch (error) {
    if (isServerApiError(error) && error.status === 404) return null;
    throw error;
  }
}

export async function getAdminTeachers(): Promise<Teacher[]> {
  if (isMockDataEnabled()) return teachers;
  const response = await serverApiFetch<ApiResponse<ApiTeacher[]> | PaginatedResponse<ApiTeacher>>("/api/v1/admin/teachers?per_page=100");
  return response.data.map(mapTeacher);
}

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  courseCount: number;
};

type ApiAdminCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  course_count: number;
};

/**
 * Includes inactive categories, unlike /public/categories. The course form
 * needs the full list so an administrator can see what exists before creating
 * another one.
 */
export async function getAdminCategories(endpointBase = "/api/v1/admin/categories"): Promise<AdminCategory[]> {
  if (isMockDataEnabled()) {
    return [
      { id: "cat-management", name: "Management", slug: "management", description: null, sortOrder: 0, isActive: true, courseCount: 2 },
      { id: "cat-science", name: "Science", slug: "science", description: null, sortOrder: 1, isActive: true, courseCount: 1 },
    ];
  }

  const response = await serverApiFetch<ApiResponse<ApiAdminCategory[]>>(endpointBase);
  return response.data.map((item) => ({
    id: item.id,
    name: item.name,
    slug: item.slug,
    description: item.description,
    sortOrder: item.sort_order,
    isActive: item.is_active,
    courseCount: item.course_count,
  }));
}

export type AdminFaq = {
  id: string;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  isPublished: boolean;
};

type ApiAdminFaq = {
  id: string;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
  is_published: boolean;
};

/**
 * Includes unpublished entries, unlike /public/faqs. The only way an entry
 * ever existed before this screen was a one-time demo seeder — nothing
 * anywhere could add, edit or remove one after launch.
 */
export async function getAdminFaqs(): Promise<AdminFaq[]> {
  if (isMockDataEnabled()) {
    return [
      { id: "faq-refund", question: "What is the refund policy?", answer: "See the refund policy page for the full terms.", category: "payments", sortOrder: 0, isPublished: true },
      { id: "faq-recordings", question: "How long are recordings available?", answer: "Recordings stay available for the duration of your enrollment access.", category: "general", sortOrder: 1, isPublished: true },
    ];
  }

  const response = await serverApiFetch<ApiResponse<ApiAdminFaq[]>>("/api/v1/admin/faqs");
  return response.data.map((item) => ({
    id: item.id,
    question: item.question,
    answer: item.answer,
    category: item.category,
    sortOrder: item.sort_order,
    isPublished: item.is_published,
  }));
}

export type SyllabusEditorData = {
  courseId: string;
  courseTitle: string;
  modules: Array<{ id: string | null; title: string; summary: string; lessons: Array<{ id: string | null; title: string; type: string }> }>;
};

type ApiSyllabus = {
  course_id: string;
  course_title: string;
  modules: Array<{ id: string; title: string; summary: string | null; order: number; lessons: Array<{ id: string; title: string; type: string; order: number }> }>;
};

export async function getCourseSyllabus(courseId: string, endpointBase = "/api/v1/admin/courses"): Promise<SyllabusEditorData> {
  if (isMockDataEnabled()) {
    return {
      courseId,
      courseTitle: "Preview course",
      modules: [
        { id: "mod-1", title: "Demand and Supply", summary: "", lessons: [{ id: "les-1", title: "Law of demand", type: "Lesson" }] },
      ],
    };
  }

  const response = await serverApiFetch<ApiResponse<ApiSyllabus>>(
    `${endpointBase}/${encodeURIComponent(courseId)}/syllabus`,
  );

  return {
    courseId: response.data.course_id,
    courseTitle: response.data.course_title,
    modules: response.data.modules.map((module) => ({
      id: module.id,
      title: module.title,
      summary: module.summary || "",
      lessons: module.lessons.map((lesson) => ({ id: lesson.id, title: lesson.title, type: lesson.type })),
    })),
  };
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  if (isMockDataEnabled()) return adminUsers;
  const response = await serverApiFetch<ApiResponse<ApiAdminUser[]> | PaginatedResponse<ApiAdminUser>>("/api/v1/admin/users?per_page=100");
  return response.data.map(mapUser);
}

const ADMIN_USERS_PER_PAGE = 20;

/**
 * Paginated, server-filtered user list for the /admin/users table itself.
 * Kept separate from getAdminUsers() — that one returns an unpaginated
 * batch and still feeds this same page's own metric cards (Active /
 * Privileged / Suspended), which are computed from the full fetched set
 * rather than a single page.
 *
 * The backend (Admin\UserController) filters on `q`, `role` (a role key,
 * not the display name shown in the table) and `status`. The page's role
 * dropdown is built from role *names*, so that filter still applies to
 * whatever page is on screen; the mfa filter has no backend equivalent
 * either and does the same.
 */
export async function getAdminUsersPage(params: { page?: number; q?: string; status?: string } = {}): Promise<{ items: AdminUser[]; meta: PageMeta }> {
  const page = params.page && params.page > 0 ? params.page : 1;

  if (isMockDataEnabled()) {
    const term = (params.q || "").trim().toLocaleLowerCase();
    const filtered = adminUsers.filter(
      (item) =>
        (!term || [item.id, item.name, item.email, item.phone, item.role].some((value) => String(value ?? "").toLocaleLowerCase().includes(term))) &&
        (!params.status || item.status === params.status),
    );
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / ADMIN_USERS_PER_PAGE));
    const currentPage = Math.min(page, lastPage);
    const start = (currentPage - 1) * ADMIN_USERS_PER_PAGE;
    const items = filtered.slice(start, start + ADMIN_USERS_PER_PAGE);
    return { items, meta: { currentPage, lastPage, total, from: total ? start + 1 : null, to: total ? start + items.length : null } };
  }

  const query = new URLSearchParams({ per_page: String(ADMIN_USERS_PER_PAGE), page: String(page) });
  if (params.q) query.set("q", params.q);
  if (params.status) query.set("status", params.status);
  const response = await serverApiFetch<PaginatedResponse<ApiAdminUser>>(`/api/v1/admin/users?${query.toString()}`);
  return { items: response.data.map(mapUser), meta: pageMetaFrom(response.meta) };
}

export async function getAdminUser(userId: string): Promise<AdminUserDetail | null> {
  if (isMockDataEnabled()) {
    const user = adminUsers.find((item) => item.id === userId) || adminUsers[0];
    if (!user) return null;
    return {
      user: { ...user, studentCode: user.role === "Student" ? "STD-2083-1001" : null, emailVerified: true, initials: initials(user.name) },
      metrics: { activeEnrollments: 2, approvedPayments: 1, learningProgress: 48, lastSignIn: "8 min" },
      enrollments: [
        { id: "ENR-2083-3101", course: "BBS First Year Microeconomics", batch: "Evening Batch · 2083", access: "Until 15 Dec 2026", payment: "PAY-2083-0142", status: "Active" },
        { id: "ENR-2083-3044", course: "Free Study Skills Orientation", batch: "Self-paced", access: "Until 5 Sep 2026", payment: "Free", status: "Active" },
      ],
      activity: [
        { id: "EVT-01", time: "9 Aug, 4:08 PM", action: "Signed in", detail: "Recognized browser · Kathmandu" },
        { id: "EVT-02", time: "9 Aug, 3:44 PM", action: "Recording progress", detail: "Price Elasticity of Demand · 62%" },
        { id: "EVT-03", time: "8 Aug, 4:21 PM", action: "Payment approved", detail: "PAY-2083-0142 · NPR 3,500" },
        { id: "EVT-04", time: "8 Aug, 3:58 PM", action: "Enrollment created", detail: "Microeconomics Evening Batch" },
      ],
    };
  }
  try {
    const response = await serverApiFetch<ApiResponse<ApiAdminUserDetail>>(`/api/v1/admin/users/${encodeURIComponent(userId)}`);
    const user = mapUser(response.data.user);
    return {
      user: { ...user, studentCode: response.data.user.student_code, emailVerified: response.data.user.email_verified, initials: initials(user.name) },
      metrics: { activeEnrollments: response.data.metrics.active_enrollments, approvedPayments: response.data.metrics.approved_payments, learningProgress: response.data.metrics.learning_progress_percent, lastSignIn: response.data.metrics.last_sign_in_label },
      enrollments: response.data.enrollments.map((item) => ({ id: item.id, course: item.course_title, batch: item.batch_title, access: item.access_label, payment: item.basis_label, status: titleCase(item.status) })),
      activity: response.data.activity.map((item) => ({ id: item.id, time: formatDateTime(item.occurred_at), action: item.action, detail: item.detail })),
    };
  } catch (error) {
    if (isServerApiError(error) && error.status === 404) return null;
    throw error;
  }
}

export async function getAdminRoles(): Promise<RoleDefinition[]> {
  if (isMockDataEnabled()) return roleDefinitions;
  const response = await serverApiFetch<ApiResponse<ApiRoleDefinition[]> | PaginatedResponse<ApiRoleDefinition>>("/api/v1/admin/roles?per_page=100");
  return response.data.map(mapRole);
}

export type AdminPermission = { id: string; key: string; group: string; description: string | null };

type ApiAdminPermission = { id: string; key: string; group: string; description: string | null };

/** The full permission catalogue a role's checkbox set can be composed from. */
export async function getAdminPermissions(): Promise<AdminPermission[]> {
  if (isMockDataEnabled()) {
    return roleDefinitions.flatMap((role) => role.permissions).filter((value, index, all) => all.indexOf(value) === index)
      .map((label, index) => ({ id: `perm-${index}`, key: label, group: "general", description: null }));
  }
  const response = await serverApiFetch<ApiResponse<ApiAdminPermission[]>>("/api/v1/admin/permissions");
  return response.data.map((item) => ({ id: item.id, key: item.key, group: item.group, description: item.description }));
}

export async function getAdminAnnouncements(): Promise<{ items: AdminAnnouncement[]; metrics: { publishedMonth: number; scheduled: number; nextScheduled: string; deliveryRate: string } }> {
  if (isMockDataEnabled()) return { items: adminAnnouncements, metrics: { publishedMonth: 28, scheduled: 3, nextScheduled: "10 Aug, 6:00 AM", deliveryRate: "98.7%" } };
  const response = await serverApiFetch<ApiResponse<{ items: ApiAdminAnnouncement[]; metrics: { published_month: number; scheduled: number; next_scheduled_label: string; delivery_rate_percent: number } }>>("/api/v1/admin/announcements?per_page=100");
  return { items: response.data.items.map(mapAnnouncement), metrics: { publishedMonth: response.data.metrics.published_month, scheduled: response.data.metrics.scheduled, nextScheduled: response.data.metrics.next_scheduled_label, deliveryRate: `${response.data.metrics.delivery_rate_percent}%` } };
}

const AUDIT_LOGS_PER_PAGE = 25;

/**
 * Paginated, server-filtered audit trail for the /admin/audit-logs screen —
 * the only consumer of this data, so it is safe to convert in place rather
 * than adding a parallel xxxPage() function.
 *
 * The backend (Admin\AuditLogController) filters on `search`, `actor_type`,
 * `action_group`, `from` and `to` — matching the page's own filter bar.
 */
export async function getAdminAuditLogs(filters: Record<string, string | undefined> = {}, page = 1): Promise<{ items: AuditEntry[]; meta: PageMeta }> {
  if (isMockDataEnabled()) {
    const all = [...auditEntries, { id: "AUD-090808", actor: "superadmin@example.test", action: "Role permission reviewed", target: "Staff", time: "8 Aug, 5:25 PM", reason: "Quarterly access review" }, { id: "AUD-090807", actor: "staff@example.test", action: "Refund approved", target: "REF-2083-0018", time: "8 Aug, 4:42 PM", reason: "Duplicate payment confirmed" }, { id: "AUD-090806", actor: "superadmin@example.test", action: "Zoom policy changed", target: "Integration settings", time: "8 Aug, 3:10 PM", reason: "Enable daily reconciliation" }];
    const term = (filters.search || "").trim().toLocaleLowerCase();
    const filtered = all.filter((item) => !term || [item.actor, item.action, item.target, item.reason].some((value) => String(value ?? "").toLocaleLowerCase().includes(term)));
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / AUDIT_LOGS_PER_PAGE));
    const currentPage = Math.min(page && page > 0 ? page : 1, lastPage);
    const start = (currentPage - 1) * AUDIT_LOGS_PER_PAGE;
    const items = filtered.slice(start, start + AUDIT_LOGS_PER_PAGE);
    return { items, meta: { currentPage, lastPage, total, from: total ? start + 1 : null, to: total ? start + items.length : null } };
  }
  const query = new URLSearchParams({ per_page: String(AUDIT_LOGS_PER_PAGE), page: String(page && page > 0 ? page : 1) });
  for (const key of ["search", "actor_type", "action_group", "from", "to"]) { const value = filters[key]?.trim(); if (value) query.set(key, value.slice(0, 160)); }
  const response = await serverApiFetch<PaginatedResponse<ApiAuditEntry>>(`/api/v1/admin/audit-logs?${query.toString()}`);
  return { items: response.data.map(mapAudit), meta: pageMetaFrom(response.meta) };
}

export async function getAdminFinanceOverview(): Promise<AdminFinanceOverview> {
  if (isMockDataEnabled()) return { queue: paymentQueue, metrics: { pending: 18, approvedToday: 27, approvedTodayNpr: 184600, monthNpr: 2220000, refundsMonthNpr: 42800 } };
  /*
   * The API payload is snake_case and AdminFinanceOverview is camelCase.
   * Returning response.data unmapped left every metric on the Finance
   * Oversight page undefined, which renders as "NPR NaN" — the same fault the
   * payment wizard had.
   */
  const response = await serverApiFetch<ApiResponse<{
    queue: Array<{ id: string; student: string; course: string; amount: number; method: string; submitted: string; risk: string; status: string }>;
    metrics: { pending: number; approved_today: number; approved_today_npr: number; month_npr: number; refunds_month_npr: number };
  }>>("/api/v1/admin/finance-overview");

  return {
    queue: response.data.queue.map((item) => ({
      ...item,
      submitted: formatDateTime(item.submitted),
      status: titleCase(item.status),
    })),
    metrics: {
      pending: response.data.metrics.pending,
      approvedToday: response.data.metrics.approved_today,
      approvedTodayNpr: response.data.metrics.approved_today_npr,
      monthNpr: response.data.metrics.month_npr,
      refundsMonthNpr: response.data.metrics.refunds_month_npr,
    },
  };
}

type AdminReportFilters = Record<string, string | undefined>;

function withAdminReportFilters(path: string, filters: AdminReportFilters = {}): string {
  const allowed = new Set(["from", "to", "course_id", "batch_id", "teacher_id", "payment_method", "source", "status"]);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (allowed.has(key) && value?.trim()) query.set(key, value.trim().slice(0, 120));
  }
  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
}

export async function getAdminAcademicReport(filters: AdminReportFilters = {}): Promise<AcademicReportRow[]> {
  if (isMockDataEnabled()) return academicReportRows;
  const response = await serverApiFetch<ApiResponse<AcademicReportRow[]> | PaginatedResponse<AcademicReportRow>>(withAdminReportFilters("/api/v1/admin/reports/academic", filters));
  return response.data;
}

export async function getAdminEnrollmentReport(filters: AdminReportFilters = {}): Promise<EnrollmentReportRow[]> {
  if (isMockDataEnabled()) return enrollmentReportRows;
  const response = await serverApiFetch<ApiResponse<EnrollmentReportRow[]> | PaginatedResponse<EnrollmentReportRow>>(withAdminReportFilters("/api/v1/admin/reports/enrollments", filters));
  return response.data;
}

export async function getAdminFinanceReport(filters: AdminReportFilters = {}): Promise<FinanceReportRow[]> {
  if (isMockDataEnabled()) return financeReportRows;
  const response = await serverApiFetch<ApiResponse<FinanceReportRow[]> | PaginatedResponse<FinanceReportRow>>(withAdminReportFilters("/api/v1/admin/reports/finance", filters));
  return response.data;
}

export type IntegrationStatus = { connected: boolean; status: string; missing: string[] };

export async function getAdminIntegrationStatus(provider: "zoom" | "youtube"): Promise<IntegrationStatus> {
  if (isMockDataEnabled()) return { connected: true, status: "connected", missing: [] };
  const response = await serverApiFetch<ApiResponse<IntegrationStatus>>(`/api/v1/admin/integrations/${provider}/status`);
  return response.data;
}

export async function getAdminIntegrationRows(provider: "zoom" | "youtube"): Promise<IntegrationRow[]> {
  if (isMockDataEnabled()) return (provider === "zoom" ? zoomMeetings : youtubeRecordings) as unknown as IntegrationRow[];
  const response = await serverApiFetch<ApiResponse<IntegrationRow[]> | PaginatedResponse<IntegrationRow>>(`/api/v1/admin/integrations/${provider}/records?per_page=100`);
  return response.data;
}


export async function getAdminSettings(): Promise<AdminSettingsData> {
  if (isMockDataEnabled()) return {
    institution: { name: "Institution LMS", shortName: "LMS", tagline: "Live classes, recordings, tests and support in one clear place.", primaryPhone: "+977 98XXXXXXXX", supportEmail: "support@example.com", whatsapp: "97798XXXXXXXX", website: "https://learn.example.com", address: "Kathmandu, Nepal", logoUrl: null, faviconUrl: null },
    paymentMethods: [{ id: "pm-esewa", name: "eSewa", accountName: "Institution LMS", accountReference: "98XXXXXX01", bankName: "", branch: "", qrImageUrl: null, status: "Active", sort: 1 }, { id: "pm-khalti", name: "Khalti", accountName: "Institution LMS", accountReference: "98XXXXXX02", bankName: "", branch: "", qrImageUrl: null, status: "Active", sort: 2 }, { id: "pm-bank", name: "Bank transfer", accountName: "Institution LMS Pvt. Ltd.", accountReference: "Account ending 2083", bankName: "Nepal Investment Bank", branch: "New Road", qrImageUrl: null, status: "Active", sort: 3 }, { id: "pm-cash", name: "Cash at office", accountName: "Main office", accountReference: "Receipt required", bankName: "", branch: "", qrImageUrl: null, status: "Paused", sort: 4 }],
    security: { publicRegistration: true, emailVerification: true, privilegedMfa: true, forcePasswordChange: true, sessionTimeoutHours: 8, failedLoginAttempts: 5, lockoutMinutes: 15 },
    operations: { maintenanceNotice: false, automaticReceipts: true, dailyIntegrationHealthCheck: true },
    features: {
      single_device_login: { enabled: false, ready: true, missing: [] },
      dynamic_watermark: { enabled: true, ready: true, missing: [] },
      sms_notifications: { enabled: false, ready: false, missing: ["SMS provider token"] },
      esewa_checkout: { enabled: false, ready: false, missing: ["Secret key"] },
      student_support_tickets: { enabled: true, ready: true, missing: [] },
      public_free_courses: { enabled: true, ready: true, missing: [] },
    },
    sms: { provider: "sparrow", endpoint: "https://api.sparrowsms.com/v2/sms/", senderId: "Demo", tokenConfigured: false, notifyClassStarting: true, notifyPaymentDecision: true, notifyEnrollmentActivated: true },
    esewa: { environment: "sandbox", merchantCode: "EPAYTEST", secretKeyConfigured: false },
    content: { watermarkOpacity: 18, watermarkIntervalSeconds: 12 },
  };
  const response = await serverApiFetch<ApiResponse<ApiAdminSettings>>("/api/v1/admin/settings");
  return {
    institution: { name: response.data.institution.name, shortName: response.data.institution.short_name, tagline: response.data.institution.tagline || "", primaryPhone: response.data.institution.primary_phone || "", supportEmail: response.data.institution.support_email || "", whatsapp: response.data.institution.whatsapp || "", website: response.data.institution.website || "", address: response.data.institution.address || "", logoUrl: response.data.institution.logo_url || null, faviconUrl: response.data.institution.favicon_url || null },
    paymentMethods: response.data.payment_methods.map((item) => ({ id: item.id, name: item.name, accountName: item.account_name || "", accountReference: item.account_reference || "", bankName: item.bank_name || "", branch: item.branch || "", qrImageUrl: item.qr_image_url || null, status: titleCase(item.status), sort: item.sort_order })),
    security: { publicRegistration: response.data.security.public_registration, emailVerification: response.data.security.email_verification, privilegedMfa: response.data.security.privileged_mfa, forcePasswordChange: response.data.security.force_password_change, sessionTimeoutHours: response.data.security.session_timeout_hours, failedLoginAttempts: response.data.security.failed_login_attempts, lockoutMinutes: response.data.security.lockout_minutes },
    operations: { maintenanceNotice: response.data.operations.maintenance_notice, automaticReceipts: response.data.operations.automatic_receipts, dailyIntegrationHealthCheck: response.data.operations.daily_integration_health_check },
    features: response.data.features,
    sms: { provider: response.data.sms.provider, endpoint: response.data.sms.endpoint, senderId: response.data.sms.sender_id, tokenConfigured: response.data.sms.token_configured, notifyClassStarting: response.data.sms.notify_class_starting, notifyPaymentDecision: response.data.sms.notify_payment_decision, notifyEnrollmentActivated: response.data.sms.notify_enrollment_activated },
    esewa: { environment: response.data.esewa.environment, merchantCode: response.data.esewa.merchant_code, secretKeyConfigured: response.data.esewa.secret_key_configured },
    content: { watermarkOpacity: response.data.content.watermark_opacity, watermarkIntervalSeconds: response.data.content.watermark_interval_seconds },
  };
}

export function formatAdminNpr(value: number): string {
  return npr.format(value).replace("NPR", "NPR ").replace(/\s+/g, " ").trim();
}
