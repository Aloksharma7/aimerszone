import "server-only";

import type { ApiResponse, PageMeta, PaginatedResponse } from "@/lib/api/contracts";
import { pageMetaFrom } from "@/lib/api/contracts";
import { isServerApiError, serverApiFetch } from "@/lib/api/server-client";
import { mapAnnouncement, mapRecording } from "@/lib/data/adapters";
import type { ApiAnnouncement, ApiRecording } from "@/lib/data/api-dtos";
import { isMockDataEnabled } from "@/lib/data/config";
import { formatDate, formatDateTime, formatDuration, formatTimeRange } from "@/lib/data/format";
import {
  announcements,
  liveSessions,
  recordings,
  staffStudents,
  studentTests,
  syllabusModules,
  teacherBatches,
} from "@/data/mock";
import type { Announcement, Recording, StaffStudent, TeacherBatch } from "@/types/lms";

export type TeacherSession = {
  id: string;
  title: string;
  course: string;
  batch: string;
  teacher: string;
  date: string;
  time: string;
  duration: string;
  status: string;
  students: number;
  instructions?: string | null;
  attendanceState?: string | null;
  startAvailable?: boolean;
  canStart?: boolean;
  canFinalizeAttendance?: boolean;
  canReopenAttendance?: boolean;
};

export type TeacherFollowUp = {
  id: string;
  title: string;
  detail: string;
  href: string;
  type: "attendance" | "recording" | "test" | "content";
};

export type TeacherDashboardData = {
  greetingName: string;
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
  followUps: TeacherFollowUp[];
  batches: TeacherBatch[];
};

export type TeacherBatchDetail = {
  batch: TeacherBatch;
  students: StaffStudent[];
  counts: {
    classes: number;
    attendancePercent: number;
    recordings: number;
    tests: number;
    resources: number;
    announcements: number;
  };
};

export type TeacherAttendanceSession = {
  id: string;
  title: string;
  batch: string;
  date: string;
  students: number;
  status: string;
};

export type TeacherAttendanceRow = {
  id: string;
  name: string;
  participantName: string;
  duration: string;
  confidence: string;
  status: string;
  overrideReason?: string | null;
};

export type TeacherAttendanceDetail = {
  session: TeacherSession;
  summary: {
    enrolled: number;
    matched: number;
    unmatched: number;
    needsReview: number;
    finalized: boolean;
  };
  rows: TeacherAttendanceRow[];
};

export type TeacherTestRecord = {
  id: string;
  title: string;
  availability: string;
  duration: string;
  attempts: string;
  status: string;
};

export type TeacherContentItem = {
  id: string;
  title: string;
  detail: string;
  status: string;
  type: "recording" | "resource" | "test" | "announcement";
};

export type TeacherContentSummary = {
  metrics: { recordings: number; resources: number; tests: number; announcements: number };
  recent: TeacherContentItem[];
  batches: TeacherBatch[];
};

type ApiTeacherBatch = {
  id: string;
  course_title: string;
  batch_title: string;
  students_count: number;
  schedule_summary: string;
  syllabus_progress_percent: number;
  next_class_at?: string | null;
  next_class_label?: string | null;
  status: string;
};

type ApiTeacherStudent = {
  id: string;
  student_code?: string | null;
  name: string;
  mobile?: string | null;
  email?: string | null;
  status: string;
  joined_at?: string | null;
};

type ApiTeacherBatchDetail = {
  batch: ApiTeacherBatch;
  students: ApiTeacherStudent[];
  counts: {
    classes: number;
    attendance_percent: number;
    recordings: number;
    tests: number;
    resources: number;
    announcements: number;
  };
};

type ApiTeacherSession = {
  id: string;
  title: string;
  course_title: string;
  batch_title: string;
  teacher_name?: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  students_count: number;
  instructions?: string | null;
  attendance_state?: string | null;
  start_available?: boolean;
  can_start?: boolean;
  can_finalize_attendance?: boolean;
  can_reopen_attendance?: boolean;
};

