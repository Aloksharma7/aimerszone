export type CourseFeature = "Live" | "Recordings" | "Tests" | "Notes";

export type Course = {
  slug: string;
  code: string;
  title: string;
  shortTitle: string;
  category: string;
  description: string;
  image: string;
  price: number;
  originalPrice?: number;
  isFree?: boolean;
  status: "Upcoming" | "Ongoing" | "Open";
  batchId: string;
  batch: string;
  teacher: string;
  teacherSlug: string;
  schedule: string;
  startDate: string;
  access: string;
  seats?: string;

  /** Mirrors Course["batches"]; preview data carries the summary batch only. */
  batches: Array<{ id: string; title: string; status: string; schedule: string; startDate: string; accessUntil: string; priceNpr: number; capacity: number | null; teacherNames: string[] }>;
  features: CourseFeature[];
  modules: number;
  lessons: number;
  accent: "blue" | "amber" | "teal" | "violet" | "rose" | "slate";
};

export const categories = [
  { name: "Physics", icon: "BriefcaseBusiness", detail: "Class 11-12 and entrance-level Physics", count: 8 },
  { name: "Chemistry", icon: "Target", detail: "Class 11-12 and entrance-level Chemistry", count: 6 },
  { name: "Entrance Preparation", icon: "Landmark", detail: "Engineering and medical entrance exams", count: 5 },
  { name: "School Preparation", icon: "School", detail: "Clear subject-based support", count: 7 },
  { name: "Free Learning", icon: "Gift", detail: "Orientation, tests and study skills", count: 4 },
];

