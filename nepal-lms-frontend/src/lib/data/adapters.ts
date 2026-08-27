import type {
  Announcement,
  Course,
  CourseCategory,
  Enrollment,
  LiveSession,
  Payment,
  Recording,
  Resource,
  StaffStudent,
  StudentNotification,
  StudentTest,
  SyllabusModule,
  Teacher,
} from "@/types/lms";
import type {
  ApiAnnouncement,
  ApiBatch,
  ApiClassSession,
  ApiCourseSummary,
  ApiEnrollment,
  ApiFaq,
  ApiPayment,
  ApiRecording,
  ApiResource,
  ApiStaffStudent,
  ApiSyllabusModule,
  ApiTeacher,
  ApiTest,
} from "@/lib/data/api-dtos";
import { formatDate, formatDateTime, formatDuration, formatFileSize, formatTimeRange } from "@/lib/data/format";

const courseAccents: Course["accent"][] = ["blue", "amber", "teal", "violet", "rose", "slate"];

function stableAccent(value: string): Course["accent"] {
  const score = [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return courseAccents[score % courseAccents.length] ?? "blue";
}

function courseStatus(batch: ApiBatch | undefined, published: boolean): Course["status"] {
  if (!published) return "Draft";
  switch (batch?.status) {
    case "ongoing":
      return "Ongoing";
    case "open":
      return "Open";
    case "completed":
    case "closed":
    case "cancelled":
      return "Archived";
    default:
      return "Upcoming";
  }
}

export function mapCourse(value: ApiCourseSummary): Course {
  /*
   * batches[0] is the *nearest* enrollable batch (the API orders by start_at)
   * and stays the summary shown on a card. The full list is carried through
   * as well: collapsing to one meant a course with a morning and an evening
   * batch showed only one of them anywhere a student could see, so the second
   * batch could never be chosen or bought.
   */
  const batches = (value.batches ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    status: item.status,
    schedule: item.schedule_summary || "Schedule to be announced",
    startDate: item.start_at ? formatDate(item.start_at) : "Start date to be announced",
    accessUntil: item.access_until ? formatDate(item.access_until) : "Access period shown before enrollment",
    priceNpr: item.price_npr ?? value.starting_price_npr,
    capacity: item.capacity ?? null,
    teacherNames: item.teacher_names ?? [],
  }));

  const batch = value.batches?.[0];
  const teacherName = value.teacher?.name || batch?.teacher_names?.[0] || "Teacher to be announced";
  const teacherSlug = value.teacher?.slug || teacherName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const features = (value.features || ["Live", "Recordings", "Tests", "Notes"]).filter(
    (feature): feature is Course["features"][number] => ["Live", "Recordings", "Tests", "Notes"].includes(feature),
  );

  return {
    id: value.id,
    slug: value.slug,
    code: value.code || value.slug.toUpperCase().replace(/-/g, "_").slice(0, 24),
    title: value.title,
    shortTitle: value.short_title || value.title,
    category: value.category?.name || "General",
    categoryId: value.category?.id ?? null,
    description: value.description || value.short_description || "Course details will be published soon.",
    shortDescription: value.short_description ?? null,
    image: value.thumbnail_url || "/images/course-study-skills.svg",
    price: value.starting_price_npr,
    originalPrice: value.original_price_npr ?? undefined,
    isFree: value.access_type === "free",
    status: courseStatus(batch, value.published),
    published: value.published,
    batchId: batch?.id || "",
    batch: batch?.title || (value.available_batches ? `${value.available_batches} batches available` : "Batch to be announced"),
    teacher: teacherName,
    teacherSlug,
    schedule: batch?.schedule_summary || "Schedule to be announced",
    startDate: batch ? formatDate(batch.start_at) : "Start date to be announced",
    access: batch ? `Access until ${formatDate(batch.access_until)}` : "Access period shown before enrollment",
    seats: batch?.capacity ? `Capacity ${batch.capacity}` : undefined,
    features: features.length ? features : ["Recordings", "Tests", "Notes"],
    modules: value.modules_count ?? 0,
    lessons: value.lessons_count ?? 0,
    batches,
    accent: stableAccent(value.slug),
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}

export function mapCategory(value: { id?: string; name: string; slug?: string; description?: string | null; course_count?: number }): CourseCategory {
  return {
    id: value.id,
    name: value.name,
    slug: value.slug,
    detail: value.description || undefined,
    count: value.course_count,
  };
}

export function mapTeacher(value: ApiTeacher): Teacher {
  const initials = value.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return {
    id: value.id,

    // The account id, which is what teacher assignment is validated against.
    // `id` above is the teacher-profile id and is not interchangeable.
    userId: value.user_id || value.id,
    slug: value.slug,
    name: value.name,
    role: value.role || "Faculty",
    subjects: value.subjects || [],
    experience: value.experience_summary || "Experienced faculty member",
    bio: value.bio || "Faculty profile details will be available soon.",
    initials,
    accent: "from-blue-600 to-blue-800",
  };
}

export function mapFaq(value: ApiFaq): { question: string; answer: string } {
  return { question: value.question, answer: value.answer };
}

export function mapEnrollment(value: ApiEnrollment): Enrollment {
  const course = mapCourse({ ...value.course, batches: [value.batch] });
  const progress = value.progress;
  return {
    id: value.id,
    course,
    progress: progress?.overall_percent ?? 0,
    attendance: progress?.attendance_percent ?? 0,
    recordings: progress?.recording_percent ?? 0,
    tests: progress?.test_percent ?? 0,
    syllabus: progress?.syllabus_percent ?? 0,
    nextAction: value.next_action || "Open course workspace",
    accessExpiry: formatDate(value.access_end_at),
    status: value.status === "cancelled" ? "expired" : value.status,
  };
}