type ApiTeacherDashboard = {
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
  follow_ups: Array<{
    id: string;
    title: string;
    detail: string;
    href: string;
    type: TeacherFollowUp["type"];
  }>;
  batches: ApiTeacherBatch[];
};

type ApiTeacherAttendanceSession = {
  id: string;
  title: string;
  batch_title: string;
  starts_at: string;
  students_count: number;
  status: string;
};

type ApiTeacherAttendanceDetail = {
  session: ApiTeacherSession;
  summary: {
    enrolled: number;
    matched: number;
    unmatched: number;
    needs_review: number;
    finalized: boolean;
  };
  participants: Array<{
    student_id: string;
    student_name: string;
    participant_name?: string | null;
    duration_seconds?: number | null;
    match_confidence: string;
    attendance_status: string;
    override_reason?: string | null;
  }>;
};

type ApiTeacherTestRecord = {
  id: string;
  title: string;
  opens_at?: string | null;
  closes_at?: string | null;
  duration_minutes: number;
  submissions_count?: number | null;
  attempts_allowed?: number | null;
  status: string;
};

type ApiTeacherContentSummary = {
  metrics: { recordings: number; resources: number; tests: number; announcements: number };
  recent: Array<{
    id: string;
    title: string;
    detail: string;
    status: string;
    type: TeacherContentItem["type"];
  }>;
  batches: ApiTeacherBatch[];
};

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function mapTeacherBatch(value: ApiTeacherBatch): TeacherBatch {
  return {
    id: value.id,
    course: value.course_title,
    batch: value.batch_title,
    students: value.students_count,
    schedule: value.schedule_summary,
    progress: value.syllabus_progress_percent,
    nextClass: value.next_class_label || (value.next_class_at ? formatDateTime(value.next_class_at) : "Not scheduled"),
    status: titleCase(value.status),
  };
}

function mapTeacherSession(value: ApiTeacherSession): TeacherSession {
  return {
    id: value.id,
    title: value.title,
    course: value.course_title,
    batch: value.batch_title,
    teacher: value.teacher_name || "Assigned teacher",
    date: formatDate(value.starts_at),
    time: formatTimeRange(value.starts_at, value.ends_at),
    duration: formatDuration(Math.max(0, (Date.parse(value.ends_at) - Date.parse(value.starts_at)) / 1000)),
    status: titleCase(value.status === "live" ? "live now" : value.status),
    students: value.students_count,
    instructions: value.instructions,
    attendanceState: value.attendance_state ? titleCase(value.attendance_state) : null,
    startAvailable: value.start_available,
    canStart: value.can_start,
    canFinalizeAttendance: value.can_finalize_attendance,
    canReopenAttendance: value.can_reopen_attendance,
  };
}

function mockTeacherSessions(): TeacherSession[] {
  return [
    {
      id: "session-live-1",
      title: "Elasticity of Demand — Numerical Practice",
      course: "BBS First Year Microeconomics",
      batch: "Evening Batch · 2083",
      teacher: "Aarav Sharma",
      date: "9 Aug 2026",
      time: "7:00–8:15 PM",
      duration: "1h 15m",
      status: "Live now",
      students: 64,
      instructions: "Begin with the numerical example shared in the previous notes. Reserve the final ten minutes for student questions and the test reminder.",
      attendanceState: "Live",
      startAvailable: true,
      canStart: true,
      canFinalizeAttendance: true,
    },
    {
      id: "session-complete-1",
      title: "Demand Forecasting Discussion",
      course: "BBA Business Economics",
      batch: "Morning Batch · 2083",
      teacher: "Aarav Sharma",
      date: "9 Aug 2026",
      time: "6:30–7:30 AM",
      duration: "1h",
      status: "Completed",
      students: 42,
      instructions: "Review attendance and release the approved recording after final checks.",
      attendanceState: "Awaiting finalization",
      startAvailable: false,
      canStart: false,
      canFinalizeAttendance: true,
    },
    {
      id: "session-next-2",
      title: "Consumer Behaviour and Utility",
      course: "BBA Business Economics",
      batch: "Morning Batch · 2083",
      teacher: "Aarav Sharma",
      date: "10 Aug 2026",
      time: "6:30–7:30 AM",
      duration: "1h",
      status: "Upcoming",
      students: 42,
      attendanceState: "Not started",
      startAvailable: false,
      canStart: false,
      canFinalizeAttendance: false,
    },
    {
      id: "session-next-3",
      title: "Arc and Point Elasticity",
      course: "BBS First Year Microeconomics",
      batch: "Evening Batch · 2083",
      teacher: "Aarav Sharma",
      date: "10 Aug 2026",
      time: "7:00–8:15 PM",
      duration: "1h 15m",
      status: "Upcoming",
      students: 64,
      attendanceState: "Not started",
      startAvailable: false,
      canStart: false,
      canFinalizeAttendance: false,
    },
  ];
}

