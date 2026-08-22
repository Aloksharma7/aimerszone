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
  { name: "Management", icon: "BriefcaseBusiness", detail: "BBS, BBA and business courses", count: 8 },
  { name: "Entrance Preparation", icon: "Target", detail: "CMAT and university entrance", count: 6 },
  { name: "Banking & Loksewa", icon: "Landmark", detail: "Structured competitive preparation", count: 5 },
  { name: "School Preparation", icon: "School", detail: "Clear subject-based support", count: 7 },
  { name: "Free Learning", icon: "Gift", detail: "Orientation, tests and study skills", count: 4 },
];

export const courses: Course[] = [
  {
    slug: "bbs-first-year-microeconomics",
    code: "BBS-MICRO-01",
    title: "BBS First Year Microeconomics",
    shortTitle: "Microeconomics",
    category: "Management",
    description:
      "Build a strong foundation in demand, supply, elasticity and market equilibrium through live explanation, guided practice and exam-focused tests.",
    image: "/images/course-microeconomics.svg",
    price: 3500,
    originalPrice: 4500,
    status: "Upcoming",
    batchId: "batch-micro-evening-2083",
    batch: "Evening Batch · 2083",
    teacher: "Aarav Sharma",
    teacherSlug: "aarav-sharma",
    schedule: "Sun–Thu · 7:00–8:15 PM",
    startDate: "17 Aug 2026",
    access: "4 months access",
    seats: "Enrollment open",
    batches: [{ id: "batch-micro-evening-2083", title: "Evening Batch · 2083", status: "open", schedule: "Sun–Thu · 7:00–8:15 PM", startDate: "17 Aug 2026", accessUntil: "4 months access", priceNpr: 3500, capacity: null, teacherNames: ["Aarav Sharma"] }],
    features: ["Live", "Recordings", "Tests", "Notes"],
    modules: 8,
    lessons: 42,
    accent: "blue",
  },
  {
    slug: "cmat-preparation-foundation",
    code: "CMAT-FOUND-01",
    title: "CMAT Preparation Foundation",
    shortTitle: "CMAT Foundation",
    category: "Entrance Preparation",
    description:
      "A structured preparation batch covering verbal ability, quantitative ability, logical reasoning and general awareness.",
    image: "/images/course-cmat.svg",
    price: 6200,
    originalPrice: 7500,
    status: "Upcoming",
    batchId: "batch-cmat-morning-2083",
    batch: "Morning Batch · 2083",
    teacher: "Maya Gurung",
    teacherSlug: "maya-gurung",
    schedule: "Sun–Fri · 6:30–8:00 AM",
    startDate: "24 Aug 2026",
    access: "6 months access",
    seats: "Limited seats",
    batches: [{ id: "batch-cmat-morning-2083", title: "Morning Batch · 2083", status: "open", schedule: "Sun–Fri · 6:30–8:00 AM", startDate: "24 Aug 2026", accessUntil: "6 months access", priceNpr: 6200, capacity: null, teacherNames: ["Maya Gurung"] }],
    features: ["Live", "Recordings", "Tests", "Notes"],
    modules: 12,
    lessons: 76,
    accent: "amber",
  },
  {
    slug: "banking-exam-complete-preparation",
    code: "BANK-COMP-01",
    title: "Banking Exam Complete Preparation",
    shortTitle: "Banking Preparation",
    category: "Banking & Loksewa",
    description:
      "Concept classes, weekly practice sets and targeted mock tests for major banking examinations in Nepal.",
    image: "/images/course-banking.svg",
    price: 8500,
    originalPrice: 10000,
    status: "Ongoing",
    batchId: "batch-banking-evening-2083",
    batch: "Evening Batch · Running",
    teacher: "Nischal Karki",
    teacherSlug: "nischal-karki",
    schedule: "Sun–Fri · 6:00–7:30 PM",
    startDate: "3 Aug 2026",
    access: "8 months access",
    seats: "Late enrollment available",
    batches: [{ id: "batch-banking-evening-2083", title: "Evening Batch · Running", status: "open", schedule: "Sun–Fri · 6:00–7:30 PM", startDate: "3 Aug 2026", accessUntil: "8 months access", priceNpr: 8500, capacity: null, teacherNames: ["Nischal Karki"] }],
    features: ["Live", "Recordings", "Tests", "Notes"],
    modules: 16,
    lessons: 112,
    accent: "teal",
  },
  {
    slug: "class-12-accountancy-revision",
    code: "ACC-12-REV",
    title: "Class 12 Accountancy Revision",
    shortTitle: "Accountancy Revision",
    category: "School Preparation",
    description:
      "Focused chapter revision, worked examples and timed practice designed for board-exam preparation.",
    image: "/images/course-accountancy.svg",
    price: 2800,
    status: "Upcoming",
    batchId: "batch-accountancy-weekend",
    batch: "Weekend Revision Batch",
    teacher: "Srijana Adhikari",
    teacherSlug: "srijana-adhikari",
    schedule: "Fri–Sat · 8:00–10:00 AM",
    startDate: "21 Aug 2026",
    access: "3 months access",
    seats: "Enrollment open",
    batches: [{ id: "batch-accountancy-weekend", title: "Weekend Revision Batch", status: "open", schedule: "Fri–Sat · 8:00–10:00 AM", startDate: "21 Aug 2026", accessUntil: "3 months access", priceNpr: 2800, capacity: null, teacherNames: ["Srijana Adhikari"] }],
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
    slug: "free-cmat-diagnostic-test",
    code: "FREE-CMAT-TEST",
    title: "Free CMAT Diagnostic Test",
    shortTitle: "CMAT Diagnostic",
    category: "Free Learning",
    description:
      "Identify your current strengths and gaps with a timed diagnostic test and a clear performance summary.",
    image: "/images/course-diagnostic.svg",
    price: 0,
    isFree: true,
    status: "Open",
    batchId: "batch-free-cmat-diagnostic",
    batch: "Instant access",
    teacher: "Assessment Team",
    teacherSlug: "assessment-team",
    schedule: "Available anytime",
    startDate: "Start anytime",
    access: "7 days access",
    batches: [{ id: "batch-free-cmat-diagnostic", title: "Instant access", status: "open", schedule: "Available anytime", startDate: "Start anytime", accessUntil: "7 days access", priceNpr: 0, capacity: null, teacherNames: ["Assessment Team"] }],
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
    role: "Economics Faculty",
    subjects: ["Microeconomics", "Business Economics"],
    experience: "8 years teaching experience",
    bio: "Known for clear explanations, worked numerical examples and structured exam preparation.",
    initials: "AS",
    accent: "from-blue-600 to-blue-800",
  },
  {
    slug: "maya-gurung",
    name: "Maya Gurung",
    role: "Entrance Preparation Faculty",
    subjects: ["Verbal Ability", "Study Skills"],
    experience: "7 years teaching experience",
    bio: "Helps students build repeatable study routines and confidence through guided practice.",
    initials: "MG",
    accent: "from-amber-500 to-orange-700",
  },
  {
    slug: "nischal-karki",
    name: "Nischal Karki",
    role: "Banking & Aptitude Faculty",
    subjects: ["Quantitative Aptitude", "Reasoning"],
    experience: "9 years teaching experience",
    bio: "Focuses on speed, accuracy and practical solving techniques for competitive examinations.",
    initials: "NK",
    accent: "from-teal-500 to-emerald-800",
  },
  {
    slug: "srijana-adhikari",
    name: "Srijana Adhikari",
    role: "Accountancy Faculty",
    subjects: ["Accountancy", "Financial Basics"],
    experience: "6 years teaching experience",
    bio: "Uses step-by-step demonstrations and frequent practice to strengthen accounting fundamentals.",
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
    title: "Elasticity of Demand — Numerical Practice",
    course: "BBS First Year Microeconomics",
    batch: "Evening Batch · 2083",
    teacher: "Aarav Sharma",
    date: "Today",
    time: "7:00–8:15 PM",
    status: "Live now" as const,
    joinState: "Join class" as const,
  },
  {
    id: "session-next-1",
    title: "Logical Reasoning: Series and Patterns",
    course: "CMAT Preparation Foundation",
    batch: "Morning Batch · 2083",
    teacher: "Maya Gurung",
    date: "Tomorrow",
    time: "6:30–8:00 AM",
    status: "Upcoming" as const,
    joinState: "Opens 15 min before" as const,
  },
  {
    id: "session-next-2",
    title: "Simple and Compound Interest",
    course: "Banking Exam Complete Preparation",
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
    nextAction: "Continue: Price Elasticity Practice",
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
    nextAction: "Watch: Verbal Analogy Review",
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
    id: "test-elasticity-01",
    title: "Elasticity Practice Test",
    course: "BBS First Year Microeconomics",
    availability: "Available until 12 Aug, 9:00 PM",
    duration: "25 minutes",
    marks: "20 marks",
    attempts: "1 of 2 attempts",
    status: "Available",
  },
  {
    id: "test-cmat-diagnostic-02",
    title: "CMAT Weekly Diagnostic",
    course: "CMAT Preparation Foundation",
    availability: "Opens 13 Aug, 6:00 AM",
    duration: "45 minutes",
    marks: "50 marks",
    attempts: "1 attempt",
    status: "Upcoming",
  },
  {
    id: "test-demand-01",
    title: "Demand and Supply Quiz",
    course: "BBS First Year Microeconomics",
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
    body: "The Microeconomics class on Wednesday will begin 30 minutes later. The Zoom room remains the same.",
    course: "BBS First Year Microeconomics",
    date: "2 hours ago",
    pinned: true,
  },
  {
    id: "announcement-2",
    title: "New recording and notes available",
    body: "The Verbal Analogy recording and practice notes are now available in your course workspace.",
    course: "CMAT Preparation Foundation",
    date: "Yesterday",
    pinned: false,
  },
  {
    id: "announcement-3",
    title: "Weekly test opens on Thursday",
    body: "Review the first three reasoning lessons before starting the timed weekly test.",
    course: "CMAT Preparation Foundation",
    date: "2 days ago",
    pinned: false,
  },
];

