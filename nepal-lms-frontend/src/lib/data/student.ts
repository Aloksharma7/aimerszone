import "server-only";

import type { ApiResponse, PaginatedResponse } from "@/lib/api/contracts";
import { serverApiFetch } from "@/lib/api/server-client";
import {
  mapAnnouncement,
  mapEnrollment,
  mapLiveSession,
  mapNotification,
  mapPayment,
  mapRecording,
  mapResource,
  mapSyllabusModule,
  mapTest,
} from "@/lib/data/adapters";
import type {
  ApiAnnouncement,
  ApiClassSession,
  ApiEnrollment,
  ApiPayment,
  ApiRecording,
  ApiResource,
  ApiStudentDashboard,
  ApiStudentReceipt,
  ApiSyllabusModule,
  ApiTest,
} from "@/lib/data/api-dtos";
import { isMockDataEnabled } from "@/lib/data/config";
import { formatDateTime } from "@/lib/data/format";
import {
  activeEnrollments,
  announcements,
  liveSessions,
  payments,
  recordings,
  resources,
  studentTests,
  syllabusModules,
} from "@/data/mock";
import type {
  Announcement,
  Enrollment,
  LiveSession,
  Payment,
  Recording,
  Resource,
  StudentDashboardData,
  StudentNotification,
  StudentReceipt,
  StudentTest,
  SyllabusModule,
} from "@/types/lms";

export async function getStudentDashboard(name = "Student"): Promise<StudentDashboardData> {
  if (isMockDataEnabled()) {
    return {
      greetingName: name,
      nextClass: liveSessions[0] ?? null,
      activeEnrollments: activeEnrollments as unknown as Enrollment[],
      upcomingTests: studentTests as unknown as StudentTest[],
      announcements,
      continueRecording: (recordings as unknown as Recording[])[0] ?? null,
      metrics: {
        activeCourses: activeEnrollments.length,
        attendancePercent: Math.round(activeEnrollments.reduce((sum, item) => sum + item.attendance, 0) / Math.max(activeEnrollments.length, 1)),
        upcomingTests: studentTests.filter((test) => test.status !== "Completed").length,
        paymentsUnderReview: payments.filter((payment) => payment.status === "Under review").length,
      },
    };
  }

  const response = await serverApiFetch<ApiResponse<ApiStudentDashboard>>("/api/v1/student/dashboard");
  const data = response.data;
  const enrollments = data.active_courses.map(mapEnrollment);
  const tests = data.upcoming_tests.map(mapTest);
  const mappedAnnouncements = data.announcements.map(mapAnnouncement);
  return {
    greetingName: name,
    nextClass: data.next_class ? mapLiveSession(data.next_class) : null,
    activeEnrollments: enrollments,
    upcomingTests: tests,
    announcements: mappedAnnouncements,
    continueRecording: data.continue_recording ? mapRecording(data.continue_recording) : null,
    metrics: {
      activeCourses: enrollments.length,
      attendancePercent: Math.round(enrollments.reduce((sum, item) => sum + item.attendance, 0) / Math.max(enrollments.length, 1)),
      upcomingTests: tests.filter((test) => test.status !== "Completed" && test.status !== "Closed").length,
      paymentsUnderReview: data.payment_review_count ?? 0,
    },
  };
}

export async function getStudentEnrollments(): Promise<Enrollment[]> {
  if (isMockDataEnabled()) return activeEnrollments as unknown as Enrollment[];
  const response = await serverApiFetch<ApiResponse<ApiEnrollment[]> | PaginatedResponse<ApiEnrollment>>("/api/v1/student/courses");
  return response.data.map(mapEnrollment);
}

export async function getStudentEnrollment(enrollmentId: string): Promise<Enrollment | null> {
  if (isMockDataEnabled()) return (activeEnrollments as unknown as Enrollment[]).find((item) => item.id === enrollmentId) ?? null;
  try {
    const response = await serverApiFetch<ApiResponse<ApiEnrollment>>(`/api/v1/student/courses/${encodeURIComponent(enrollmentId)}`);
    return mapEnrollment(response.data);
  } catch (error) {
    if (typeof error === "object" && error && "status" in error && Number(error.status) === 404) return null;
    throw error;
  }
}