function mockTeacherDashboard(name: string): TeacherDashboardData {
  const sessions = mockTeacherSessions();
  return {
    greetingName: name,
    nextSession: sessions[0] ?? null,
    metrics: {
      assignedBatches: teacherBatches.length,
      ongoingBatches: teacherBatches.filter((batch) => batch.status === "Ongoing").length,
      upcomingBatches: teacherBatches.filter((batch) => batch.status === "Upcoming").length,
      classesToday: 2,
      attendanceActions: 1,
      activeStudents: teacherBatches.reduce((sum, batch) => sum + batch.students, 0),
    },
    todaySessions: sessions.slice(0, 2),
    followUps: [
      { id: "attendance-1", title: "Finalize attendance", detail: "BBA · 42 students", href: "/teacher/classes/session-complete-1/attendance", type: "attendance" },
      { id: "recording-1", title: "Add completed class recording", detail: "Demand Forecasting Discussion", href: "/teacher/batches/batch-micro-evening-2083/recordings", type: "recording" },
    ],
    batches: teacherBatches,
  };
}

export async function getTeacherDashboard(name: string): Promise<TeacherDashboardData> {
  if (isMockDataEnabled()) return mockTeacherDashboard(name);
  const response = await serverApiFetch<ApiResponse<ApiTeacherDashboard>>("/api/v1/teacher/dashboard");
  return {
    greetingName: name,
    nextSession: response.data.next_session ? mapTeacherSession(response.data.next_session) : null,
    metrics: {
      assignedBatches: response.data.metrics.assigned_batches,
      ongoingBatches: response.data.metrics.ongoing_batches,
      upcomingBatches: response.data.metrics.upcoming_batches,
      classesToday: response.data.metrics.classes_today,
      attendanceActions: response.data.metrics.attendance_actions,
      activeStudents: response.data.metrics.active_students,
    },
    todaySessions: response.data.today_sessions.map(mapTeacherSession),
    followUps: response.data.follow_ups,
    batches: response.data.batches.map(mapTeacherBatch),
  };
}

export async function getTeacherBatches(): Promise<TeacherBatch[]> {
  if (isMockDataEnabled()) return teacherBatches;
  const response = await serverApiFetch<ApiResponse<ApiTeacherBatch[]> | PaginatedResponse<ApiTeacherBatch>>("/api/v1/teacher/batches?per_page=100");
  return response.data.map(mapTeacherBatch);
}

const BATCHES_PER_PAGE = 20;

/**
 * Paginated batch list for the /teacher/batches screen's grid. Kept
 * separate from getTeacherBatches() — that one returns an unpaginated batch
 * and is also used by the announcements batch picker, the new/recurring
 * class batch pickers, and this same page's own metric cards, none of which
 * should be capped to a single page's worth of results.
 *
 * The backend (Teacher\BatchController) has no search or status filter for
 * this endpoint — only pagination — so a typed search term is matched
 * against whatever page is currently on screen, same as before.
 */
