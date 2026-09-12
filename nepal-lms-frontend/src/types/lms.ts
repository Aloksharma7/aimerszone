export type MachineRole = "student" | "teacher" | "staff" | "admin" | "super_admin";
// "staff" and "accounting" are still two physical URL prefixes (unchanged,
// to avoid an unnecessary route-rename), but both now require the same
// "staff" machine role — see portalRoleToMachineRole in lib/auth/roles.ts.
export type PortalRole = "student" | "teacher" | "staff" | "accounting" | "admin";

export type RequiredAction = "verify_email" | "change_password" | "two_factor_challenge" | null;

export type SessionUser = {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  studentCode: string | null;
  avatarUrl: string | null;
  status: "active" | "suspended";
  roles: MachineRole[];
  permissions: string[];
  requiredAction: RequiredAction;
  portalHome: string;
};

export type CourseFeature = "Live" | "Recordings" | "Tests" | "Notes";
export type CourseAccent = "blue" | "amber" | "teal" | "violet" | "rose" | "slate";

export type CourseBatchOption = {
  id: string;
  title: string;
  status: string;
  schedule: string;
  startDate: string;
  accessUntil: string;
  priceNpr: number;
  capacity: number | null;
  teacherNames: string[];
};

export type Course = {
  id?: string;
  slug: string;
  code: string;
  title: string;
  shortTitle: string;
  category: string;
  categoryId?: string | null;
  description: string;
  shortDescription?: string | null;
  image: string;
  price: number;
  originalPrice?: number;
  isFree?: boolean;
  status: "Upcoming" | "Ongoing" | "Open" | "Draft" | "Archived";
  published?: boolean;
  /*
   * Display fields for the *nearest enrollable* batch, kept so existing cards
   * and lists keep working. They are a summary, not the whole picture.
   */
  batchId: string;
  batch: string;
  teacher: string;
  teacherSlug: string;
  schedule: string;
  startDate: string;
  access: string;
  seats?: string;

  /*
   * Every enrollable batch.
   *
   * mapCourse() used to collapse the list to batches[0], so a course with a
   * morning and an evening batch showed only one of them everywhere outside
   * the admin batch list — the second batch was invisible to students and
   * unbuyable.
   */
  batches: CourseBatchOption[];
  features: CourseFeature[];
  modules: number;
  lessons: number;
  accent: CourseAccent;
  createdAt?: string;
  updatedAt?: string;
};

export type CourseInput = {
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
  features: CourseFeature[];
  published: boolean;
};

export type CourseCategory = {
  id?: string;
  name: string;
  slug?: string;
  icon?: string;
  detail?: string;
  count?: number;
};

export type Teacher = {
  id?: string;

  /*
   * The user account id. `id` is the teacher-profile id and the two are not
   * interchangeable: anything that assigns a teacher (batch teacher_ids) is
   * validated against users.id.
   */
  userId?: string;
  slug: string;
  name: string;
  role: string;
  subjects: string[];
  experience: string;
  bio: string;
  initials: string;
  accent: string;
  avatarUrl: string | null;
  isPublic: boolean;
  sortOrder: number;
};

export type Faq = { question: string; answer: string };

export type Enrollment = {
  id: string;
  course: Course;
  progress: number;
  attendance: number;
  recordings: number;
  tests: number;
  syllabus: number;
  nextAction: string;
  accessExpiry: string;
  status?: "active" | "paused" | "expired" | "pending";
};

export type LiveSession = {
  id: string;
  enrollmentId?: string;
  title: string;
  course: string;
  batch: string;
  teacher: string;
  date: string;
  time: string;
  startsAt?: string;
  endsAt?: string;
  status: "Live now" | "Upcoming" | "Completed" | "Rescheduled" | "Cancelled";
  joinState: string;
  joinAvailable?: boolean;
};

export type Recording = {
  id: string;
  enrollmentId?: string;
  course?: string;
  batch?: string;
  title: string;
  module: string;
  date: string;
  teacher: string;
  duration: string;
  progress: number;
  state: "In progress" | "Not started" | "Completed" | "Available" | "Processing";
  syncMessage?: string | null;
  thumbnailUrl?: string | null;
  orientation: "landscape" | "portrait";
  videoId?: string | null;
  isPublicWarning?: boolean;
  syllabusLessonId?: string | null;
};

export type Resource = {
  id: string;
  enrollmentId?: string;
  course?: string;
  title: string;
  module: string;
  type: "PDF" | "DOC" | "PPT" | "Sheet" | string;
  mimeType?: string;
  size: string;
  released: string;
  downloadUrl?: string | null;
  syllabusLessonId?: string | null;
};

export type SyllabusLesson = {
  id?: string;
  title: string;
  type: string;
  state: string;
  recordingId?: string | null;
  resourceId?: string | null;
};

export type SyllabusModule = {
  id: string;
  title: string;
  progress: number;
  lessons: SyllabusLesson[];
};