export async function getStudentClasses(enrollmentId: string): Promise<LiveSession[]> {
  if (isMockDataEnabled()) return liveSessions.map((session) => ({ ...session, enrollmentId }));
  const response = await serverApiFetch<ApiResponse<ApiClassSession[]>>(`/api/v1/student/courses/${encodeURIComponent(enrollmentId)}/classes`);
  return response.data.map(mapLiveSession);
}

export async function getStudentRecordings(enrollmentId?: string): Promise<Recording[]> {
  if (isMockDataEnabled()) return (recordings as unknown as Recording[]).map((recording) => ({ ...recording, enrollmentId: enrollmentId ?? activeEnrollments[0]?.id }));
  const path = enrollmentId
    ? `/api/v1/student/courses/${encodeURIComponent(enrollmentId)}/recordings`
    : "/api/v1/student/recordings";
  const response = await serverApiFetch<ApiResponse<ApiRecording[]> | PaginatedResponse<ApiRecording>>(path);
  return response.data.map(mapRecording);
}

export async function getStudentRecording(recordingId: string, enrollmentId?: string): Promise<Recording | null> {
  if (isMockDataEnabled()) {
    const item = (recordings as unknown as Recording[]).find((recording) => recording.id === recordingId);
    return item ? { ...item, enrollmentId: enrollmentId ?? activeEnrollments[0]?.id } : null;
  }
  try {
    const response = await serverApiFetch<ApiResponse<ApiRecording>>(`/api/v1/student/recordings/${encodeURIComponent(recordingId)}`);
    return mapRecording(response.data);
  } catch (error) {
    if (typeof error === "object" && error && "status" in error && Number(error.status) === 404) return null;
    throw error;
  }
}

export async function getStudentResources(enrollmentId?: string): Promise<Resource[]> {
  if (isMockDataEnabled()) return resources.map((resource) => ({ ...resource, enrollmentId: enrollmentId ?? activeEnrollments[0]?.id, course: activeEnrollments[0]?.course.title }));
  const path = enrollmentId
    ? `/api/v1/student/courses/${encodeURIComponent(enrollmentId)}/resources`
    : "/api/v1/student/resources";
  const response = await serverApiFetch<ApiResponse<ApiResource[]> | PaginatedResponse<ApiResource>>(path);
  return response.data.map(mapResource);
}

export async function getStudentSyllabus(enrollmentId: string): Promise<SyllabusModule[]> {
  if (isMockDataEnabled()) return syllabusModules;
  const response = await serverApiFetch<ApiResponse<ApiSyllabusModule[]>>(`/api/v1/student/courses/${encodeURIComponent(enrollmentId)}/syllabus`);
  return response.data.map(mapSyllabusModule);
}

export async function getStudentTests(enrollmentId?: string): Promise<StudentTest[]> {
  if (isMockDataEnabled()) return (studentTests as unknown as StudentTest[]).map((test) => ({ ...test, enrollmentId: enrollmentId ?? activeEnrollments[0]?.id }));
  const path = enrollmentId
    ? `/api/v1/student/courses/${encodeURIComponent(enrollmentId)}/tests`
    : "/api/v1/student/tests";
  const response = await serverApiFetch<ApiResponse<ApiTest[]> | PaginatedResponse<ApiTest>>(path);
  return response.data.map(mapTest);
}

export async function getStudentAnnouncements(enrollmentId?: string): Promise<Announcement[]> {
  if (isMockDataEnabled()) return announcements;
  const path = enrollmentId
    ? `/api/v1/student/courses/${encodeURIComponent(enrollmentId)}/announcements`
    : "/api/v1/student/announcements";
  const response = await serverApiFetch<ApiResponse<ApiAnnouncement[]> | PaginatedResponse<ApiAnnouncement>>(path);
  return response.data.map(mapAnnouncement);
}

export async function getStudentNotifications(): Promise<StudentNotification[]> {
  if (isMockDataEnabled()) return announcements.map((item, index) => ({ ...item, read: index > 0, href: "/student/notifications" }));
  const response = await serverApiFetch<ApiResponse<ApiAnnouncement[]> | PaginatedResponse<ApiAnnouncement>>("/api/v1/student/notifications");
  return response.data.map(mapNotification);
}

