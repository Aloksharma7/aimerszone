/**
 * Mirrors the shapes returned by app/Http/Resources/*.php on the backend.
 * Grows alongside the mobile screens that consume each resource — see
 * docs/ROADMAP.md Phase 2. Field names stay snake_case here (matching the
 * wire format exactly) and get converted to camelCase in adapters.ts.
 */

export type ApiCourseSummary = {
  id: string;
  slug: string;
  title: string;
  short_title: string | null;
  thumbnail_url: string | null;
};

export type ApiBatch = {
  id: string;
  title: string;
  status: string;
  schedule_summary: string | null;
  access_until: string | null;
  teacher_names?: string[];
};

export type ApiEnrollment = {
  id: string;
  status: "active" | "expired" | "cancelled" | "pending";
  course: ApiCourseSummary;
  batch: ApiBatch;
  access_end_at: string | null;
  progress: {
    attendance_percent: number;
    recording_percent: number;
    test_percent: number;
    syllabus_percent: number;
    overall_percent: number;
  };
  next_action?: string | null;
};

export type ApiClassSession = {
  id: string;
  enrollment_id: string | null;
  topic: string;
  course_title: string | null;
  batch_title: string | null;
  teacher_name: string | null;
  status: "scheduled" | "live" | "completed" | "rescheduled" | "cancelled";
  starts_at: string;
  ends_at: string;
  join_available: boolean;
  action_reason: string | null;
};

export type ApiTest = {
  id: string;
  enrollment_id: string | null;
  course_title: string | null;
  title: string;
  status: "open" | "scheduled" | "closed" | "result_released";
  opens_at: string | null;
  closes_at: string | null;
  duration_minutes: number;
  total_marks: number;
  score: number | null;
  attempts_used: number;
  attempts_allowed: number;
};

export type ApiAnnouncement = {
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
  course_title: string | null;
  published_at: string | null;
  pinned: boolean;
  read: boolean;
  href: string | null;
};

export type ApiRecording = {
  id: string;
  enrollment_id: string | null;
  course_title: string | null;
  batch_title: string | null;
  title: string;
  module_title: string | null;
  recorded_at: string | null;
  released_at: string | null;
  teacher_name: string | null;
  duration_seconds: number | null;
  progress_percent: number;
  state: "processing" | "available";
  thumbnail_url: string | null;
  youtube_video_id: string | null;
};

export type ApiResourceFile = {
  id: string;
  enrollment_id: string | null;
  course_title: string | null;
  title: string;
  module_title: string | null;
  file_type: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  released_at: string | null;
  download_url: string | null;
};

export type ApiSyllabusLesson = {
  id: string;
  title: string;
  type: string | null;
  state: "Completed" | "Available";
  order: number;
};

export type ApiSyllabusModule = {
  id: string;
  title: string;
  order: number;
  progress_percent: number;
  lessons: ApiSyllabusLesson[];
};

export type ApiPayment = {
  id: string;
  status: "draft" | "submitted" | "under_review" | "approved" | "rejected" | "refunded" | "cancelled";
  expected_amount_npr: number;
  submitted_amount_npr: number;
  payment_method: string;
  transaction_reference: string | null;
  submitted_at: string | null;
  rejection_reason: string | null;
  proof_preview_available: boolean;
  course_title: string | null;
  batch_title: string | null;
  receipt_id: string | null;
};