export async function getTeacherBatchesPage(params: { page?: number } = {}): Promise<{ items: TeacherBatch[]; meta: PageMeta }> {
  const page = params.page && params.page > 0 ? params.page : 1;

  if (isMockDataEnabled()) {
    const total = teacherBatches.length;
    const lastPage = Math.max(1, Math.ceil(total / BATCHES_PER_PAGE));
    const currentPage = Math.min(page, lastPage);
    const start = (currentPage - 1) * BATCHES_PER_PAGE;
    const items = teacherBatches.slice(start, start + BATCHES_PER_PAGE);
    return { items, meta: { currentPage, lastPage, total, from: total ? start + 1 : null, to: total ? start + items.length : null } };
  }

  const query = new URLSearchParams({ per_page: String(BATCHES_PER_PAGE), page: String(page) });
  const response = await serverApiFetch<PaginatedResponse<ApiTeacherBatch>>(`/api/v1/teacher/batches?${query.toString()}`);
  return { items: response.data.map(mapTeacherBatch), meta: pageMetaFrom(response.meta) };
}

export async function getTeacherBatch(batchId: string): Promise<TeacherBatchDetail | null> {
  if (isMockDataEnabled()) {
    const batch = teacherBatches.find((item) => item.id === batchId);
    if (!batch) return null;
    return {
      batch,
      students: staffStudents.slice(0, Math.min(5, staffStudents.length)),
      counts: { classes: 24, attendancePercent: 88, recordings: 18, tests: 6, resources: 12, announcements: 3 },
    };
  }
  try {
    const response = await serverApiFetch<ApiResponse<ApiTeacherBatchDetail>>(`/api/v1/teacher/batches/${encodeURIComponent(batchId)}`);
    return {
      batch: mapTeacherBatch(response.data.batch),
      students: response.data.students.map((student) => ({
        id: student.student_code || student.id,
        name: student.name,
        phone: student.mobile || "Not provided",
        email: student.email,
        course: response.data.batch.course_title,
        status: titleCase(student.status),
        joined: formatDate(student.joined_at),
      })),
      counts: {
        classes: response.data.counts.classes,
        attendancePercent: response.data.counts.attendance_percent,
        recordings: response.data.counts.recordings,
        tests: response.data.counts.tests,
        resources: response.data.counts.resources,
        announcements: response.data.counts.announcements,
      },
    };
  } catch (error) {
    if (isServerApiError(error) && error.status === 404) return null;
    throw error;
  }
}

export async function getTeacherBatchRecordings(batchId: string): Promise<Recording[]> {
  if (isMockDataEnabled()) return (recordings as unknown as Recording[]).map((item) => ({ ...item, batch: teacherBatches.find((batch) => batch.id === batchId)?.batch }));
  const response = await serverApiFetch<ApiResponse<ApiRecording[]> | PaginatedResponse<ApiRecording>>(`/api/v1/teacher/batches/${encodeURIComponent(batchId)}/recordings`);
  return response.data.map(mapRecording);
}

export type TeacherSessionOption = { id: string; label: string };

/** For the "related session" picker on the recording form — not the full session detail. */
export async function getTeacherBatchSessionOptions(batchId: string): Promise<TeacherSessionOption[]> {
  if (isMockDataEnabled()) return mockTeacherSessions()
    .slice(0, 8)
    .map((session) => ({ id: session.id, label: `${session.title} · ${session.date}` }));

  const response = await serverApiFetch<ApiResponse<Array<{ id: string; title: string; starts_at: string }>> | PaginatedResponse<{ id: string; title: string; starts_at: string }>>(
    `/api/v1/teacher/classes?batch_id=${encodeURIComponent(batchId)}&per_page=100`,
  );

  return response.data.map((session) => ({
    id: session.id,
    label: `${session.title} · ${formatDate(session.starts_at)}`,
  }));
}

export type SyllabusLessonOption = { id: string; title: string; type: string };
export type SyllabusOutlineModule = { id: string; title: string; lessons: SyllabusLessonOption[] };

