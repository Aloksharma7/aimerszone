import { resolveAssetUrl } from "@/lib/api/assets";
import type {
  ApiAccountProfile,
  ApiAnnouncement,
  ApiClassSession,
  ApiDashboard,
  ApiEnrollment,
  ApiPayment,
  ApiReceipt,
  ApiRecording,
  ApiResourceFile,
  ApiSupportOverview,
  ApiSyllabusModule,
  ApiTest,
} from "@/lib/data/api-dtos";
import { formatDate, formatDateTime, formatDuration, formatFileSize, formatTimeRange } from "@/lib/data/format";
import type {
  AccountProfile,
  ContinueRecording,
  CourseRecording,
  CourseResource,
  CourseTest,
  Dashboard,
  DashboardAnnouncement,
  EnrollmentDetail,
  EnrollmentSummary,
  LiveSession,
  Payment,
  Receipt,
  SupportOverview,
  SyllabusModule,
  UpcomingTest,
} from "@/types/lms";

export function mapEnrollment(value: ApiEnrollment): EnrollmentSummary {
  return {
    id: value.id,
    courseTitle: value.course.short_title || value.course.title,
    batchTitle: value.batch.title,
    thumbnailUrl: resolveAssetUrl(value.course.thumbnail_url),
    progressPercent: value.progress.overall_percent,
    nextAction: value.next_action || "Open course workspace",
    accessExpiry: formatDate(value.access_end_at),
    status: value.status,
  };
}

export function mapLiveSession(value: ApiClassSession): LiveSession {
  return {
    id: value.id,
    enrollmentId: value.enrollment_id,
    topic: value.topic,
    courseTitle: value.course_title || "Course",
    batchTitle: value.batch_title || "Batch",
    teacherName: value.teacher_name || "Teacher",
    date: formatDate(value.starts_at),
    timeRange: formatTimeRange(value.starts_at, value.ends_at),
    joinAvailable: value.join_available,
    actionReason: value.action_reason,
  };
}

export function mapTest(value: ApiTest): UpcomingTest {
  const availability =
    value.status === "open"
      ? `Available until ${formatDateTime(value.closes_at)}`
      : value.status === "scheduled"
        ? `Opens ${formatDateTime(value.opens_at)}`
        : `Closed ${formatDateTime(value.closes_at)}`;

  return {
    id: value.id,
    enrollmentId: value.enrollment_id,
    title: value.title,
    courseTitle: value.course_title || "Course assessment",
    availability,
  };
}

export function mapAnnouncement(value: ApiAnnouncement): DashboardAnnouncement {
  return {
    id: value.id,
    title: value.title,
    body: value.body || value.summary || "Open the notification for full details.",
    courseTitle: value.course_title || "Institution update",
    date: formatDateTime(value.published_at),
    pinned: value.pinned,
    read: value.read,
  };
}

export function mapContinueRecording(value: ApiRecording): ContinueRecording {
  return {
    id: value.id,
    enrollmentId: value.enrollment_id,
    title: value.title,
    courseTitle: value.course_title || "Course",
    progressPercent: Math.max(0, Math.min(100, value.progress_percent)),
  };
}

const paymentStatusMap: Record<ApiPayment["status"], Payment["status"]> = {
  approved: "Approved",
  under_review: "Under review",
  submitted: "Submitted",
  rejected: "Rejected",
  refunded: "Refunded",
  draft: "Draft",
  cancelled: "Rejected",
};

export function mapPayment(value: ApiPayment): Payment {
  return {
    id: value.id,
    courseTitle: value.course_title || "Course enrollment",
    batchTitle: value.batch_title || "Batch",
    amountNpr: value.submitted_amount_npr || value.expected_amount_npr,
    submittedAt: formatDateTime(value.submitted_at),
    method: value.payment_method,
    reference: value.transaction_reference || "Not provided",
    status: paymentStatusMap[value.status],
    rejectionReason: value.rejection_reason,
    receiptId: value.receipt_id,
  };
}

export function mapEnrollmentDetail(value: ApiEnrollment): EnrollmentDetail {
  return {
    id: value.id,
    courseTitle: value.course.short_title || value.course.title,
    batchTitle: value.batch.title,
    thumbnailUrl: resolveAssetUrl(value.course.thumbnail_url),
    teacherNames: value.batch.teacher_names ?? [],
    scheduleSummary: value.batch.schedule_summary || "Schedule to be announced",
    accessExpiry: formatDate(value.access_end_at),
    status: value.status,
    progress: {
      attendance: value.progress.attendance_percent,
      recordings: value.progress.recording_percent,
      tests: value.progress.test_percent,
      syllabus: value.progress.syllabus_percent,
      overall: value.progress.overall_percent,
    },
  };
}

const recordingStateMap: Record<ApiRecording["state"], (progress: number) => CourseRecording["state"]> = {
  processing: () => "Processing",
  available: (progress) => (progress >= 100 ? "Completed" : progress > 0 ? "In progress" : "Available"),
};