export const payments = [
  {
    id: "PAY-2083-0142",
    course: "BBS First Year Microeconomics",
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
    course: "CMAT Preparation Foundation",
    batch: "Morning Batch · 2083",
    amount: 6200,
    submitted: "9 Aug 2026, 10:12 AM",
    method: "Bank transfer",
    reference: "NBL-826541",
    status: "Under review",
  },
  {
    id: "PAY-2083-0109",
    course: "Class 12 Accountancy Revision",
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
    id: "rec-price-elasticity",
    title: "Price Elasticity of Demand",
    module: "Module 3 · Elasticity",
    date: "7 Aug 2026",
    teacher: "Aarav Sharma",
    duration: "1h 08m",
    progress: 62,
    state: "In progress",
  },
  {
    id: "rec-income-cross-elasticity",
    title: "Income and Cross Elasticity",
    module: "Module 3 · Elasticity",
    date: "5 Aug 2026",
    teacher: "Aarav Sharma",
    duration: "56m",
    progress: 0,
    state: "Not started",
  },
  {
    id: "rec-demand-curve",
    title: "Demand Curve and Determinants",
    module: "Module 2 · Demand and Supply",
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
    title: "Introduction to Microeconomics",
    progress: 100,
    lessons: [
      { title: "Meaning, scope and importance", type: "Recording", state: "Completed" },
      { title: "Micro vs macro economics", type: "Notes", state: "Completed" },
      { title: "Basic economic problems", type: "Test", state: "Completed" },
    ],
  },
  {
    id: "module-2",
    title: "Demand and Supply",
    progress: 80,
    lessons: [
      { title: "Demand function and law of demand", type: "Recording", state: "Completed" },
      { title: "Movement and shift in demand", type: "Recording", state: "Completed" },
      { title: "Supply function and equilibrium", type: "Live class", state: "Continue" },
      { title: "Demand and supply practice set", type: "Test", state: "Available" },
    ],
  },
  {
    id: "module-3",
    title: "Elasticity",
    progress: 42,
    lessons: [
      { title: "Price elasticity concepts", type: "Recording", state: "In progress" },
      { title: "Numerical methods", type: "Live class", state: "Live today" },
      { title: "Income and cross elasticity", type: "Recording", state: "Available" },
      { title: "Elasticity practice test", type: "Test", state: "Available" },
    ],
  },
  {
    id: "module-4",
    title: "Market Equilibrium",
    progress: 0,
    lessons: [
      { title: "Equilibrium price and quantity", type: "Recording", state: "Locked" },
      { title: "Effects of demand and supply changes", type: "Notes", state: "Locked" },
    ],
  },
];