/** For the "which lesson is this for" picker on the recording and resource upload forms. */
export async function getBatchSyllabusOutline(batchId: string): Promise<SyllabusOutlineModule[]> {
  if (isMockDataEnabled()) return syllabusModules.map((module) => ({
    id: module.id,
    title: module.title,
    lessons: module.lessons.map((lesson, index) => ({ id: `${module.id}-lesson-${index}`, title: lesson.title, type: lesson.type })),
  }));

  const response = await serverApiFetch<ApiResponse<SyllabusOutlineModule[]>>(`/api/v1/teacher/batches/${encodeURIComponent(batchId)}/syllabus-modules`);
  return response.data;
}

const ANNOUNCEMENTS_PER_PAGE = 20;

/**
 * Paginated announcement feed for the /teacher/announcements screen — the
 * only consumer of this data, so it is safe to convert in place rather than
 * adding a parallel xxxPage() function. The backend has no filter for this
 * endpoint beyond pagination.
 */
export async function getTeacherAnnouncements(params: { page?: number } = {}): Promise<{ items: Announcement[]; meta: PageMeta }> {
  const page = params.page && params.page > 0 ? params.page : 1;

  if (isMockDataEnabled()) {
    const total = announcements.length;
    const lastPage = Math.max(1, Math.ceil(total / ANNOUNCEMENTS_PER_PAGE));
    const currentPage = Math.min(page, lastPage);
    const start = (currentPage - 1) * ANNOUNCEMENTS_PER_PAGE;
    const items = announcements.slice(start, start + ANNOUNCEMENTS_PER_PAGE);
    return { items, meta: { currentPage, lastPage, total, from: total ? start + 1 : null, to: total ? start + items.length : null } };
  }

  const query = new URLSearchParams({ per_page: String(ANNOUNCEMENTS_PER_PAGE), page: String(page) });
  const response = await serverApiFetch<PaginatedResponse<ApiAnnouncement>>(`/api/v1/teacher/announcements?${query.toString()}`);
  return { items: response.data.map(mapAnnouncement), meta: pageMetaFrom(response.meta) };
}

const CLASSES_PER_PAGE = 50;

/**
 * Paginated class schedule for the /teacher/classes screen — the only
 * consumer of this data, so it is safe to convert in place.
 *
 * The backend (Teacher\ClassSessionController) has no `date` filter; it only
 * understands `from`/`to`, `batch_id` and `status`. The previous
 * implementation sent a `date` param the controller silently ignored, so the
 * day-navigation arrows never actually scoped anything server-side — this
 * now sends the selected day as a from/to window instead, which the
 * controller does understand.
 */
export async function getTeacherClasses(params: { date?: string; page?: number } = {}): Promise<{ items: TeacherSession[]; meta: PageMeta }> {
  const page = params.page && params.page > 0 ? params.page : 1;

  if (isMockDataEnabled()) {
    const all = mockTeacherSessions();
    const total = all.length;
    const lastPage = Math.max(1, Math.ceil(total / CLASSES_PER_PAGE));
    const currentPage = Math.min(page, lastPage);
    const start = (currentPage - 1) * CLASSES_PER_PAGE;
    const items = all.slice(start, start + CLASSES_PER_PAGE);
    return { items, meta: { currentPage, lastPage, total, from: total ? start + 1 : null, to: total ? start + items.length : null } };
  }

  const query = new URLSearchParams({ per_page: String(CLASSES_PER_PAGE), page: String(page) });
  if (params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
    query.set("from", `${params.date}T00:00:00`);
    query.set("to", `${params.date}T23:59:59`);
  }
  const response = await serverApiFetch<PaginatedResponse<ApiTeacherSession>>(`/api/v1/teacher/classes?${query.toString()}`);
  return { items: response.data.map(mapTeacherSession), meta: pageMetaFrom(response.meta) };
}

export async function getTeacherClass(sessionId: string): Promise<TeacherSession | null> {
  if (isMockDataEnabled()) return mockTeacherSessions().find((session) => session.id === sessionId) ?? null;
  try {
    const response = await serverApiFetch<ApiResponse<ApiTeacherSession>>(`/api/v1/teacher/classes/${encodeURIComponent(sessionId)}`);
    return mapTeacherSession(response.data);
  } catch (error) {
    if (isServerApiError(error) && error.status === 404) return null;
    throw error;
  }
}