export function mapCourseRecording(value: ApiRecording): CourseRecording {
  const progress = Math.max(0, Math.min(100, value.progress_percent));
  return {
    id: value.id,
    title: value.title,
    moduleTitle: value.module_title || "Course recording",
    teacherName: value.teacher_name || "Faculty",
    date: formatDate(value.released_at || value.recorded_at),
    duration: formatDuration(value.duration_seconds),
    progressPercent: progress,
    state: recordingStateMap[value.state](progress),
    thumbnailUrl: resolveAssetUrl(value.thumbnail_url),
  };
}

export function mapCourseResource(value: ApiResourceFile): CourseResource {
  return {
    id: value.id,
    title: value.title,
    moduleTitle: value.module_title || "Course information",
    type: (value.file_type || value.mime_type?.split("/").pop() || "File").toUpperCase(),
    size: formatFileSize(value.size_bytes),
    releasedDate: formatDate(value.released_at),
  };
}

const testStatusMap: Record<ApiTest["status"], CourseTest["status"]> = {
  open: "Available",
  scheduled: "Upcoming",
  result_released: "Completed",
  closed: "Closed",
};

export function mapCourseTest(value: ApiTest): CourseTest {
  const status = testStatusMap[value.status];
  const availability =
    status === "Available"
      ? `Available until ${formatDateTime(value.closes_at)}`
      : status === "Upcoming"
        ? `Opens ${formatDateTime(value.opens_at)}`
        : `Closed ${formatDateTime(value.closes_at)}`;
  const marks = value.score != null ? `${value.score}/${value.total_marks}` : `${value.total_marks} marks`;

  return {
    id: value.id,
    title: value.title,
    status,
    availability,
    marks,
    attemptsLabel: `${value.attempts_used} of ${value.attempts_allowed} attempts`,
  };
}

export function mapSyllabusModule(value: ApiSyllabusModule): SyllabusModule {
  return {
    id: value.id,
    title: value.title,
    progressPercent: value.progress_percent,
    lessons: [...value.lessons]
      .sort((a, b) => a.order - b.order)
      .map((lesson) => ({ id: lesson.id, title: lesson.title, type: lesson.type || "Lesson", completed: lesson.state === "Completed" })),
  };
}

export function mapReceipt(value: ApiReceipt): Receipt {
  return {
    id: value.id,
    paymentId: value.payment_id,
    issuedAt: formatDateTime(value.issued_at),
    studentName: value.student_name,
    studentCode: value.student_code,
    paymentReference: value.payment_reference,
    paymentMethod: value.payment_method,
    courseTitle: value.course_title || "Course enrollment",
    batchTitle: value.batch_title || "Batch",
    amountNpr: value.amount_npr,
  };
}

export function mapAccountProfile(value: ApiAccountProfile): AccountProfile {
  return {
    id: value.id,
    name: value.name,
    email: value.email,
    mobile: value.mobile,
    identityCode: value.identity_code,
    avatarUrl: resolveAssetUrl(value.avatar_url),
    twoFactorEnabled: value.two_factor_enabled,
    twoFactorRequired: value.two_factor_required,
    sessions: value.sessions.map((session) => ({
      id: session.id,
      device: session.device,
      browser: session.browser,
      platform: session.platform,
      location: session.location,
      lastActiveAt: formatDateTime(session.last_active_at),
      current: session.current,
    })),
  };
}

const ticketStatusMap: Record<ApiSupportOverview["tickets"][number]["status"], SupportOverview["tickets"][number]["status"]> = {
  open: "Open",
  pending: "Pending",
  resolved: "Resolved",
  closed: "Closed",
};

export function mapSupportOverview(value: ApiSupportOverview): SupportOverview {
  return {
    contactPhone: value.contact.phone,
    contactWhatsapp: value.contact.whatsapp,
    contactEmail: value.contact.email,
    contactHours: value.contact.hours,
    faqs: value.faqs,
    tickets: value.tickets.map((ticket) => ({
      id: ticket.id,
      reference: ticket.reference,
      subject: ticket.subject,
      status: ticketStatusMap[ticket.status],
      createdAt: formatDateTime(ticket.created_at),
      updatedAt: formatDateTime(ticket.updated_at),
      replyCount: ticket.reply_count,
    })),
  };
}

export function mapDashboard(value: ApiDashboard): Dashboard {
  return {
    nextClass: value.next_class ? mapLiveSession(value.next_class) : null,
    activeCourses: value.active_courses.map(mapEnrollment),
    upcomingTests: value.upcoming_tests.map(mapTest),
    announcements: value.announcements.map(mapAnnouncement),
    continueRecording: value.continue_recording ? mapContinueRecording(value.continue_recording) : null,
    paymentReviewCount: value.payment_review_count,
  };
}