export type ApiReceipt = {
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

export type ApiAccountSession = {
  id: string;
  device: string;
  browser: string;
  platform: string;
  location: string | null;
  last_active_at: string;
  current: boolean;
};

export type ApiAccountProfile = {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  identity_code: string | null;
  avatar_url: string | null;
  two_factor_enabled: boolean;
  two_factor_required: boolean;
  sessions: ApiAccountSession[];
};

export type ApiSupportTicket = {
  id: string;
  reference: string;
  subject: string;
  status: "open" | "pending" | "resolved" | "closed";
  created_at: string;
  resolved_at: string | null;
  reply_count: number;
  updated_at: string;
};

export type ApiSupportFaq = { id: string; question: string; answer: string };

export type ApiSupportOverview = {
  courses: { id: string; title: string }[];
  contact: { phone: string | null; whatsapp: string | null; email: string | null; hours: string | null };
  faqs: ApiSupportFaq[];
  tickets: ApiSupportTicket[];
};

export type ApiTeacherSession = {
  id: string;
  title: string;
  course_title: string;
  batch_title: string;
  teacher_name: string | null;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "live" | "completed" | "rescheduled" | "cancelled";
  students_count: number;
  instructions: string | null;
  attendance_state: "finalized" | "pending";
  start_available: boolean;
  can_start: boolean;
  can_finalize_attendance: boolean;
};

export type ApiTeacherBatch = {
  id: string;
  course_title: string;
  batch_title: string;
  students_count: number;
  schedule_summary: string;
  syllabus_progress_percent: number;
  next_class_at: string | null;
  next_class_label: string | null;
  status: string;
};

export type ApiFollowUp = { id: string; title: string; detail: string; href: string; type: string };

export type ApiTeacherDashboard = {
  next_session: ApiTeacherSession | null;
  metrics: {
    assigned_batches: number;
    ongoing_batches: number;
    upcoming_batches: number;
    classes_today: number;
    attendance_actions: number;
    active_students: number;
  };
  today_sessions: ApiTeacherSession[];
  follow_ups: ApiFollowUp[];
  batches: ApiTeacherBatch[];
};

export type ApiTeacherBatchDetail = {
  batch: ApiTeacherBatch;
  students: {
    id: string;
    student_code: string | null;
    name: string;
    mobile: string | null;
    email: string | null;
    status: string;
    joined_at: string | null;
  }[];
  counts: { classes: number; attendance_percent: number; recordings: number; tests: number; resources: number; announcements: number };
};

export type ApiAttendanceListItem = {
  id: string;
  title: string;
  batch_title: string;
  starts_at: string;
  students_count: number;
  status: "finalized" | "pending";
};

export type ApiAttendanceOverview = {
  sessions: ApiAttendanceListItem[];
  metrics: { awaiting: number; finalized_this_week: number; assigned_students: number };
};

export type ApiAttendanceParticipant = {
  student_id: string;
  student_name: string;
  participant_name: string | null;
  duration_seconds: number | null;
  match_confidence: "high" | "low" | "none";
  attendance_status: "present" | "absent" | "late" | "excused" | "review";
  override_reason: string | null;
};

export type ApiAttendanceDetail = {
  session: ApiTeacherSession;
  summary: { enrolled: number; matched: number; unmatched: number; needs_review: number; finalized: boolean };
  participants: ApiAttendanceParticipant[];
};

export type ApiStaffStudent = {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  student_code: string | null;
  status: string;
  current_course_title: string | null;
  joined_at: string | null;
};

export type ApiPaymentQueueItem = {
  id: string;
  student_name: string | null;
  status: "draft" | "submitted" | "under_review" | "approved" | "rejected" | "refunded" | "cancelled";
  expected_amount_npr: number;
  submitted_amount_npr: number;
  payment_method: string;
  transaction_reference: string | null;
  submitted_at: string | null;
  rejection_reason: string | null;
  proof_preview_available: boolean;
  course_title: string | null;
  batch_title: string | null;
  risk_label: string;
};

export type ApiPaymentDetail = {
  id: string;
  status: string;
  submitted_at: string;
  submitted_by_name: string | null;
  student: { id: string; student_code: string | null; name: string; mobile: string | null };
  course_title: string;
  batch_title: string;
  expected_amount_npr: number;
  submitted_amount_npr: number;
  payment_method: string;
  transaction_reference: string | null;
  paid_at: string | null;
  existing_enrollment_label: string;
  proof: { original_name: string | null; mime_type: string | null; size_label: string | null; available: boolean };
  duplicate_check: { state: "duplicate" | "warning" | "clear"; message: string };
};

export type ApiCourseOption = {
  id: string;
  title: string;
  batches?: { id: string; title: string; status: string; price_npr: number }[];
};

export type ApiPaymentMethodOption = { id: string; name: string; account_name: string; account_identifier: string };

export type ApiCategoryOption = { id: string; name: string; is_active: boolean };

export type ApiAdminAttentionItem = { id: string; title: string; detail: string; href: string; tone: "amber" | "blue" | "red" | "green" };

export type ApiAdminDashboard = {
  metrics: {
    active_students: number;
    active_batches: number;
    published_courses: number;
    categories: number;
    active_enrollments: number;
    pending_payments: number;
    collections_month_npr: number;
    approved_payments: number;
  };
  attention: ApiAdminAttentionItem[];
};

export type ApiAdminUser = {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  primary_role: string;
  status: string;
  last_seen_at: string | null;
  mfa_enabled: boolean;
};

export type ApiAdminUserDetail = {
  user: ApiAdminUser & { student_code: string | null; email_verified: boolean };
  metrics: { active_enrollments: number; approved_payments: number; learning_progress_percent: number; last_sign_in_label: string };
  enrollments: { id: string; course_title: string; batch_title: string; access_label: string; basis_label: string; status: string }[];
  activity: { id: string; occurred_at: string; action: string; detail: string }[];
};

export type ApiCatalogueBatch = {
  id: string;
  title: string;
  status: string;
  start_at: string | null;
  access_until: string | null;
  schedule_summary: string | null;
  price_npr: number;
  capacity: number | null;
  teacher_names: string[];
};

export type ApiCatalogueCourse = {
  id: string;
  slug: string;
  title: string;
  short_title: string | null;
  short_description: string | null;
  description: string | null;
  category: { id: string; name: string } | null;
  thumbnail_url: string | null;
  access_type: "free" | "paid";
  starting_price_npr: number;
  original_price_npr: number | null;
  published: boolean;
  features: string[];
  modules_count: number | null;
  lessons_count: number | null;
  batches: ApiCatalogueBatch[];
  teacher: { id: string; name: string; slug: string | null } | null;
};

export type ApiPaymentOptions = {
  batch_id: string;
  batch_title: string;
  course_title: string | null;
  expected_amount_npr: number;
  seats_remaining: number | null;
  already_enrolled: boolean;
  pending_review: boolean;
  methods: ApiPaymentMethodOption[];
};

export type ApiTestLaunch = {
  id: string;
  title: string;
  course_title: string | null;
  total_marks: number;
  duration_seconds: number;
  attempts_used: number;
  attempts_allowed: number;
  status: string;
  can_start: boolean;
  reason: string | null;
};

export type ApiAttemptOption = { id: string; label: string; text: string };

export type ApiAttemptQuestion = {
  id: string;
  order: number;
  type: "single" | "multiple" | "true_false" | "short_text";
  prompt: string;
  marks: number;
  options: ApiAttemptOption[];
  response: string | null;
  responses: string[];
  flagged: boolean;
};

export type ApiAttempt = {
  id: string;
  test_id: string;
  title: string;
  course_title: string | null;
  total_marks: number;
  duration_seconds: number;
  started_at: string;
  expires_at: string;
  server_now: string;
  attempt_number: number;
  attempts_allowed: number;
  questions: ApiAttemptQuestion[];
};

export type ApiAttemptResult = {
  id: string;
  title: string;
  course_title: string | null;
  submitted_at: string | null;
  release_state: "released" | "pending";
  score: number | null;
  total_marks: number;
  pass_marks: number;
  correct: number | null;
  incorrect: number | null;
  unanswered: number | null;
  time_used_seconds: number | null;
  attempts_remaining: number;
  reattempt_test_id: string | null;
};

export type ApiTeacherRecording = {
  id: string;
  title: string;
  module_title: string | null;
  youtube_video_id: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  state: "processing" | "available";
  released_at: string | null;
};

export type ApiTeacherResource = {
  id: string;
  title: string;
  module_title: string | null;
  file_type: string | null;
  size_bytes: number | null;
  released_at: string | null;
  released: boolean;
  download_count: number;
  is_public: boolean;
};

export type ApiTeacherTestSummary = {
  id: string;
  title: string;
  opens_at: string | null;
  closes_at: string | null;
  duration_minutes: number;
  submissions_count: number;
  attempts_allowed: number;
  status: string;
};

export type ApiTestResults = {
  test: { id: string; title: string; total_marks: number; pass_mark: number };
  metrics: { submissions: number; graded: number; passed: number; average_score: number | null };
  attempts: {
    id: string;
    student_name: string;
    student_code: string | null;
    attempt_number: number;
    status: string;
    score: number | null;
    max_score: number;
    passed: boolean | null;
    submitted_at: string | null;
    auto_submitted: boolean;
  }[];
};

export type ApiSupportTicketSummary = {
  id: string;
  reference: string;
  subject: string;
  category: string | null;
  status: "open" | "pending" | "resolved" | "closed";
  priority: "low" | "normal" | "high";
  student_name: string | null;
  assignee_name: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type ApiSupportQueue = {
  items: ApiSupportTicketSummary[];
  metrics: { open: number; pending: number; resolved_month: number; waiting_over_2_days: number };
};

export type ApiSupportMessage = { id: string; body: string; is_internal: boolean; author_name: string; from_student: boolean; created_at: string };

export type ApiSupportAssignee = { id: string; name: string };

export type ApiSupportTicketDetail = ApiSupportTicketSummary & {
  message: string;
  email: string | null;
  mobile: string | null;
  resolution_note: string | null;
  can_manage: boolean;
  messages: ApiSupportMessage[];
};

export type ApiAdminCourseBatch = { id: string; title: string; status: string; price_npr: number };

export type ApiAdminCourseSummary = {
  id: string;
  slug: string;
  code: string;
  title: string;
  short_title: string | null;
  short_description: string | null;
  description: string | null;
  category: { id: string; name: string } | null;
  thumbnail_url: string | null;
  access_type: "free" | "paid";
  starting_price_npr: number | null;
  original_price_npr: number | null;
  published: boolean;
  available_batches: number | null;
  features: string[];
  modules_count: number | null;
  lessons_count: number | null;
  batches?: ApiAdminCourseBatch[];
  created_at: string | null;
  updated_at: string | null;
};

export type ApiAdminCourseDetail = ApiAdminCourseSummary;

export type ApiAcademicReportRow = {
  id: string;
  batch: string;
  students: number;
  attendance: string;
  testAverage: string;
  syllabus: string;
  recordings: string;
  followUp: number;
};

export type ApiEnrollmentReportRow = {
  id: string;
  period: string;
  new: number;
  approved: number;
  pending: number;
  rejected: number;
  free: number;
  transfers: number;
};

export type ApiFinanceReportRow = {
  id: string;
  date: string;
  transactions: number;
  gross: number;
  refunds: number;
  adjustments: number;
  net: number;
  pending: number;
};

export type ApiAdminPaymentMethod = {
  id: string;
  name: string;
  account_name: string | null;
  account_reference: string | null;
  bank_name: string | null;
  branch: string | null;
  qr_image_url: string | null;
  status: "active" | "disabled";
  sort_order: number;
};

export type ApiFeatureStatus = { enabled: boolean; ready: boolean; missing: string[] };

export type ApiAdminSettings = {
  institution: {
    name: string;
    short_name: string;
    tagline: string;
    primary_phone: string;
    support_email: string;
    whatsapp: string;
    website: string;
    address: string;
    logo_url: string | null;
    favicon_url: string | null;
  };
  payment_methods: ApiAdminPaymentMethod[];
  security: {
    public_registration: boolean;
    email_verification: boolean;
    privileged_mfa: boolean;
    force_password_change: boolean;
    session_timeout_hours: number;
    failed_login_attempts: number;
    lockout_minutes: number;
  };
  operations: {
    maintenance_notice: boolean;
    automatic_receipts: boolean;
    daily_integration_health_check: boolean;
  };
  features: {
    single_device_login: ApiFeatureStatus;
    dynamic_watermark: ApiFeatureStatus;
    sms_notifications: ApiFeatureStatus;
    esewa_checkout: ApiFeatureStatus;
    student_support_tickets: ApiFeatureStatus;
    public_free_courses: ApiFeatureStatus;
  };
  sms: {
    provider: "sparrow" | "generic";
    endpoint: string;
    sender_id: string;
    token_configured: boolean;
    notify_class_starting: boolean;
    notify_payment_decision: boolean;
    notify_enrollment_activated: boolean;
  };
  esewa: { environment: "sandbox" | "live"; merchant_code: string; secret_key_configured: boolean };
  content: { watermark_opacity: number; watermark_interval_seconds: number };
};

export type ApiIntegrationStatus = { connected: boolean; status: string; missing: string[]; failures_last_day?: number };
export type ApiIntegrationRecord = Record<string, string>;
export type ApiIntegrationEvent = { id: string; action: string; reference: string | null; status: string; message: string | null; occurred_at: string };

export type ApiAdminRole = {
  id: string;
  key: string;
  name: string;
  users_count: number;
  description: string;
  permissions: string[];
  protected: boolean;
};

export type ApiAdminPermission = { id: string; key: string; group: string; description: string | null };

export type ApiAdminFaq = {
  id: string;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
  is_published: boolean;
};

export type ApiAuditLogEntry = {
  id: string;
  actor_label: string;
  action: string;
  target_label: string;
  occurred_at: string;
  reason: string | null;
};

export type ApiAdminAnnouncement = {
  id: string;
  title: string;
  audience_label: string;
  author_name: string;
  channel_label: string;
  scheduled_label: string;
  status: "draft" | "scheduled" | "published" | "archived";
};

export type ApiAdminAnnouncementQueue = {
  items: ApiAdminAnnouncement[];
  metrics: { published_month: number; scheduled: number; next_scheduled_label: string; delivery_rate_percent: number };
};

export type ApiAdminBatch = {
  id: string;
  title: string;
  course_title: string;
  teacher_name: string | null;
  teacher_names: string[];
  schedule_summary: string | null;
  students_count: number;
  capacity: number;
  start_at: string | null;
  end_at: string | null;
  status: string;
  course_id: string;
  teacher_ids: string[];
  start_date: string | null;
  end_date: string | null;
  access_until_date: string | null;
  price_npr: number;
};

export type ApiAdminTeacherOption = { id: string; user_id?: string; name: string };
export type ApiAdminCourseOption = { id: string; title: string };

export type ApiAdminCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  course_count: number;
};

export type ApiLedgerReceipt = {
  id: string;
  payment_id: string;
  student_name: string;
  course_title: string;
  amount_npr: number;
  issued_at: string;
  status: string;
};

export type ApiLedgerReceiptQueue = {
  items: ApiLedgerReceipt[];
  metrics: { today: number; month: number; adjusted: number };
};

export type ApiLedgerAdjustment = {
  id: string;
  payment_id: string;
  student_name: string;
  type: string;
  amount_npr: number;
  reason: string;
  created_at: string;
  status: string;
};

export type ApiAdjustmentQueue = {
  items: ApiLedgerAdjustment[];
  metrics: { pending: number; completed_month: number; refunded_month_npr: number };
};

export type ApiRefund = {
  id: string;
  payment_id: string;
  student_name: string;
  amount_npr: number;
  reason: string;
  requested_at: string;
  status: string;
};

export type ApiRefundQueue = {
  items: ApiRefund[];
  metrics: { pending: number; completed_month: number; completed_amount_npr: number; exceptions: number };
};

export type ApiDashboard = {
  next_class: ApiClassSession | null;
  active_courses: ApiEnrollment[];
  upcoming_tests: ApiTest[];
  announcements: ApiAnnouncement[];
  continue_recording: ApiRecording | null;
  payment_review_count: number;
};