export type StudentTest = {
  id: string;
  enrollmentId?: string;
  title: string;
  course: string;
  availability: string;
  duration: string;
  marks: string;
  attempts: string;
  status: "Available" | "Upcoming" | "Completed" | "Closed";
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  course: string;
  date: string;
  pinned: boolean;
};

export type PaymentMethodOption = {
  id: string;
  name: string;
  accountName?: string | null;
  accountIdentifier?: string | null;
  qrImageUrl?: string | null;
  instructions?: string | null;
};

export type PaymentOptions = {
  batchId: string;
  courseTitle: string;
  batchTitle: string;
  expectedAmountNpr: number;
  currency: "NPR" | string;
  methods: PaymentMethodOption[];
};

export type Payment = {
  id: string;
  course: string;
  batch: string;
  amount: number;
  submitted: string;
  method: string;
  reference: string;
  status: "Approved" | "Under review" | "Rejected" | "Submitted" | "Refunded" | "Draft";
  reason?: string;
  /** Null even for an approved payment when automatic receipts are switched off. */
  receiptId: string | null;
  proofAvailable: boolean;
  proofMimeType: string | null;
};

export type StudentReceipt = {
  id: string;
  paymentId: string;
  issuedAt: string;
  studentName: string;
  studentCode: string;
  paymentReference: string;
  paymentMethod: string;
  course: string;
  batch: string;
  amountNpr: number;
};

export type StudentNotification = Announcement & {
  read?: boolean;
  href?: string | null;
};

export type StudentDashboardData = {
  greetingName: string;
  nextClass: LiveSession | null;
  activeEnrollments: Enrollment[];
  upcomingTests: StudentTest[];
  announcements: Announcement[];
  continueRecording: Recording | null;
  metrics: {
    activeCourses: number;
    attendancePercent: number;
    upcomingTests: number;
    paymentsUnderReview: number;
  };
};

export type StudentCourseWorkspace = {
  enrollment: Enrollment;
  nextClass: LiveSession | null;
  announcements: Announcement[];
  recordings: Recording[];
  resources: Resource[];
  syllabus: SyllabusModule[];
  tests: StudentTest[];
};

export type TeacherBatch = {
  id: string;
  course: string;
  batch: string;
  students: number;
  schedule: string;
  progress: number;
  nextClass: string;
  status: string;
};

export type StaffStudent = {
  id: string;
  /** Human-readable code (e.g. "STD-2083-1001") shown to staff — id is the real identifier used for routing and API lookups, and the two are not interchangeable. */
  studentCode?: string | null;
  name: string;
  phone: string;
  email?: string | null;
  course: string;
  status: string;
  joined: string;
};

export type StaffEnrollment = {
  id: string;
  student: string;
  course: string;
  batch: string;
  accessUntil: string;
  status: string;
};

export type StaffEnrollmentDetail = {
  id: string;
  studentId: string | null;
  studentName: string;
  studentCode: string | null;
  studentMobile: string | null;
  studentEmail: string | null;
  courseId: string | null;
  courseTitle: string;
  batchId: string | null;
  batchTitle: string;
  status: string;
  source: string;
  accessStartAt: string | null;
  accessEndAt: string | null;
  activatedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  hasPayment: boolean;
  attendancePercent: number;
  recordingPercent: number;
  testPercent: number;
  overallPercent: number;
  createdAt: string | null;
};

export type PaymentQueueItem = {
  id: string;
  student: string;
  course: string;
  amount: number;
  method: string;
  submitted: string;
  risk: string;
  status: string;
  hasProof: boolean;
};

export type StaffCourse = Course & {
  enrollments?: number;
  /** Count of batches for the course-list table; the full list is Course.batches. */
  batchCount?: number;
  lastUpdated?: string;
  owner?: string;
};

export type AdminBatch = {
  id: string;
  name: string;
  course: string;
  teacher: string;
  schedule: string;
  students: number;
  capacity: number;

  /** Display strings, for tables. */
  startDate: string;
  endDate: string;
  status: string;

  /*
   * Raw values for the edit form. Never render these; never feed the display
   * strings above into an <input type="date">, which only accepts YYYY-MM-DD.
   */
  courseId: string;
  teacherIds: string[];
  startAt: string;
  endAt: string;
  accessUntil: string;
  priceNpr: number;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  lastSeen: string;
  mfa: string;
};

export type RoleDefinition = {
  id: string;
  key: string;
  name: string;
  users: number;
  description: string;
  permissions: string[];
  protected: boolean;
};

export type AdminAnnouncement = {
  id: string;
  title: string;
  audience: string;
  author: string;
  channel: string;
  scheduled: string;
  status: string;
};

export type AuditEntry = {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
  reason: string;
};

export type Pagination = {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
  next: string | null;
  previous: string | null;
};

export type Paginated<T> = { items: T[]; pagination: Pagination };
