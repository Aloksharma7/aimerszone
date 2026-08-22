/** Display-ready domain types, mapped from api-dtos.ts by adapters.ts. Grows with each Phase 2 screen. */

export type EnrollmentSummary = {
  id: string;
  courseTitle: string;
  batchTitle: string;
  thumbnailUrl: string | null;
  progressPercent: number;
  nextAction: string;
  accessExpiry: string;
  status: "active" | "expired" | "cancelled" | "pending";
};

export type LiveSession = {
  id: string;
  enrollmentId: string | null;
  topic: string;
  courseTitle: string;
  batchTitle: string;
  teacherName: string;
  date: string;
  timeRange: string;
  joinAvailable: boolean;
  actionReason: string | null;
};

export type UpcomingTest = {
  id: string;
  enrollmentId: string | null;
  title: string;
  courseTitle: string;
  availability: string;
};

export type DashboardAnnouncement = {
  id: string;
  title: string;
  body: string;
  courseTitle: string;
  date: string;
  pinned: boolean;
  read: boolean;
};

export type ContinueRecording = {
  id: string;
  enrollmentId: string | null;
  title: string;
  courseTitle: string;
  progressPercent: number;
};

export type Payment = {
  id: string;
  courseTitle: string;
  batchTitle: string;
  amountNpr: number;
  submittedAt: string;
  method: string;
  reference: string;
  status: "Approved" | "Under review" | "Submitted" | "Rejected" | "Refunded" | "Draft";
  rejectionReason: string | null;
  receiptId: string | null;
};

export type EnrollmentDetail = {
  id: string;
  courseTitle: string;
  batchTitle: string;
  thumbnailUrl: string | null;
  teacherNames: string[];
  scheduleSummary: string;
  accessExpiry: string;
  status: "active" | "expired" | "cancelled" | "pending";
  progress: {
    attendance: number;
    recordings: number;
    tests: number;
    syllabus: number;
    overall: number;
  };
};

export type CourseRecording = {
  id: string;
  title: string;
  moduleTitle: string;
  teacherName: string;
  date: string;
  duration: string;
  progressPercent: number;
  state: "Processing" | "Completed" | "In progress" | "Available" | "Not started";
  thumbnailUrl: string | null;
};

export type CourseResource = {
  id: string;
  title: string;
  moduleTitle: string;
  type: string;
  size: string;
  releasedDate: string;
};

export type CourseTest = {
  id: string;
  title: string;
  status: "Available" | "Upcoming" | "Completed" | "Closed";
  availability: string;
  marks: string;
  attemptsLabel: string;
};

export type SyllabusLesson = { id: string; title: string; type: string; completed: boolean };

export type SyllabusModule = {
  id: string;
  title: string;
  progressPercent: number;
  lessons: SyllabusLesson[];
};

export type Receipt = {
  id: string;
  paymentId: string;
  issuedAt: string;
  studentName: string;
  studentCode: string;
  paymentReference: string;
  paymentMethod: string;
  courseTitle: string;
  batchTitle: string;
  amountNpr: number;
};

export type AccountSession = {
  id: string;
  device: string;
  browser: string;
  platform: string;
  location: string | null;
  lastActiveAt: string;
  current: boolean;
};

export type AccountProfile = {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  identityCode: string | null;
  avatarUrl: string | null;
  twoFactorEnabled: boolean;
  twoFactorRequired: boolean;
  sessions: AccountSession[];
};

export type SupportTicket = {
  id: string;
  reference: string;
  subject: string;
  status: "Open" | "Pending" | "Resolved" | "Closed";
  createdAt: string;
  updatedAt: string;
  replyCount: number;
};

export type SupportFaq = { id: string; question: string; answer: string };

export type SupportOverview = {
  contactPhone: string | null;
  contactWhatsapp: string | null;
  contactEmail: string | null;
  contactHours: string | null;
  faqs: SupportFaq[];
  tickets: SupportTicket[];
};

export type TeacherSession = {
  id: string;
  title: string;
  courseTitle: string;
  batchTitle: string;
  date: string;
  timeRange: string;
  status: "scheduled" | "live" | "completed" | "rescheduled" | "cancelled";
  studentsCount: number;
  attendanceState: "finalized" | "pending";
  startAvailable: boolean;
  canStart: boolean;
  canFinalizeAttendance: boolean;
};

