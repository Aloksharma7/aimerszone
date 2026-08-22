import type {
  ApiAttendanceDetail,
  ApiAttendanceOverview,
  ApiAttendanceParticipant,
  ApiFollowUp,
  ApiTeacherBatch,
  ApiTeacherBatchDetail,
  ApiTeacherDashboard,
  ApiTeacherSession,
} from "@/lib/data/api-dtos";
import { formatDate, formatDateTime, formatTimeRange } from "@/lib/data/format";
import type {
  AttendanceDetail,
  AttendanceOverview,
  AttendanceParticipant,
  BatchStudent,
  FollowUp,
  TeacherBatchDetail,
  TeacherBatchSummary,
  TeacherDashboard,
  TeacherSession,
} from "@/types/lms";

export function mapTeacherSession(value: ApiTeacherSession): TeacherSession {
  return {
    id: value.id,
    title: value.title,
    courseTitle: value.course_title,
    batchTitle: value.batch_title,
    date: formatDate(value.starts_at),
    timeRange: formatTimeRange(value.starts_at, value.ends_at),
    status: value.status,
    studentsCount: value.students_count,
    attendanceState: value.attendance_state,
    startAvailable: value.start_available,
    canStart: value.can_start,
    canFinalizeAttendance: value.can_finalize_attendance,
  };
}

export function mapTeacherBatch(value: ApiTeacherBatch): TeacherBatchSummary {
  return {
    id: value.id,
    courseTitle: value.course_title,
    batchTitle: value.batch_title,
    studentsCount: value.students_count,
    scheduleSummary: value.schedule_summary,
    syllabusProgressPercent: value.syllabus_progress_percent,
    nextClassAt: value.next_class_at ? formatDateTime(value.next_class_at) : null,
    nextClassLabel: value.next_class_label,
    status: value.status,
  };
}

function mapFollowUp(value: ApiFollowUp): FollowUp {
  return { id: value.id, title: value.title, detail: value.detail, type: value.type };
}

export function mapTeacherDashboard(value: ApiTeacherDashboard): TeacherDashboard {
  return {
    nextSession: value.next_session ? mapTeacherSession(value.next_session) : null,
    metrics: {
      assignedBatches: value.metrics.assigned_batches,
      ongoingBatches: value.metrics.ongoing_batches,
      upcomingBatches: value.metrics.upcoming_batches,
      classesToday: value.metrics.classes_today,
      attendanceActions: value.metrics.attendance_actions,
      activeStudents: value.metrics.active_students,
    },
    todaySessions: value.today_sessions.map(mapTeacherSession),
    followUps: value.follow_ups.map(mapFollowUp),
    batches: value.batches.map(mapTeacherBatch),
  };
}

function mapBatchStudent(value: ApiTeacherBatchDetail["students"][number]): BatchStudent {
  return {
    id: value.id,
    studentCode: value.student_code,
    name: value.name,
    mobile: value.mobile,
    email: value.email,
    status: value.status,
    joinedAt: value.joined_at ? formatDate(value.joined_at) : null,
  };
}

export function mapTeacherBatchDetail(value: ApiTeacherBatchDetail): TeacherBatchDetail {
  return {
    batch: mapTeacherBatch(value.batch),
    students: value.students.map(mapBatchStudent),
    counts: {
      classes: value.counts.classes,
      attendancePercent: value.counts.attendance_percent,
      recordings: value.counts.recordings,
      tests: value.counts.tests,
      resources: value.counts.resources,
      announcements: value.counts.announcements,
    },
  };
}

export function mapAttendanceOverview(value: ApiAttendanceOverview): AttendanceOverview {
  return {
    sessions: value.sessions.map((session) => ({
      id: session.id,
      title: session.title,
      batchTitle: session.batch_title,
      startsAt: formatDateTime(session.starts_at),
      studentsCount: session.students_count,
      status: session.status,
    })),
    metrics: {
      awaiting: value.metrics.awaiting,
      finalizedThisWeek: value.metrics.finalized_this_week,
      assignedStudents: value.metrics.assigned_students,
    },
  };
}

function mapAttendanceParticipant(value: ApiAttendanceParticipant): AttendanceParticipant {
  return { studentId: value.student_id, studentName: value.student_name, status: value.attendance_status };
}

export function mapAttendanceDetail(value: ApiAttendanceDetail): AttendanceDetail {
  return {
    session: mapTeacherSession(value.session),
    summary: { enrolled: value.summary.enrolled, finalized: value.summary.finalized },
    participants: value.participants.map(mapAttendanceParticipant),
  };
}
