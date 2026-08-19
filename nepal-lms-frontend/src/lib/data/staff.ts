import "server-only";

import type { ApiResponse, PaginatedResponse } from "@/lib/api/contracts";
import { serverApiFetch } from "@/lib/api/server-client";
import { mapCourse, mapStaffStudent } from "@/lib/data/adapters";
import type { ApiCourseDetail, ApiCourseSummary, ApiPaymentQueueItem, ApiStaffEnrollment, ApiStaffStudent } from "@/lib/data/api-dtos";
import { formatDate, formatDateTime } from "@/lib/data/format";
import { isMockDataEnabled } from "@/lib/data/config";
import { activeEnrollments, courses, paymentQueue, staffStudents } from "@/data/mock";
import type { Enrollment, PaymentQueueItem, StaffCourse, StaffEnrollment, StaffStudent } from "@/types/lms";

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

export async function getStaffEnrollments(): Promise<StaffEnrollment[]> {
  if (isMockDataEnabled()) return mockStaffEnrollments();
  const response = await serverApiFetch<PaginatedResponse<ApiStaffEnrollment>>("/api/v1/staff/enrollments?per_page=100");
  return response.data.map((item) => ({
    id: item.id,
    student: item.student_name,
    course: item.course_title,
    batch: item.batch_title,
    accessUntil: formatDate(item.access_end_at),
    status: item.status.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()),
  }));
}

export async function getStaffCourses(): Promise<StaffCourse[]> {
  if (isMockDataEnabled()) return mockStaffCourses();
  const response = await serverApiFetch<PaginatedResponse<ApiCourseSummary>>("/api/v1/staff/courses?per_page=100");
  return response.data.map((value) => ({ ...mapCourse(value), id: value.id }));
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
