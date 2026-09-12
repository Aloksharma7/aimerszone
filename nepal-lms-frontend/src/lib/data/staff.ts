import "server-only";

import type { ApiResponse, PageMeta, PaginatedResponse } from "@/lib/api/contracts";
import { pageMetaFrom } from "@/lib/api/contracts";
import { serverApiFetch } from "@/lib/api/server-client";
import { mapCourse, mapStaffEnrollmentDetail, mapStaffStudent } from "@/lib/data/adapters";
import type { ApiCourseDetail, ApiCourseSummary, ApiPaymentQueueItem, ApiStaffEnrollment, ApiStaffEnrollmentDetail, ApiStaffStudent } from "@/lib/data/api-dtos";
import { formatDate, formatDateTime } from "@/lib/data/format";
import { isMockDataEnabled } from "@/lib/data/config";
import { activeEnrollments, courses, paymentQueue, staffStudents } from "@/data/mock";
import type { Enrollment, PaymentQueueItem, StaffCourse, StaffEnrollment, StaffEnrollmentDetail, StaffStudent } from "@/types/lms";

function mapPaymentQueue(value: ApiPaymentQueueItem): PaymentQueueItem {
  return {
    id: value.id,
    student: value.student_name || "Student",
    course: value.course_title || "Course enrollment",
    amount: value.submitted_amount_npr,
    method: value.payment_method,
    submitted: formatDateTime(value.submitted_at),
    risk: value.risk_label || "Normal",
    status: value.status.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()),
    hasProof: Boolean(value.proof_preview_available),
  };
}

function mockStaffCourses(): StaffCourse[] {
  return courses.map((course, index) => ({
    ...course,
    id: course.slug,
    published: index !== 3,
    enrollments: [64, 72, 96, 38, 312, 184][index] ?? 0,
    batchCount: course.isFree ? 1 : 2,
    lastUpdated: index < 2 ? "Today" : `${index + 1} days ago`,
    owner: "Enrollment Team",
  }));
}

function mockStaffEnrollments(): StaffEnrollment[] {
  return (activeEnrollments as unknown as Enrollment[]).map((item, index) => ({
    id: `ENR-2083-${5001 + index}`,
    student: staffStudents[index]?.name || "Student",
    course: item.course.title,
    batch: item.course.batch,
    accessUntil: item.accessExpiry,
    status: item.status === "expired" ? "Expired" : "Active",
  }));
}

export async function getStaffStudents(): Promise<StaffStudent[]> {
  if (isMockDataEnabled()) return staffStudents;
  const response = await serverApiFetch<PaginatedResponse<ApiStaffStudent>>("/api/v1/staff/students?per_page=100");
  return response.data.map(mapStaffStudent);
}

const STUDENTS_PER_PAGE = 20;

/**
 * Paginated, server-filtered student list for the /staff/students screen
 * itself. Kept separate from getStaffStudents() — that one returns an
 * unpaginated batch and is also used to populate the support-actions student
 * picker and the dashboard's "recent students" preview, neither of which
 * should be capped to a single page's worth of results.
 */
export async function getStaffStudentsPage(params: { page?: number; q?: string; status?: string } = {}): Promise<{ items: StaffStudent[]; meta: PageMeta }> {
  const page = params.page && params.page > 0 ? params.page : 1;

  if (isMockDataEnabled()) {
    const term = (params.q || "").trim().toLocaleLowerCase();
    const filtered = staffStudents.filter(
      (item) =>
        (!term || [item.id, item.name, item.phone, item.course].some((value) => String(value ?? "").toLocaleLowerCase().includes(term))) &&
        (!params.status || item.status === params.status),
    );
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / STUDENTS_PER_PAGE));
    const currentPage = Math.min(page, lastPage);
    const start = (currentPage - 1) * STUDENTS_PER_PAGE;
    const items = filtered.slice(start, start + STUDENTS_PER_PAGE);
    return { items, meta: { currentPage, lastPage, total, from: total ? start + 1 : null, to: total ? start + items.length : null } };
  }

  const query = new URLSearchParams({ per_page: String(STUDENTS_PER_PAGE), page: String(page) });
  if (params.q) query.set("q", params.q);
  if (params.status) query.set("status", params.status);
  const response = await serverApiFetch<PaginatedResponse<ApiStaffStudent>>(`/api/v1/staff/students?${query.toString()}`);
  return { items: response.data.map(mapStaffStudent), meta: pageMetaFrom(response.meta) };
}

