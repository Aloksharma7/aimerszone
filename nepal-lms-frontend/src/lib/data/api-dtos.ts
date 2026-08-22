export type ApiPublicPaymentMethod = {
  id: string;
  name: string;
  account_name?: string | null;
  account_identifier?: string | null;
  qr_image_url?: string | null;
  instructions?: string | null;
};

export type ApiCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  course_count?: number;
};

export type ApiBatch = {
  id: string;
  title: string;
  status: "draft" | "open" | "ongoing" | "completed" | "closed" | "cancelled";
  start_at: string;
  end_at: string;
  access_until: string;
  schedule_summary?: string | null;
  price_npr: number;
  capacity?: number | null;
  teacher_names?: string[];
};

export type ApiCourseSummary = {
  id: string;
  slug: string;
  code?: string | null;
  title: string;
  short_title?: string | null;
  short_description?: string | null;
  description?: string | null;
  category?: ApiCategory | null;
  thumbnail_url?: string | null;
  access_type: "free" | "paid";
  starting_price_npr: number;
  original_price_npr?: number | null;
  published: boolean;
  available_batches?: number;
  features?: string[];
  modules_count?: number;
  lessons_count?: number;
  batches?: ApiBatch[];
  teacher?: {
    id?: string;
    name: string;
    slug?: string | null;
  } | null;
  created_at?: string;
  updated_at?: string;
};

export type ApiCourseDetail = ApiCourseSummary & {
  description: string;
  syllabus?: ApiSyllabusModule[];
  batches: ApiBatch[];
};

export type ApiEnrollmentProgress = {
  attendance_percent?: number;
  recording_percent?: number;
  test_percent?: number;
  syllabus_percent?: number;
  overall_percent?: number;
  syllabus_completed?: number;
  syllabus_total?: number;
};

export type ApiEnrollment = {
  id: string;
  status: "pending" | "active" | "paused" | "expired" | "cancelled";
  course: ApiCourseSummary;
  batch: ApiBatch;
  access_start_at: string;
  access_end_at: string;
  progress?: ApiEnrollmentProgress;
  next_action?: string | null;
};

export type ApiClassSession = {
  id: string;
  enrollment_id?: string;
  topic: string;
  course_title?: string;
  batch_title?: string;
  teacher_name?: string;
  status: "scheduled" | "live" | "completed" | "cancelled" | "rescheduled";
  starts_at: string;
  ends_at: string;
  join_available: boolean;
  action_reason?: string | null;
};

export type ApiRecording = {
  id: string;
  enrollment_id?: string;
  course_title?: string;
  batch_title?: string;
  title: string;
  module_title?: string | null;
  recorded_at?: string | null;
  released_at?: string | null;
  teacher_name?: string | null;
  duration_seconds?: number | null;
  progress_percent?: number;
  state?: "available" | "processing" | "unavailable";
  thumbnail_url?: string | null;
  youtube_video_id?: string | null;
};

export type ApiResource = {
  id: string;
  enrollment_id?: string;
  course_title?: string;
  title: string;
  module_title?: string | null;
  file_type?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  released_at?: string | null;
  download_url?: string | null;
};

export type ApiSyllabusLesson = {
  id: string;
  title: string;
  type?: string | null;
  state?: string | null;
  order: number;
};

export type ApiSyllabusModule = {
  id: string;
  title: string;
  order: number;
  progress_percent?: number;
  lessons: ApiSyllabusLesson[];
};

export type ApiTest = {
  id: string;
  enrollment_id?: string;
  course_title?: string;
  title: string;
  status: "draft" | "scheduled" | "open" | "closed" | "result_hidden" | "result_released";
  opens_at: string;
  closes_at: string;
  duration_minutes: number;
  total_marks?: number | null;
  score?: number | null;
  attempts_used?: number;
  attempts_allowed?: number;
};

export type ApiAnnouncement = {
  id: string;
  title: string;
  summary?: string | null;
  body?: string | null;
  course_title?: string | null;
  published_at: string;
  pinned?: boolean;
  read?: boolean;
  href?: string | null;
};

export type ApiPayment = {
  id: string;
  status: "draft" | "submitted" | "under_review" | "approved" | "rejected" | "refunded" | "cancelled";
  expected_amount_npr: number;
  submitted_amount_npr: number;
  payment_method: string;
  transaction_reference?: string | null;
  submitted_at: string;
  rejection_reason?: string | null;
  proof_preview_available?: boolean;
  course_title?: string | null;
  batch_title?: string | null;
  receipt_id?: string | null;
};

export type ApiStudentReceipt = {
  id: string;
  payment_id: string;
  issued_at: string;
  student_name: string;
  student_code: string;
  payment_reference: string;
  payment_method: string;
  course_title: string;
  batch_title: string;
  amount_npr: number;
};

export type ApiStudentDashboard = {
  next_class: ApiClassSession | null;
  active_courses: ApiEnrollment[];
  upcoming_tests: ApiTest[];
  announcements: ApiAnnouncement[];
  continue_recording?: ApiRecording | null;
  payment_review_count?: number;
};

export type ApiTeacher = {
  id: string;
  user_id?: string | null;
  slug: string;
  name: string;
  role?: string | null;
  subjects?: string[];
  experience_summary?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
};

export type ApiFaq = {
  id?: string;
  question: string;
  answer: string;
};

export type ApiStaffStudent = {
  id: string;
  name: string;
  mobile: string;
  email?: string | null;
  student_code?: string | null;
  status: "active" | "suspended" | "pending";
  current_course_title?: string | null;
  joined_at?: string | null;
};

export type ApiPaymentQueueItem = ApiPayment & {
  student_name?: string | null;
  risk_label?: string | null;
};

export type ApiStaffEnrollment = {
  id: string;
  student_name: string;
  course_title: string;
  batch_title: string;
  access_end_at: string;
  status: string;
};