export const courses: Course[] = [
  {
    slug: "class-12-physics-complete",
    code: "PHY-12-COMP",
    title: "Class 12 Physics Complete Course",
    shortTitle: "Physics Complete",
    category: "Physics",
    description:
      "Build a strong foundation in mechanics, optics, electricity and modern physics through live explanation, guided practice and exam-focused tests.",
    image: "/images/course-physics.svg",
    price: 3500,
    originalPrice: 4500,
    status: "Upcoming",
    batchId: "batch-physics-evening-2083",
    batch: "Evening Batch · 2083",
    teacher: "Aarav Sharma",
    teacherSlug: "aarav-sharma",
    schedule: "Sun–Thu · 7:00–8:15 PM",
    startDate: "17 Aug 2026",
    access: "4 months access",
    seats: "Enrollment open",
    batches: [{ id: "batch-physics-evening-2083", title: "Evening Batch · 2083", status: "open", schedule: "Sun–Thu · 7:00–8:15 PM", startDate: "17 Aug 2026", accessUntil: "4 months access", priceNpr: 3500, capacity: null, teacherNames: ["Aarav Sharma"] }],
    features: ["Live", "Recordings", "Tests", "Notes"],
    modules: 8,
    lessons: 42,
    accent: "blue",
  },
  {
    slug: "chemistry-foundation-entrance",
    code: "CHEM-FOUND-01",
    title: "Chemistry Foundation for Entrance Exams",
    shortTitle: "Chemistry Foundation",
    category: "Entrance Preparation",
    description:
      "A structured preparation batch covering organic, inorganic and physical chemistry for engineering and medical entrance exams.",
    image: "/images/course-chemistry.svg",
    price: 6200,
    originalPrice: 7500,
    status: "Upcoming",
    batchId: "batch-chemistry-morning-2083",
    batch: "Morning Batch · 2083",
    teacher: "Maya Gurung",
    teacherSlug: "maya-gurung",
    schedule: "Sun–Fri · 6:30–8:00 AM",
    startDate: "24 Aug 2026",
    access: "6 months access",
    seats: "Limited seats",
    batches: [{ id: "batch-chemistry-morning-2083", title: "Morning Batch · 2083", status: "open", schedule: "Sun–Fri · 6:30–8:00 AM", startDate: "24 Aug 2026", accessUntil: "6 months access", priceNpr: 6200, capacity: null, teacherNames: ["Maya Gurung"] }],
    features: ["Live", "Recordings", "Tests", "Notes"],
    modules: 12,
    lessons: 76,
    accent: "amber",
  },
  {
    slug: "physics-entrance-complete-preparation",
    code: "PHY-ENT-01",
    title: "Physics Entrance Exam Complete Preparation",
    shortTitle: "Physics Entrance Prep",
    category: "Entrance Preparation",
    description:
      "Concept classes, weekly practice sets and targeted mock tests for engineering and medical entrance examinations.",
    image: "/images/course-physics-entrance.svg",
    price: 8500,
    originalPrice: 10000,
    status: "Ongoing",
    batchId: "batch-physics-entrance-evening-2083",
    batch: "Evening Batch · Running",
    teacher: "Nischal Karki",
    teacherSlug: "nischal-karki",
    schedule: "Sun–Fri · 6:00–7:30 PM",
    startDate: "3 Aug 2026",
    access: "8 months access",
    seats: "Late enrollment available",
    batches: [{ id: "batch-physics-entrance-evening-2083", title: "Evening Batch · Running", status: "open", schedule: "Sun–Fri · 6:00–7:30 PM", startDate: "3 Aug 2026", accessUntil: "8 months access", priceNpr: 8500, capacity: null, teacherNames: ["Nischal Karki"] }],
    features: ["Live", "Recordings", "Tests", "Notes"],
    modules: 16,
    lessons: 112,
    accent: "teal",
  },
  {
    slug: "class-12-chemistry-revision",
    code: "CHEM-12-REV",
    title: "Class 12 Chemistry Revision",
    shortTitle: "Chemistry Revision",
    category: "School Preparation",
    description:
      "Focused chapter revision, worked examples and timed practice designed for board-exam preparation.",
    image: "/images/course-chemistry-revision.svg",
    price: 2800,
    status: "Upcoming",
    batchId: "batch-chemistry-weekend",
    batch: "Weekend Revision Batch",
    teacher: "Srijana Adhikari",
    teacherSlug: "srijana-adhikari",
    schedule: "Fri–Sat · 8:00–10:00 AM",
    startDate: "21 Aug 2026",
    access: "3 months access",
    seats: "Enrollment open",
    batches: [{ id: "batch-chemistry-weekend", title: "Weekend Revision Batch", status: "open", schedule: "Fri–Sat · 8:00–10:00 AM", startDate: "21 Aug 2026", accessUntil: "3 months access", priceNpr: 2800, capacity: null, teacherNames: ["Srijana Adhikari"] }],
    features: ["Live", "Recordings", "Tests", "Notes"],
    modules: 10,
    lessons: 36,
    accent: "violet",
  },
  {
    slug: "free-study-skills-orientation",
    code: "FREE-STUDY-01",
    title: "Free Study Skills Orientation",
    shortTitle: "Study Skills",
    category: "Free Learning",
    description:
      "A practical orientation on planning, note-making, revision and test preparation for college students.",
    image: "/images/course-study-skills.svg",
    price: 0,
    isFree: true,
    status: "Open",
    batchId: "batch-study-skills-free",
    batch: "Self-paced + Live Orientation",
    teacher: "Maya Gurung",
    teacherSlug: "maya-gurung",
    schedule: "Open now · Live Q&A monthly",
    startDate: "Start anytime",
    access: "30 days access",
    batches: [{ id: "batch-study-skills-free", title: "Self-paced + Live Orientation", status: "open", schedule: "Open now · Live Q&A monthly", startDate: "Start anytime", accessUntil: "30 days access", priceNpr: 0, capacity: null, teacherNames: ["Maya Gurung"] }],
    features: ["Recordings", "Tests", "Notes"],
    modules: 4,
    lessons: 12,
    accent: "rose",
  },
  {
    slug: "free-physics-diagnostic-test",
    code: "FREE-PHY-TEST",
    title: "Free Physics Diagnostic Test",
    shortTitle: "Physics Diagnostic",
    category: "Free Learning",
    description:
      "Identify your current strengths and gaps with a timed diagnostic test and a clear performance summary.",
    image: "/images/course-diagnostic.svg",
    price: 0,
    isFree: true,
    status: "Open",
    batchId: "batch-free-physics-diagnostic",
    batch: "Instant access",
    teacher: "Assessment Team",
    teacherSlug: "assessment-team",
    schedule: "Available anytime",
    startDate: "Start anytime",
    access: "7 days access",
    batches: [{ id: "batch-free-physics-diagnostic", title: "Instant access", status: "open", schedule: "Available anytime", startDate: "Start anytime", accessUntil: "7 days access", priceNpr: 0, capacity: null, teacherNames: ["Assessment Team"] }],
    features: ["Tests"],
    modules: 1,
    lessons: 1,
    accent: "slate",
  },
];

export type Teacher = {
  slug: string;
  name: string;
  role: string;
  subjects: string[];
  experience: string;
  bio: string;
  initials: string;
  accent: string;
};