export type TeacherBatchSummary = {
  id: string;
  courseTitle: string;
  batchTitle: string;
  studentsCount: number;
  scheduleSummary: string;
  syllabusProgressPercent: number;
  nextClassAt: string | null;
  nextClassLabel: string | null;
  status: string;
};

export type FollowUp = { id: string; title: string; detail: string; type: string };

export type TeacherDashboard = {
  nextSession: TeacherSession | null;
  metrics: {
    assignedBatches: number;
    ongoingBatches: number;
    upcomingBatches: number;
    classesToday: number;
    attendanceActions: number;
    activeStudents: number;
  };
  todaySessions: TeacherSession[];
  followUps: FollowUp[];
  batches: TeacherBatchSummary[];
};

export type BatchStudent = {
  id: string;
  studentCode: string | null;
  name: string;
  mobile: string | null;
  email: string | null;
  status: string;
  joinedAt: string | null;
};

export type TeacherBatchDetail = {
  batch: TeacherBatchSummary;
  students: BatchStudent[];
  counts: { classes: number; attendancePercent: number; recordings: number; tests: number; resources: number; announcements: number };
};

export type AttendanceListItem = {
  id: string;
  title: string;
  batchTitle: string;
  startsAt: string;
  studentsCount: number;
  status: "finalized" | "pending";
};

export type AttendanceOverview = {
  sessions: AttendanceListItem[];
  metrics: { awaiting: number; finalizedThisWeek: number; assignedStudents: number };
};

export type AttendanceStatus = "present" | "absent" | "late" | "excused" | "review";

export type AttendanceParticipant = {
  studentId: string;
  studentName: string;
  status: AttendanceStatus;
};

export type AttendanceDetail = {
  session: TeacherSession;
  summary: { enrolled: number; finalized: boolean };
  participants: AttendanceParticipant[];
};

export type StaffStudent = {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  studentCode: string | null;
  status: string;
  currentCourseTitle: string | null;
  joinedAt: string | null;
};

export type PaymentQueueItem = {
  id: string;
  studentName: string;
  status: Payment["status"];
  amountNpr: number;
  method: string;
  submittedAt: string;
  courseTitle: string;
  batchTitle: string;
  riskLabel: string;
};

export type PaymentDetail = {
  id: string;
  status: string;
  submittedAt: string;
  submittedByName: string | null;
  studentName: string;
  studentCode: string | null;
  studentMobile: string | null;
  courseTitle: string;
  batchTitle: string;
  expectedAmountNpr: number;
  submittedAmountNpr: number;
  paymentMethod: string;
  transactionReference: string | null;
  paidAt: string | null;
  existingEnrollmentLabel: string;
  proofAvailable: boolean;
  duplicateCheck: { state: "duplicate" | "warning" | "clear"; message: string };
};

export type BatchOption = { id: string; title: string; status: string; priceNpr: number };
export type CourseOption = { id: string; title: string; batches: BatchOption[] };
export type PaymentMethodOption = { id: string; name: string; accountName: string; accountIdentifier: string };

export type CategoryOption = { id: string; name: string };

export type SupportTicketStatus = "open" | "pending" | "resolved" | "closed";
export type SupportTicketPriority = "low" | "normal" | "high";