export async function getTeacherAttendanceOverview(): Promise<{ sessions: TeacherAttendanceSession[]; metrics: { awaiting: number; finalizedThisWeek: number; assignedStudents: number } }> {
  if (isMockDataEnabled()) {
    return {
      sessions: [
        { id: "session-complete-1", title: "Demand Forecasting Discussion", batch: "BBA Business Economics", date: "Today · 6:30 AM", students: 42, status: "Awaiting finalization" },
        { id: "session-live-1", title: "Elasticity of Demand", batch: "BBS Microeconomics", date: "Today · 7:00 PM", students: 64, status: "Live now" },
        { id: "session-old-1", title: "Income and Cross Elasticity", batch: "BBS Microeconomics", date: "5 Aug · 7:00 PM", students: 64, status: "Finalized" },
      ],
      metrics: { awaiting: 1, finalizedThisWeek: 8, assignedStudents: 124 },
    };
  }
  const response = await serverApiFetch<ApiResponse<{ sessions: ApiTeacherAttendanceSession[]; metrics: { awaiting: number; finalized_this_week: number; assigned_students: number } }>>("/api/v1/teacher/attendance");
  return {
    sessions: response.data.sessions.map((session) => ({
      id: session.id,
      title: session.title,
      batch: session.batch_title,
      date: formatDateTime(session.starts_at),
      students: session.students_count,
      status: titleCase(session.status),
    })),
    metrics: {
      awaiting: response.data.metrics.awaiting,
      finalizedThisWeek: response.data.metrics.finalized_this_week,
      assignedStudents: response.data.metrics.assigned_students,
    },
  };
}

export async function getTeacherAttendanceDetail(sessionId: string): Promise<TeacherAttendanceDetail | null> {
  if (isMockDataEnabled()) {
    const session = mockTeacherSessions().find((item) => item.id === sessionId) ?? mockTeacherSessions()[1];
    if (!session) return null;
    return {
      session,
      summary: { enrolled: 42, matched: 38, unmatched: 3, needsReview: 1, finalized: sessionId.includes("old") },
      rows: [
        { id: "STD-2083-1001", name: "Riya Thapa", participantName: "Riya T.", duration: "68 min", confidence: "High", status: "Present" },
        { id: "STD-2083-1002", name: "Suman Rai", participantName: "Suman Rai", duration: "51 min", confidence: "High", status: "Late" },
        { id: "STD-2083-1003", name: "Anisha K.C.", participantName: "Anisha KC", duration: "72 min", confidence: "Medium", status: "Present" },
        { id: "STD-2083-1004", name: "Prabin Sah", participantName: "No match", duration: "—", confidence: "Unmatched", status: "Absent" },
        { id: "STD-2083-1005", name: "Nima Sherpa", participantName: "Nima S", duration: "20 min", confidence: "Low", status: "Review" },
      ],
    };
  }
  try {
    const response = await serverApiFetch<ApiResponse<ApiTeacherAttendanceDetail>>(`/api/v1/teacher/classes/${encodeURIComponent(sessionId)}/attendance`);
    return {
      session: mapTeacherSession(response.data.session),
      summary: {
        enrolled: response.data.summary.enrolled,
        matched: response.data.summary.matched,
        unmatched: response.data.summary.unmatched,
        needsReview: response.data.summary.needs_review,
        finalized: response.data.summary.finalized,
      },
      rows: response.data.participants.map((participant) => ({
        id: participant.student_id,
        name: participant.student_name,
        participantName: participant.participant_name || "No match",
        duration: formatDuration(participant.duration_seconds),
        confidence: titleCase(participant.match_confidence),
        status: titleCase(participant.attendance_status),
        overrideReason: participant.override_reason,
      })),
    };
  } catch (error) {
    if (isServerApiError(error) && error.status === 404) return null;
    throw error;
  }
}