function sessionStatus(value: ApiClassSession["status"]): LiveSession["status"] {
  return {
    live: "Live now",
    scheduled: "Upcoming",
    completed: "Completed",
    rescheduled: "Rescheduled",
    cancelled: "Cancelled",
  }[value] as LiveSession["status"];
}

export function mapLiveSession(value: ApiClassSession): LiveSession {
  return {
    id: value.id,
    enrollmentId: value.enrollment_id,
    title: value.topic,
    course: value.course_title || "Course",
    batch: value.batch_title || "Batch",
    teacher: value.teacher_name || "Teacher",
    date: formatDate(value.starts_at),
    time: formatTimeRange(value.starts_at, value.ends_at),
    startsAt: value.starts_at,
    endsAt: value.ends_at,
    status: sessionStatus(value.status),
    joinState: value.join_available ? "Join class" : value.action_reason || "Opens shortly before class",
    joinAvailable: value.join_available,
  };
}

export function mapRecording(value: ApiRecording): Recording {
  const progress = Math.max(0, Math.min(100, value.progress_percent ?? 0));
  const state: Recording["state"] =
    value.state === "processing"
      ? "Processing"
      : progress >= 100
        ? "Completed"
        : progress > 0
          ? "In progress"
          : value.state === "available" || !value.state
            ? "Available"
            : "Not started";
  return {
    id: value.id,
    enrollmentId: value.enrollment_id,
    course: value.course_title,
    batch: value.batch_title,
    title: value.title,
    module: value.module_title || "Course recording",
    date: formatDate(value.released_at || value.recorded_at),
    teacher: value.teacher_name || "Faculty",
    duration: formatDuration(value.duration_seconds),
    progress,
    state,
    syncMessage: value.sync_message,
    thumbnailUrl: value.thumbnail_url,
    videoId: value.youtube_video_id,
    isPublicWarning: value.is_public_warning,
    syllabusLessonId: value.syllabus_lesson_id,
  };
}

export function mapResource(value: ApiResource): Resource {
  return {
    id: value.id,
    enrollmentId: value.enrollment_id,
    course: value.course_title,
    title: value.title,
    module: value.module_title || "Course information",
    type: (value.file_type || value.mime_type?.split("/").pop() || "File").toUpperCase(),
    mimeType: value.mime_type || undefined,
    size: formatFileSize(value.size_bytes),
    released: formatDate(value.released_at),
    downloadUrl: value.download_url,
    syllabusLessonId: value.syllabus_lesson_id,
  };
}

export function mapSyllabusModule(value: ApiSyllabusModule): SyllabusModule {
  return {
    id: value.id,
    title: value.title,
    progress: value.progress_percent ?? 0,
    lessons: [...value.lessons]
      .sort((a, b) => a.order - b.order)
      .map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        type: lesson.type || "Lesson",
        state: lesson.state || "Available",
        recordingId: lesson.recording_id,
        resourceId: lesson.resource_id,
      })),
  };
}

export function mapTest(value: ApiTest): StudentTest {
  const status: StudentTest["status"] =
    value.status === "open"
      ? "Available"
      : value.status === "scheduled"
        ? "Upcoming"
        : value.status === "result_released"
          ? "Completed"
          : "Closed";
  const marks = value.score != null && value.total_marks != null ? `${value.score}/${value.total_marks}` : `${value.total_marks ?? 0} marks`;
  const used = value.attempts_used ?? 0;
  const allowed = value.attempts_allowed ?? 1;
  return {
    id: value.id,
    enrollmentId: value.enrollment_id,
    title: value.title,
    course: value.course_title || "Course assessment",
    availability: status === "Available" ? `Available until ${formatDateTime(value.closes_at)}` : status === "Upcoming" ? `Opens ${formatDateTime(value.opens_at)}` : `Closed ${formatDateTime(value.closes_at)}`,
    duration: `${value.duration_minutes} minutes`,
    marks,
    attempts: `${used} of ${allowed} attempts`,
    status,
  };
}

export function mapAnnouncement(value: ApiAnnouncement): Announcement {
  return {
    id: value.id,
    title: value.title,
    body: value.body || value.summary || "Open the notification for full details.",
    course: value.course_title || "Institution update",
    date: formatDateTime(value.published_at),
    pinned: Boolean(value.pinned),
  };
}

export function mapNotification(value: ApiAnnouncement): StudentNotification {
  return { ...mapAnnouncement(value), read: value.read, href: value.href };
}

function paymentStatus(value: ApiPayment["status"]): Payment["status"] {
  return {
    approved: "Approved",
    under_review: "Under review",
    submitted: "Submitted",
    rejected: "Rejected",
    refunded: "Refunded",
    draft: "Draft",
    cancelled: "Rejected",
  }[value] as Payment["status"];
}

export function mapPayment(value: ApiPayment): Payment {
  return {
    id: value.id,
    course: value.course_title || "Course enrollment",
    batch: value.batch_title || "Batch",
    amount: value.submitted_amount_npr || value.expected_amount_npr,
    submitted: formatDateTime(value.submitted_at),
    method: value.payment_method,
    reference: value.transaction_reference || "Not provided",
    status: paymentStatus(value.status),
    reason: value.rejection_reason || undefined,
    receiptId: value.receipt_id || null,
    proofAvailable: value.proof_preview_available ?? false,
    proofMimeType: value.proof_mime || null,
  };
}

export function mapStaffStudent(value: ApiStaffStudent): StaffStudent {
  return {
    id: value.student_code || value.id,
    name: value.name,
    phone: value.mobile,
    email: value.email,
    course: value.current_course_title || "No active course",
    status: value.status === "active" ? "Active" : value.status === "suspended" ? "Suspended" : "Pending",
    joined: formatDate(value.joined_at),
  };
}