export const teachers: Teacher[] = [
  {
    slug: "aarav-sharma",
    name: "Aarav Sharma",
    role: "Physics Faculty",
    subjects: ["Physics", "Mechanics"],
    experience: "8 years teaching experience",
    bio: "Known for clear explanations, worked numerical examples and structured exam preparation.",
    initials: "AS",
    accent: "from-blue-600 to-blue-800",
  },
  {
    slug: "maya-gurung",
    name: "Maya Gurung",
    role: "Chemistry Faculty",
    subjects: ["Organic Chemistry", "Inorganic Chemistry"],
    experience: "7 years teaching experience",
    bio: "Helps students build strong chemistry fundamentals and exam confidence through guided practice.",
    initials: "MG",
    accent: "from-amber-500 to-orange-700",
  },
  {
    slug: "nischal-karki",
    name: "Nischal Karki",
    role: "Physics Entrance Faculty",
    subjects: ["Physics", "Numerical Problem-Solving"],
    experience: "9 years teaching experience",
    bio: "Focuses on speed, accuracy and practical problem-solving techniques for physics in competitive examinations.",
    initials: "NK",
    accent: "from-teal-500 to-emerald-800",
  },
  {
    slug: "srijana-adhikari",
    name: "Srijana Adhikari",
    role: "Chemistry Faculty",
    subjects: ["Physical Chemistry", "Chemistry"],
    experience: "6 years teaching experience",
    bio: "Uses step-by-step demonstrations and frequent practice to strengthen chemistry fundamentals.",
    initials: "SA",
    accent: "from-violet-500 to-indigo-800",
  },
];

export const faqs = [
  {
    question: "How do I enroll in a paid batch?",
    answer:
      "Choose a batch, pay using one of the listed methods, upload your payment proof and reference, and wait for verification. Your learning access starts after approval.",
  },
  {
    question: "Can I join after the batch has already started?",
    answer:
      "Some ongoing batches allow late enrollment. The batch page clearly shows whether late enrollment is open and which earlier recordings will be available.",
  },
  {
    question: "Where do I find missed classes?",
    answer:
      "Approved recordings appear inside your course workspace under Recordings. Availability depends on the batch access policy and release status.",
  },
  {
    question: "Can I study using a mobile phone?",
    answer:
      "Yes. The student experience is designed mobile-first, including live-class joining, recordings, tests, resources and payment submission.",
  },
  {
    question: "What happens if my payment proof is rejected?",
    answer:
      "You will see the reason in your payment history and can correct the details or submit a clearer proof without creating a duplicate account.",
  },
];

export const liveSessions = [
  {
    id: "session-live-1",
    title: "Newton's Laws — Numerical Practice",
    course: "Class 12 Physics Complete Course",
    batch: "Evening Batch · 2083",
    teacher: "Aarav Sharma",
    date: "Today",
    time: "7:00–8:15 PM",
    status: "Live now" as const,
    joinState: "Join class" as const,
  },
  {
    id: "session-next-1",
    title: "Periodic Table: Trends and Patterns",
    course: "Chemistry Foundation for Entrance Exams",
    batch: "Morning Batch · 2083",
    teacher: "Maya Gurung",
    date: "Tomorrow",
    time: "6:30–8:00 AM",
    status: "Upcoming" as const,
    joinState: "Opens 15 min before" as const,
  },
  {
    id: "session-next-2",
    title: "Kinematics: Motion in a Straight Line",
    course: "Physics Entrance Exam Complete Preparation",
    batch: "Evening Batch · Running",
    teacher: "Nischal Karki",
    date: "11 Aug",
    time: "6:00–7:30 PM",
    status: "Upcoming" as const,
    joinState: "View details" as const,
  },
];

export const activeEnrollments = [
  {
    id: "enroll-micro-001",
    course: courses[0],
    progress: 48,
    attendance: 88,
    recordings: 42,
    tests: 56,
    syllabus: 51,
    nextAction: "Continue: Newton's Laws Practice",
    accessExpiry: "15 Dec 2026",
  },
  {
    id: "enroll-cmat-001",
    course: courses[1],
    progress: 27,
    attendance: 92,
    recordings: 21,
    tests: 30,
    syllabus: 25,
    nextAction: "Watch: Periodic Table Review",
    accessExpiry: "28 Feb 2027",
  },
  {
    id: "enroll-study-001",
    course: courses[4],
    progress: 76,
    attendance: 100,
    recordings: 80,
    tests: 70,
    syllabus: 75,
    nextAction: "Complete: Weekly Planning Test",
    accessExpiry: "5 Sep 2026",
  },
];