export async function getStaffStudent(studentId: string): Promise<StaffStudent | null> {
  if (isMockDataEnabled()) return staffStudents.find((item) => item.id === studentId) ?? null;
  try {
    const response = await serverApiFetch<ApiResponse<ApiStaffStudent>>(`/api/v1/staff/students/${encodeURIComponent(studentId)}`);
    return mapStaffStudent(response.data);
  } catch (error) {
    if (typeof error === "object" && error && "status" in error && Number(error.status) === 404) return null;
    throw error;
  }
}

export async function getStaffPaymentSubmissions(): Promise<PaymentQueueItem[]> {
  if (isMockDataEnabled()) return paymentQueue;
  const response = await serverApiFetch<PaginatedResponse<ApiPaymentQueueItem>>("/api/v1/staff/payment-submissions?per_page=100");
  return response.data.map(mapPaymentQueue);
}

const PAYMENT_SUBMISSIONS_PER_PAGE = 20;

/**
 * Paginated, server-filtered submission list for the /staff/payment-submissions
 * screen itself. Kept separate from getStaffPaymentSubmissions() — that one
 * returns an unpaginated batch and is also used by the staff dashboard for
 * the submission-queue preview and pending count, which should not be capped
 * to a single page's worth of results.
 *
 * The backend (Staff\PaymentSubmissionController) only filters on `status` —
 * there is no server-side text search for this endpoint.
 */
export async function getStaffPaymentSubmissionsPage(params: { page?: number; status?: string } = {}): Promise<{ items: PaymentQueueItem[]; meta: PageMeta }> {
  const page = params.page && params.page > 0 ? params.page : 1;

  if (isMockDataEnabled()) {
    const filtered = paymentQueue.filter((item) => !params.status || item.status === params.status);
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / PAYMENT_SUBMISSIONS_PER_PAGE));
    const currentPage = Math.min(page, lastPage);
    const start = (currentPage - 1) * PAYMENT_SUBMISSIONS_PER_PAGE;
    const items = filtered.slice(start, start + PAYMENT_SUBMISSIONS_PER_PAGE);
    return { items, meta: { currentPage, lastPage, total, from: total ? start + 1 : null, to: total ? start + items.length : null } };
  }

  const query = new URLSearchParams({ per_page: String(PAYMENT_SUBMISSIONS_PER_PAGE), page: String(page) });
  if (params.status) query.set("status", params.status);
  const response = await serverApiFetch<PaginatedResponse<ApiPaymentQueueItem>>(`/api/v1/staff/payment-submissions?${query.toString()}`);
  return { items: response.data.map(mapPaymentQueue), meta: pageMetaFrom(response.meta) };
}

export async function getStaffPaymentSubmission(paymentId: string): Promise<PaymentQueueItem | null> {
  if (isMockDataEnabled()) return paymentQueue.find((item) => item.id === paymentId) ?? null;
  try {
    const response = await serverApiFetch<ApiResponse<ApiPaymentQueueItem>>(`/api/v1/staff/payment-submissions/${encodeURIComponent(paymentId)}`);
    return mapPaymentQueue(response.data);
  } catch (error) {
    if (typeof error === "object" && error && "status" in error && Number(error.status) === 404) return null;
    throw error;
  }
}

function mapStaffEnrollment(item: ApiStaffEnrollment): StaffEnrollment {
  return {
    id: item.id,
    student: item.student_name,
    course: item.course_title,
    batch: item.batch_title,
    accessUntil: formatDate(item.access_end_at),
    status: item.status.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()),
  };
}

export async function getStaffEnrollments(): Promise<StaffEnrollment[]> {
  if (isMockDataEnabled()) return mockStaffEnrollments();
  const response = await serverApiFetch<PaginatedResponse<ApiStaffEnrollment>>("/api/v1/staff/enrollments?per_page=100");
  return response.data.map(mapStaffEnrollment);
}

const ENROLLMENTS_PER_PAGE = 20;

/**
 * Paginated, server-filtered enrollment list for the /staff/enrollments
 * screen's table. Kept separate from getStaffEnrollments() — that one
 * still feeds the page's own metric cards (Active / All / Expired), which
 * are computed from the full fetched set rather than a single page.
 *
 * The backend (Staff\EnrollmentController) only filters on `status` and
 * `batch_id` — there is no server-side text search for this endpoint, so a
 * typed search term is not forwarded.
 */