export async function getStudentPayments(): Promise<Payment[]> {
  if (isMockDataEnabled()) return payments as unknown as Payment[];
  const response = await serverApiFetch<ApiResponse<ApiPayment[]> | PaginatedResponse<ApiPayment>>("/api/v1/student/payments");
  return response.data.map(mapPayment);
}

export async function getStudentPayment(paymentId: string): Promise<Payment | null> {
  const items = await getStudentPayments();
  return items.find((payment) => payment.id === paymentId) ?? null;
}

export async function getStudentReceipt(receiptId: string, studentName = "Student", studentCode = ""): Promise<StudentReceipt | null> {
  if (isMockDataEnabled()) {
    const approved = (payments as unknown as Payment[]).find((payment) => payment.status === "Approved" && payment.receiptId);
    if (!approved || receiptId !== approved.receiptId) return null;
    return {
      id: approved.receiptId as string,
      paymentId: approved.id,
      issuedAt: approved.submitted,
      studentName,
      studentCode: studentCode || "STUDENT",
      paymentReference: approved.reference,
      paymentMethod: approved.method,
      course: approved.course,
      batch: approved.batch,
      amountNpr: approved.amount,
    };
  }

  try {
    const response = await serverApiFetch<ApiResponse<ApiStudentReceipt>>(`/api/v1/student/receipts/${encodeURIComponent(receiptId)}`);
    const item = response.data;
    return {
      id: item.id,
      paymentId: item.payment_id,
      issuedAt: item.issued_at,
      studentName: item.student_name,
      studentCode: item.student_code,
      paymentReference: item.payment_reference,
      paymentMethod: item.payment_method,
      course: item.course_title,
      batch: item.batch_title,
      amountNpr: item.amount_npr,
    };
  } catch (error) {
    if (typeof error === "object" && error && "status" in error && Number(error.status) === 404) return null;
    throw error;
  }
}

export type StudentAttendanceRow = {
  sessionId: string;
  topic: string;
  date: string;
  status: string;
  minutesAttended: number;
  note: string | null;
};

export type StudentAttendance = {
  items: StudentAttendanceRow[];
  metrics: { finalizedClasses: number; present: number; late: number; absent: number; excused: number; attendancePercent: number };
};

/**
 * The student's own attendance for one batch.
 *
 * Only finalised registers are returned. A class the teacher has not closed
 * yet is not "absent" — showing it as such would have students querying marks
 * that nobody has made.
 */
export async function getStudentAttendance(enrollmentId: string): Promise<StudentAttendance> {
  if (isMockDataEnabled()) {
    return {
      items: [
        { sessionId: "preview-1", topic: "Elasticity of demand", date: "12 Aug 2026", status: "present", minutesAttended: 58, note: null },
        { sessionId: "preview-2", topic: "Market equilibrium", date: "10 Aug 2026", status: "absent", minutesAttended: 0, note: null },
      ],
      metrics: { finalizedClasses: 2, present: 1, late: 0, absent: 1, excused: 0, attendancePercent: 50 },
    };
  }

  const response = await serverApiFetch<ApiResponse<{
    items: Array<{ session_id: string; topic: string; starts_at: string; status: string; minutes_attended: number; note?: string | null }>;
    metrics: { finalized_classes: number; present: number; late: number; absent: number; excused: number; attendance_percent: number };
  }>>(`/api/v1/student/courses/${encodeURIComponent(enrollmentId)}/attendance`);

  return {
    items: response.data.items.map((row) => ({
      sessionId: row.session_id,
      topic: row.topic,
      date: formatDateTime(row.starts_at),
      status: row.status,
      minutesAttended: row.minutes_attended,
      note: row.note || null,
    })),
    metrics: {
      finalizedClasses: response.data.metrics.finalized_classes,
      present: response.data.metrics.present,
      late: response.data.metrics.late,
      absent: response.data.metrics.absent,
      excused: response.data.metrics.excused,
      attendancePercent: response.data.metrics.attendance_percent,
    },
  };
}