export const resources = [
  { id: "res-1", title: "Elasticity formula sheet", module: "Module 3", type: "PDF", size: "1.2 MB", released: "7 Aug 2026" },
  { id: "res-2", title: "Demand and supply practice set", module: "Module 2", type: "PDF", size: "840 KB", released: "3 Aug 2026" },
  { id: "res-3", title: "Course outline and calendar", module: "Course information", type: "PDF", size: "410 KB", released: "20 Jul 2026" },
];

export const teacherBatches = [
  {
    id: "batch-micro-evening-2083",
    course: "BBS First Year Microeconomics",
    batch: "Evening Batch · 2083",
    students: 64,
    schedule: "Sun–Thu · 7:00–8:15 PM",
    progress: 46,
    nextClass: "Today · 7:00 PM",
    status: "Ongoing",
  },
  {
    id: "batch-bba-economics-morning",
    course: "BBA Business Economics",
    batch: "Morning Batch · 2083",
    students: 42,
    schedule: "Mon–Fri · 6:30–7:30 AM",
    progress: 68,
    nextClass: "Tomorrow · 6:30 AM",
    status: "Ongoing",
  },
  {
    id: "batch-micro-next",
    course: "BBS First Year Microeconomics",
    batch: "Morning Batch · September",
    students: 18,
    schedule: "Sun–Thu · 6:30–7:45 AM",
    progress: 0,
    nextClass: "Starts 7 Sep 2026",
    status: "Upcoming",
  },
];