export async function getStaffEnrollmentsPage(params: { page?: number; status?: string } = {}): Promise<{ items: StaffEnrollment[]; meta: PageMeta }> {
  const page = params.page && params.page > 0 ? params.page : 1;

  if (isMockDataEnabled()) {
    const all = mockStaffEnrollments();
    const filtered = all.filter((item) => !params.status || item.status === params.status);
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / ENROLLMENTS_PER_PAGE));
    const currentPage = Math.min(page, lastPage);
    const start = (currentPage - 1) * ENROLLMENTS_PER_PAGE;
    const items = filtered.slice(start, start + ENROLLMENTS_PER_PAGE);
    return { items, meta: { currentPage, lastPage, total, from: total ? start + 1 : null, to: total ? start + items.length : null } };
  }

  const query = new URLSearchParams({ per_page: String(ENROLLMENTS_PER_PAGE), page: String(page) });
  if (params.status) query.set("status", params.status);
  const response = await serverApiFetch<PaginatedResponse<ApiStaffEnrollment>>(`/api/v1/staff/enrollments?${query.toString()}`);
  return { items: response.data.map(mapStaffEnrollment), meta: pageMetaFrom(response.meta) };
}

export async function getStaffEnrollment(enrollmentId: string): Promise<StaffEnrollmentDetail | null> {
  if (isMockDataEnabled()) {
    const summary = mockStaffEnrollments().find((item) => item.id === enrollmentId);
    if (!summary) return null;
    const student = staffStudents.find((item) => item.name === summary.student);
    return {
      id: summary.id,
      studentId: student?.id ?? null,
      studentName: summary.student,
      studentCode: student?.id ?? null,
      studentMobile: student?.phone ?? null,
      studentEmail: null,
      courseId: null,
      courseTitle: summary.course,
      batchId: null,
      batchTitle: summary.batch,
      status: summary.status,
      source: "self",
      accessStartAt: null,
      accessEndAt: summary.accessUntil,
      activatedAt: null,
      cancelledAt: null,
      cancellationReason: null,
      hasPayment: true,
      attendancePercent: 0,
      recordingPercent: 0,
      testPercent: 0,
      overallPercent: 0,
      createdAt: null,
    };
  }
  try {
    const response = await serverApiFetch<ApiResponse<ApiStaffEnrollmentDetail>>(`/api/v1/staff/enrollments/${encodeURIComponent(enrollmentId)}`);
    return mapStaffEnrollmentDetail(response.data);
  } catch (error) {
    if (typeof error === "object" && error && "status" in error && Number(error.status) === 404) return null;
    throw error;
  }
}

export async function getStaffCourses(): Promise<StaffCourse[]> {
  if (isMockDataEnabled()) return mockStaffCourses();
  const response = await serverApiFetch<PaginatedResponse<ApiCourseSummary>>("/api/v1/staff/courses?per_page=100");
  return response.data.map((value) => ({ ...mapCourse(value), id: value.id }));
}

const COURSES_PER_PAGE = 20;

/**
 * Paginated, server-filtered course list for the /staff/courses screen
 * itself. Kept separate from getStaffCourses() — that one returns an
 * unpaginated batch and is also used by the enroll wizard's course picker and
 * the staff dashboard's published-course count, neither of which should be
 * capped to a single page's worth of results.
 */
export async function getStaffCoursesPage(params: { page?: number; q?: string } = {}): Promise<{ items: StaffCourse[]; meta: PageMeta }> {
  const page = params.page && params.page > 0 ? params.page : 1;

  if (isMockDataEnabled()) {
    const all = mockStaffCourses();
    const term = (params.q || "").trim().toLocaleLowerCase();
    const filtered = all.filter((item) => !term || [item.title, item.slug, item.category].some((value) => String(value ?? "").toLocaleLowerCase().includes(term)));
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / COURSES_PER_PAGE));
    const currentPage = Math.min(page, lastPage);
    const start = (currentPage - 1) * COURSES_PER_PAGE;
    const items = filtered.slice(start, start + COURSES_PER_PAGE);
    return { items, meta: { currentPage, lastPage, total, from: total ? start + 1 : null, to: total ? start + items.length : null } };
  }

  const query = new URLSearchParams({ per_page: String(COURSES_PER_PAGE), page: String(page) });
  if (params.q) query.set("q", params.q);
  const response = await serverApiFetch<PaginatedResponse<ApiCourseSummary>>(`/api/v1/staff/courses?${query.toString()}`);
  return { items: response.data.map((value) => ({ ...mapCourse(value), id: value.id })), meta: pageMetaFrom(response.meta) };
}

export async function getStaffCourse(courseId: string): Promise<StaffCourse | null> {
  if (isMockDataEnabled()) return mockStaffCourses().find((course) => course.id === courseId || course.slug === courseId) ?? null;
  try {
    const response = await serverApiFetch<ApiResponse<ApiCourseDetail>>(`/api/v1/staff/courses/${encodeURIComponent(courseId)}`);
    return { ...mapCourse(response.data), id: response.data.id };
  } catch (error) {
    if (typeof error === "object" && error && "status" in error && Number(error.status) === 404) return null;
    throw error;
  }
}