export type SupportTicketSummary = {
  id: string;
  reference: string;
  subject: string;
  category: string | null;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  studentName: string | null;
  assigneeName: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export type SupportQueue = {
  items: SupportTicketSummary[];
  metrics: { open: number; pending: number; resolvedMonth: number; waitingOver2Days: number };
};

export type SupportMessage = { id: string; body: string; isInternal: boolean; authorName: string; fromStudent: boolean; createdAt: string };

export type SupportTicketDetail = SupportTicketSummary & {
  message: string;
  email: string | null;
  mobile: string | null;
  resolutionNote: string | null;
  canManage: boolean;
  messages: SupportMessage[];
};

export type SupportAssignee = { id: string; name: string };

export type AdminCourseBatch = { id: string; title: string; status: string; priceNpr: number };

export type AdminCourseSummary = {
  id: string;
  slug: string;
  code: string;
  title: string;
  shortTitle: string | null;
  shortDescription: string | null;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  thumbnailUrl: string | null;
  accessType: "free" | "paid";
  startingPriceNpr: number | null;
  originalPriceNpr: number | null;
  published: boolean;
  availableBatches: number | null;
  features: string[];
  modulesCount: number | null;
  lessonsCount: number | null;
  batches: AdminCourseBatch[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type AdminCourseDetail = AdminCourseSummary;

export type AdminPaymentMethod = {
  id: string;
  name: string;
  accountName: string | null;
  accountReference: string | null;
  bankName: string | null;
  branch: string | null;
  qrImageUrl: string | null;
  status: "active" | "disabled";
  sortOrder: number;
};

export type FeatureStatus = { enabled: boolean; ready: boolean; missing: string[] };

export type AdminSettings = {
  institution: {
    name: string;
    shortName: string;
    tagline: string;
    primaryPhone: string;
    supportEmail: string;
    whatsapp: string;
    website: string;
    address: string;
    logoUrl: string | null;
    faviconUrl: string | null;
  };
  paymentMethods: AdminPaymentMethod[];
  security: {
    publicRegistration: boolean;
    emailVerification: boolean;
    privilegedMfa: boolean;
    forcePasswordChange: boolean;
    sessionTimeoutHours: number;
    failedLoginAttempts: number;
    lockoutMinutes: number;
  };
  operations: {
    maintenanceNotice: boolean;
    automaticReceipts: boolean;
    dailyIntegrationHealthCheck: boolean;
  };
  features: {
    singleDeviceLogin: FeatureStatus;
    dynamicWatermark: FeatureStatus;
    smsNotifications: FeatureStatus;
    esewaCheckout: FeatureStatus;
    studentSupportTickets: FeatureStatus;
    publicFreeCourses: FeatureStatus;
  };
  sms: {
    provider: "sparrow" | "generic";
    endpoint: string;
    senderId: string;
    tokenConfigured: boolean;
    notifyClassStarting: boolean;
    notifyPaymentDecision: boolean;
    notifyEnrollmentActivated: boolean;
  };
  esewa: { environment: "sandbox" | "live"; merchantCode: string; secretKeyConfigured: boolean };
  content: { watermarkOpacity: number; watermarkIntervalSeconds: number };
};

export type IntegrationStatus = { connected: boolean; status: string; missing: string[]; failuresLastDay?: number };
export type IntegrationEvent = { id: string; action: string; reference: string | null; status: string; message: string | null; occurredAt: string };

export type AdminRole = {
  id: string;
  key: string;
  name: string;
  usersCount: number;
  description: string;
  permissions: string[];
  protected: boolean;
};

export type AdminPermission = { id: string; key: string; group: string; description: string | null };

export type AdminFaq = {
  id: string;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  isPublished: boolean;
};

export type AuditLogEntry = {
  id: string;
  actorLabel: string;
  action: string;
  targetLabel: string;
  occurredAt: string;
  reason: string | null;
};

export type AdminAnnouncement = {
  id: string;
  title: string;
  audienceLabel: string;
  authorName: string;
  channelLabel: string;
  scheduledLabel: string;
  status: "draft" | "scheduled" | "published" | "archived";
};

export type AdminAnnouncementQueue = {
  items: AdminAnnouncement[];
  metrics: { publishedMonth: number; scheduled: number; nextScheduledLabel: string; deliveryRatePercent: number };
};

export type AdminBatch = {
  id: string;
  title: string;
  courseTitle: string;
  teacherName: string | null;
  teacherNames: string[];
  scheduleSummary: string | null;
  studentsCount: number;
  capacity: number;
  startAt: string | null;
  endAt: string | null;
  status: string;
  courseId: string;
  teacherIds: string[];
  startDate: string | null;
  endDate: string | null;
  accessUntilDate: string | null;
  priceNpr: number;
};

export type AdminTeacherOption = { id: string; name: string };
export type AdminCourseOption = { id: string; title: string };

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  courseCount: number;
};

export type LedgerReceipt = {
  id: string;
  paymentId: string;
  studentName: string;
  courseTitle: string;
  amountNpr: number;
  issuedAt: string;
  status: string;
};

export type LedgerReceiptQueue = {
  items: LedgerReceipt[];
  metrics: { today: number; month: number; adjusted: number };
};

export type LedgerAdjustment = {
  id: string;
  paymentId: string;
  studentName: string;
  type: string;
  amountNpr: number;
  reason: string;
  createdAt: string;
  status: string;
};

export type AdjustmentQueue = {
  items: LedgerAdjustment[];
  metrics: { pending: number; completedMonth: number; refundedMonthNpr: number };
};

export type Refund = {
  id: string;
  paymentId: string;
  studentName: string;
  amountNpr: number;
  reason: string;
  requestedAt: string;
  status: string;
};

export type RefundQueue = {
  items: Refund[];
  metrics: { pending: number; completedMonth: number; completedAmountNpr: number; exceptions: number };
};

export type AdminAttentionItem = { id: string; title: string; detail: string; tone: "amber" | "blue" | "red" | "green" };

export type AdminDashboard = {
  metrics: {
    activeStudents: number;
    activeBatches: number;
    publishedCourses: number;
    activeEnrollments: number;
    pendingPayments: number;
    collectionsMonthNpr: number;
  };
  attention: AdminAttentionItem[];
};

export type AdminUser = {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  primaryRole: string;
  status: string;
  lastSeenAt: string | null;
  mfaEnabled: boolean;
};

export type AdminUserDetail = {
  user: AdminUser & { studentCode: string | null; emailVerified: boolean };
  metrics: { activeEnrollments: number; approvedPayments: number; learningProgressPercent: number; lastSignInLabel: string };
  enrollments: { id: string; courseTitle: string; batchTitle: string; accessLabel: string; basisLabel: string; status: string }[];
  activity: { id: string; occurredAt: string; action: string; detail: string }[];
};

export type CatalogueBatch = {
  id: string;
  title: string;
  status: string;
  scheduleSummary: string;
  startDate: string;
  accessUntil: string;
  priceNpr: number;
  capacity: number | null;
  teacherNames: string[];
};

export type CatalogueCourse = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  categoryName: string | null;
  thumbnailUrl: string | null;
  accessType: "free" | "paid";
  startingPriceNpr: number;
  originalPriceNpr: number | null;
  features: string[];
  teacherName: string | null;
  batches: CatalogueBatch[];
};

export type PaymentOptions = {
  batchId: string;
  batchTitle: string;
  courseTitle: string;
  expectedAmountNpr: number;
  seatsRemaining: number | null;
  alreadyEnrolled: boolean;
  pendingReview: boolean;
  methods: PaymentMethodOption[];
};

export type TestLaunch = {
  id: string;
  title: string;
  courseTitle: string | null;
  totalMarks: number;
  durationSeconds: number;
  attemptsUsed: number;
  attemptsAllowed: number;
  canStart: boolean;
  reason: string | null;
};

export type AttemptOption = { id: string; label: string; text: string };

export type AttemptQuestion = {
  id: string;
  order: number;
  type: "single" | "multiple" | "true_false" | "short_text";
  prompt: string;
  marks: number;
  options: AttemptOption[];
  response: string | null;
  responses: string[];
  flagged: boolean;
};

export type Attempt = {
  id: string;
  testId: string;
  title: string;
  courseTitle: string | null;
  totalMarks: number;
  durationSeconds: number;
  expiresAt: string;
  serverNow: string;
  attemptNumber: number;
  attemptsAllowed: number;
  questions: AttemptQuestion[];
};

export type AttemptResult = {
  id: string;
  title: string;
  courseTitle: string | null;
  releaseState: "released" | "pending";
  score: number | null;
  totalMarks: number;
  passMarks: number;
  correct: number | null;
  incorrect: number | null;
  unanswered: number | null;
  timeUsedSeconds: number | null;
  attemptsRemaining: number;
  reattemptTestId: string | null;
};

export type TeacherRecording = {
  id: string;
  title: string;
  moduleTitle: string | null;
  thumbnailUrl: string | null;
  duration: string;
  state: "processing" | "available";
  released: boolean;
};

export type TeacherResource = {
  id: string;
  title: string;
  moduleTitle: string | null;
  fileType: string | null;
  size: string;
  released: boolean;
  downloadCount: number;
  isPublic: boolean;
};

export type TeacherTestSummary = {
  id: string;
  title: string;
  durationMinutes: number;
  submissionsCount: number;
  attemptsAllowed: number;
  status: string;
};

export type TestResultRow = {
  id: string;
  studentName: string;
  studentCode: string | null;
  attemptNumber: number;
  status: string;
  score: number | null;
  maxScore: number;
  passed: boolean | null;
  submittedAt: string | null;
  autoSubmitted: boolean;
};

export type TestResults = {
  test: { id: string; title: string; totalMarks: number; passMark: number };
  metrics: { submissions: number; graded: number; passed: number; averageScore: number | null };
  attempts: TestResultRow[];
};

export type Dashboard = {
  nextClass: LiveSession | null;
  activeCourses: EnrollmentSummary[];
  upcomingTests: UpcomingTest[];
  announcements: DashboardAnnouncement[];
  continueRecording: ContinueRecording | null;
  paymentReviewCount: number;
};