export const studentTests = [
  {
    id: "test-physics-laws-01",
    title: "Newton's Laws Practice Test",
    course: "Class 12 Physics Complete Course",
    availability: "Available until 12 Aug, 9:00 PM",
    duration: "25 minutes",
    marks: "20 marks",
    attempts: "1 of 2 attempts",
    status: "Available",
  },
  {
    id: "test-chemistry-diagnostic-02",
    title: "Chemistry Weekly Diagnostic",
    course: "Chemistry Foundation for Entrance Exams",
    availability: "Opens 13 Aug, 6:00 AM",
    duration: "45 minutes",
    marks: "50 marks",
    attempts: "1 attempt",
    status: "Upcoming",
  },
  {
    id: "test-motion-01",
    title: "Motion and Forces Quiz",
    course: "Class 12 Physics Complete Course",
    availability: "Completed 3 Aug",
    duration: "20 minutes",
    marks: "18/20",
    attempts: "Submitted",
    status: "Completed",
  },
];

export const announcements = [
  {
    id: "announcement-1",
    title: "Wednesday class moved to 7:30 PM",
    body: "The Physics class on Wednesday will begin 30 minutes later. The Zoom room remains the same.",
    course: "Class 12 Physics Complete Course",
    date: "2 hours ago",
    pinned: true,
  },
  {
    id: "announcement-2",
    title: "New recording and notes available",
    body: "The Periodic Table recording and practice notes are now available in your course workspace.",
    course: "Chemistry Foundation for Entrance Exams",
    date: "Yesterday",
    pinned: false,
  },
  {
    id: "announcement-3",
    title: "Weekly test opens on Thursday",
    body: "Review the first three chemistry lessons before starting the timed weekly test.",
    course: "Chemistry Foundation for Entrance Exams",
    date: "2 days ago",
    pinned: false,
  },
];

export const payments = [
  {
    id: "PAY-2083-0142",
    course: "Class 12 Physics Complete Course",
    batch: "Evening Batch · 2083",
    amount: 3500,
    submitted: "8 Aug 2026, 4:18 PM",
    method: "eSewa",
    reference: "98XXXX2142",
    status: "Approved",
    receiptId: "rcp-2083-0142",
  },
  {
    id: "PAY-2083-0158",
    course: "Chemistry Foundation for Entrance Exams",
    batch: "Morning Batch · 2083",
    amount: 6200,
    submitted: "9 Aug 2026, 10:12 AM",
    method: "Bank transfer",
    reference: "NBL-826541",
    status: "Under review",
  },
  {
    id: "PAY-2083-0109",
    course: "Class 12 Chemistry Revision",
    batch: "Weekend Revision Batch",
    amount: 2800,
    submitted: "2 Aug 2026, 2:45 PM",
    method: "Khalti",
    reference: "KH-20109",
    status: "Rejected",
    reason: "The uploaded proof is unclear. Please upload the full transaction screen.",
  },
];

export const recordings = [
  {
    id: "rec-newtons-second-law",
    title: "Newton's Second Law — Numerical Practice",
    module: "Module 3 · Laws of Motion",
    date: "7 Aug 2026",
    teacher: "Aarav Sharma",
    duration: "1h 08m",
    progress: 62,
    state: "In progress",
  },
  {
    id: "rec-applications-newtons-laws",
    title: "Applications of Newton's Laws",
    module: "Module 3 · Laws of Motion",
    date: "5 Aug 2026",
    teacher: "Aarav Sharma",
    duration: "56m",
    progress: 0,
    state: "Not started",
  },
  {
    id: "rec-force-and-motion",
    title: "Introduction to Force and Motion",
    module: "Module 2 · Force and Motion",
    date: "29 Jul 2026",
    teacher: "Aarav Sharma",
    duration: "1h 12m",
    progress: 100,
    state: "Completed",
  },
];

export const syllabusModules = [
  {
    id: "module-1",
    title: "Introduction to Mechanics",
    progress: 100,
    lessons: [
      { title: "Units and measurements", type: "Recording", state: "Completed" },
      { title: "Scalars and vectors", type: "Notes", state: "Completed" },
      { title: "Basic kinematics problems", type: "Test", state: "Completed" },
    ],
  },
  {
    id: "module-2",
    title: "Force and Motion",
    progress: 80,
    lessons: [
      { title: "Types of force and free body diagrams", type: "Recording", state: "Completed" },
      { title: "Motion under constant force", type: "Recording", state: "Completed" },
      { title: "Equilibrium of forces", type: "Live class", state: "Continue" },
      { title: "Force and motion practice set", type: "Test", state: "Available" },
    ],
  },
  {
    id: "module-3",
    title: "Laws of Motion",
    progress: 42,
    lessons: [
      { title: "Newton's laws — core concepts", type: "Recording", state: "In progress" },
      { title: "Numerical methods", type: "Live class", state: "Live today" },
      { title: "Applications of Newton's laws", type: "Recording", state: "Available" },
      { title: "Laws of motion practice test", type: "Test", state: "Available" },
    ],
  },
  {
    id: "module-4",
    title: "Work, Energy and Power",
    progress: 0,
    lessons: [
      { title: "Work done by a force", type: "Recording", state: "Locked" },
      { title: "Conservation of energy", type: "Notes", state: "Locked" },
    ],
  },
];