export async function getTeacherTests(batchId: string): Promise<TeacherTestRecord[]> {
  if (isMockDataEnabled()) {
    return [
      { id: "test-elasticity-01", title: "Elasticity Practice Test", availability: "9–12 Aug", duration: "25 min", attempts: "1 of 2", status: "Published" },
      { id: "test-demand-01", title: "Demand and Supply Quiz", availability: "Completed 3 Aug", duration: "20 min", attempts: "64 submitted", status: "Completed" },
      { id: "test-equilibrium-draft", title: "Market Equilibrium Quiz", availability: "Not scheduled", duration: "20 min", attempts: "—", status: "Draft" },
    ];
  }
  const response = await serverApiFetch<ApiResponse<ApiTeacherTestRecord[]> | PaginatedResponse<ApiTeacherTestRecord>>(`/api/v1/teacher/batches/${encodeURIComponent(batchId)}/tests`);
  return response.data.map((test) => ({
    id: test.id,
    title: test.title,
    availability: test.opens_at && test.closes_at ? `${formatDateTime(test.opens_at)} – ${formatDateTime(test.closes_at)}` : "Not scheduled",
    duration: `${test.duration_minutes} min`,
    attempts: test.submissions_count != null ? `${test.submissions_count} submitted` : `${test.attempts_allowed ?? 1} attempt${(test.attempts_allowed ?? 1) === 1 ? "" : "s"}`,
    status: titleCase(test.status),
  }));
}

export async function getTeacherContentSummary(): Promise<TeacherContentSummary> {
  if (isMockDataEnabled()) {
    return {
      metrics: { recordings: 31, resources: 22, tests: 9, announcements: 7 },
      recent: [
        { id: "rec-price-elasticity", title: "Price Elasticity of Demand", detail: "Recording · Microeconomics", status: "Published", type: "recording" },
        { id: "res-elasticity-formula", title: "Elasticity formula sheet", detail: "PDF resource · Microeconomics", status: "Published", type: "resource" },
        { id: "test-equilibrium-draft", title: "Market Equilibrium Quiz", detail: "Test · Microeconomics", status: "Draft", type: "test" },
      ],
      batches: teacherBatches,
    };
  }
  const response = await serverApiFetch<ApiResponse<ApiTeacherContentSummary>>("/api/v1/teacher/content-summary");
  return {
    metrics: response.data.metrics,
    recent: response.data.recent,
    batches: response.data.batches.map(mapTeacherBatch),
  };
}

export function getMockTeacherLiveSessionCompatibility(): typeof liveSessions {
  return liveSessions;
}

export function getMockTeacherTestsCompatibility(): typeof studentTests {
  return studentTests;
}

export type TeacherResourceRow = {
  id: string;
  title: string;
  moduleTitle: string | null;
  fileType: string | null;
  sizeBytes: number | null;
  released: boolean;
  releasedAt: string | null;
  downloadCount: number;
};

type ApiTeacherResource = {
  id: string;
  title: string;
  module_title?: string | null;
  file_type?: string | null;
  size_bytes?: number | null;
  released: boolean;
  released_at?: string | null;
  download_count: number;
};

/**
 * Batch resources from the teacher's side, which unlike the student list
 * includes staged items that have not been released yet.
 */
export async function getBatchResources(batchId: string): Promise<TeacherResourceRow[]> {
  if (isMockDataEnabled()) {
    return [
      { id: "res-1", title: "Chapter 3 notes", moduleTitle: "Elasticity", fileType: "PDF", sizeBytes: 482000, released: true, releasedAt: new Date().toISOString(), downloadCount: 12 },
    ];
  }

  const response = await serverApiFetch<ApiResponse<ApiTeacherResource[]>>(
    `/api/v1/teacher/batches/${encodeURIComponent(batchId)}/resources`,
  );

  return response.data.map((item) => ({
    id: item.id,
    title: item.title,
    moduleTitle: item.module_title ?? null,
    fileType: item.file_type ?? null,
    sizeBytes: item.size_bytes ?? null,
    released: item.released,
    releasedAt: item.released_at ?? null,
    downloadCount: item.download_count,
  }));
}