export const staffStudents = [
  { id: "STD-2083-1001", name: "Riya Thapa", phone: "+977 98XXXX1001", course: "BBS Microeconomics", status: "Active", joined: "8 Aug 2026" },
  { id: "STD-2083-1002", name: "Suman Rai", phone: "+977 98XXXX1002", course: "CMAT Foundation", status: "Pending payment", joined: "9 Aug 2026" },
  { id: "STD-2083-1003", name: "Anisha K.C.", phone: "+977 98XXXX1003", course: "Banking Preparation", status: "Active", joined: "7 Aug 2026" },
  { id: "STD-2083-1004", name: "Prabin Sah", phone: "+977 98XXXX1004", course: "Accountancy Revision", status: "Access expired", joined: "28 Jul 2026" },
  { id: "STD-2083-1005", name: "Nima Sherpa", phone: "+977 98XXXX1005", course: "Study Skills", status: "Free", joined: "6 Aug 2026" },
];

export const paymentQueue = [
  { id: "PAY-2083-0162", student: "Suman Rai", course: "CMAT Foundation", amount: 6200, method: "eSewa", submitted: "12 min ago", risk: "Normal", status: "Submitted", hasProof: true },
  { id: "PAY-2083-0161", student: "Aakriti Bista", course: "Banking Preparation", amount: 8500, method: "Bank transfer", submitted: "31 min ago", risk: "Reference missing", status: "Submitted", hasProof: true },
  { id: "PAY-2083-0160", student: "Roshan Chaudhary", course: "Microeconomics", amount: 3500, method: "Khalti", submitted: "48 min ago", risk: "Possible duplicate", status: "Flagged", hasProof: true },
  { id: "PAY-2083-0159", student: "Sneha Shrestha", course: "Accountancy Revision", amount: 2800, method: "eSewa", submitted: "1h ago", risk: "Normal", status: "Under review", hasProof: false },
];

export const auditEntries = [
  { id: "AUD-090812", actor: "staff@example.test", action: "Payment approved", target: "PAY-2083-0158", time: "9 Aug, 12:08 PM", reason: "Matched bank reference" },
  { id: "AUD-090811", actor: "admin@example.test", action: "Batch schedule updated", target: "CMAT Morning Batch", time: "9 Aug, 11:42 AM", reason: "Teacher availability" },
  { id: "AUD-090810", actor: "teacher.one@example.test", action: "Attendance finalized", target: "Microeconomics · 8 Aug", time: "9 Aug, 10:16 AM", reason: "Zoom import reviewed" },
  { id: "AUD-090809", actor: "officer@example.test", action: "Student profile corrected", target: "STD-2083-1002", time: "9 Aug, 9:55 AM", reason: "Phone digit corrected" },
];