export const resources = [
  { id: "res-1", title: "Laws of motion formula sheet", module: "Module 3", type: "PDF", size: "1.2 MB", released: "7 Aug 2026" },
  { id: "res-2", title: "Force and motion practice set", module: "Module 2", type: "PDF", size: "840 KB", released: "3 Aug 2026" },
  { id: "res-3", title: "Course outline and calendar", module: "Course information", type: "PDF", size: "410 KB", released: "20 Jul 2026" },
];

export const teacherBatches = [
  {
    id: "batch-physics-evening-2083",
    course: "Class 12 Physics Complete Course",
    batch: "Evening Batch · 2083",
    students: 64,
    schedule: "Sun–Thu · 7:00–8:15 PM",
    progress: 46,
    nextClass: "Today · 7:00 PM",
    status: "Ongoing",
  },
  {
    id: "batch-physics-entrance-morning",
    course: "Physics Entrance Exam Complete Preparation",
    batch: "Morning Batch · 2083",
    students: 42,
    schedule: "Mon–Fri · 6:30–7:30 AM",
    progress: 68,
    nextClass: "Tomorrow · 6:30 AM",
    status: "Ongoing",
  },
  {
    id: "batch-physics-next",
    course: "Class 12 Physics Complete Course",
    batch: "Morning Batch · September",
    students: 18,
    schedule: "Sun–Thu · 6:30–7:45 AM",
    progress: 0,
    nextClass: "Starts 7 Sep 2026",
    status: "Upcoming",
  },
];

export const staffStudents = [
  { id: "STD-2083-1001", name: "Riya Thapa", phone: "+977 98XXXX1001", course: "Physics Complete", status: "Active", joined: "8 Aug 2026" },
  { id: "STD-2083-1002", name: "Suman Rai", phone: "+977 98XXXX1002", course: "Chemistry Foundation", status: "Pending payment", joined: "9 Aug 2026" },
  { id: "STD-2083-1003", name: "Anisha K.C.", phone: "+977 98XXXX1003", course: "Physics Entrance Prep", status: "Active", joined: "7 Aug 2026" },
  { id: "STD-2083-1004", name: "Prabin Sah", phone: "+977 98XXXX1004", course: "Chemistry Revision", status: "Access expired", joined: "28 Jul 2026" },
  { id: "STD-2083-1005", name: "Nima Sherpa", phone: "+977 98XXXX1005", course: "Study Skills", status: "Free", joined: "6 Aug 2026" },
];

export const paymentQueue = [
  { id: "PAY-2083-0162", student: "Suman Rai", course: "Chemistry Foundation", amount: 6200, method: "eSewa", submitted: "12 min ago", risk: "Normal", status: "Submitted", hasProof: true },
  { id: "PAY-2083-0161", student: "Aakriti Bista", course: "Physics Entrance Prep", amount: 8500, method: "Bank transfer", submitted: "31 min ago", risk: "Reference missing", status: "Submitted", hasProof: true },
  { id: "PAY-2083-0160", student: "Roshan Chaudhary", course: "Physics Complete", amount: 3500, method: "Khalti", submitted: "48 min ago", risk: "Possible duplicate", status: "Flagged", hasProof: true },
  { id: "PAY-2083-0159", student: "Sneha Shrestha", course: "Chemistry Revision", amount: 2800, method: "eSewa", submitted: "1h ago", risk: "Normal", status: "Under review", hasProof: false },
];

export const auditEntries = [
  { id: "AUD-090812", actor: "staff@example.test", action: "Payment approved", target: "PAY-2083-0158", time: "9 Aug, 12:08 PM", reason: "Matched bank reference" },
  { id: "AUD-090811", actor: "admin@example.test", action: "Batch schedule updated", target: "Chemistry Morning Batch", time: "9 Aug, 11:42 AM", reason: "Teacher availability" },
  { id: "AUD-090810", actor: "teacher.one@example.test", action: "Attendance finalized", target: "Physics · 8 Aug", time: "9 Aug, 10:16 AM", reason: "Zoom import reviewed" },
  { id: "AUD-090809", actor: "officer@example.test", action: "Student profile corrected", target: "STD-2083-1002", time: "9 Aug, 9:55 AM", reason: "Phone digit corrected" },
];
