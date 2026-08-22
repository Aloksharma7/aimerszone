import { resolveAssetUrl } from "@/lib/api/assets";
import { api } from "@/lib/api/client";
import type { ApiResponse, PaginatedResponse } from "@/lib/api/contracts";
import { mapAnnouncement } from "@/lib/data/adapters";
import { formatDuration, formatFileSize } from "@/lib/data/format";
import type {
  ApiAnnouncement,
  ApiAttendanceDetail,
  ApiAttendanceOverview,
  ApiTeacherBatch,
  ApiTeacherBatchDetail,
  ApiTeacherDashboard,
  ApiTeacherRecording,
  ApiTeacherResource,
  ApiTeacherSession,
  ApiTeacherTestSummary,
  ApiTestResults,
} from "@/lib/data/api-dtos";
import {
  mapAttendanceDetail,
  mapAttendanceOverview,
  mapTeacherBatch,
  mapTeacherBatchDetail,
  mapTeacherDashboard,
  mapTeacherSession,
} from "@/lib/data/teacher-adapters";
import type {
  AttendanceDetail,
  AttendanceOverview,
  AttendanceStatus,
  DashboardAnnouncement,
  TeacherBatchDetail,
  TeacherBatchSummary,
  TeacherDashboard,
  TeacherRecording,
  TeacherResource,
  TeacherSession,
  TeacherTestSummary,
  TestResults,
} from "@/types/lms";

export async function fetchTeacherDashboard(): Promise<TeacherDashboard> {
  const response = await api.get<ApiResponse<ApiTeacherDashboard>>("/api/v1/teacher/dashboard");
  return mapTeacherDashboard(response.data);
}

export async function fetchTeacherBatches(): Promise<TeacherBatchSummary[]> {
  const response = await api.get<PaginatedResponse<ApiTeacherBatch>>("/api/v1/teacher/batches?per_page=100");
  return response.data.map(mapTeacherBatch);
}

export async function fetchTeacherBatchDetail(batchId: string): Promise<TeacherBatchDetail> {
  const response = await api.get<ApiResponse<ApiTeacherBatchDetail>>(`/api/v1/teacher/batches/${batchId}`);
  return mapTeacherBatchDetail(response.data);
}

export type ClassesPage = { items: TeacherSession[]; nextPage: number | null };

export async function fetchTeacherClassesPage(page: number): Promise<ClassesPage> {
  const response = await api.get<PaginatedResponse<ApiTeacherSession>>(`/api/v1/teacher/classes?page=${page}`);
  return {
    items: response.data.map(mapTeacherSession),
    nextPage: response.meta.current_page < response.meta.last_page ? response.meta.current_page + 1 : null,
  };
}

export async function startClassSession(sessionId: string): Promise<{ redirectUrl: string; studentsNotified: number }> {
  const response = await api.post<ApiResponse<{ redirect_url: string; students_notified: number }>>(`/api/v1/teacher/classes/${sessionId}/start`);
  return { redirectUrl: response.data.redirect_url, studentsNotified: response.data.students_notified };
}

export async function fetchAttendanceOverview(): Promise<AttendanceOverview> {
  const response = await api.get<ApiResponse<ApiAttendanceOverview>>("/api/v1/teacher/attendance");
  return mapAttendanceOverview(response.data);
}

export async function fetchAttendanceDetail(sessionId: string): Promise<AttendanceDetail> {
  const response = await api.get<ApiResponse<ApiAttendanceDetail>>(`/api/v1/teacher/classes/${sessionId}/attendance`);
  return mapAttendanceDetail(response.data);
}

type AttendanceUpdate = { studentId: string; status: AttendanceStatus }[];

function toParticipantsPayload(updates: AttendanceUpdate) {
  return { participants: updates.map((item) => ({ student_id: item.studentId, attendance_status: item.status })) };
}

export async function saveAttendance(sessionId: string, updates: AttendanceUpdate): Promise<void> {
  await api.put(`/api/v1/teacher/classes/${sessionId}/attendance`, toParticipantsPayload(updates));
}

export async function finalizeAttendance(sessionId: string, updates: AttendanceUpdate): Promise<void> {
  await api.post(`/api/v1/teacher/classes/${sessionId}/attendance/finalize`, toParticipantsPayload(updates));
}

export type TeacherAnnouncementsPage = { items: DashboardAnnouncement[]; nextPage: number | null };

export async function fetchTeacherAnnouncementsPage(page: number): Promise<TeacherAnnouncementsPage> {
  const response = await api.get<PaginatedResponse<ApiAnnouncement>>(`/api/v1/teacher/announcements?page=${page}`);
  return {
    items: response.data.map(mapAnnouncement),
    nextPage: response.meta.current_page < response.meta.last_page ? response.meta.current_page + 1 : null,
  };
}

export async function postTeacherAnnouncement(input: { batchId: string; title: string; body: string; pinned?: boolean }): Promise<{ id: string }> {
  const response = await api.post<ApiResponse<{ id: string }>>("/api/v1/teacher/announcements", {
    batch_id: input.batchId,
    title: input.title,
    body: input.body,
    pinned: input.pinned ?? false,
  });
  return response.data;
}

export type NewClassInput = { batchId: string; title: string; startsAt: string; endsAt: string; instructions?: string };

export async function createTeacherClass(input: NewClassInput): Promise<{ id: string }> {
  const response = await api.post<ApiResponse<{ id: string }>>("/api/v1/teacher/classes", {
    batch_id: input.batchId,
    title: input.title,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    instructions: input.instructions || undefined,
  });
  return response.data;
}

export type RecurringClassInput = {
  batchId: string;
  title: string;
  instructions?: string;
  startDate: string;
  endDate: string;
  startTime: string;
  durationMinutes: number;
  frequency: "daily" | "weekly";
  days?: number[];
};

export type RecurringClassResult = { created: number; skippedPast: number; firstAt: string; lastAt: string };

export async function createRecurringTeacherClasses(input: RecurringClassInput): Promise<RecurringClassResult> {
  const response = await api.post<ApiResponse<{ created: number; skipped_past: number; first_at: string; last_at: string }>>(
    "/api/v1/teacher/classes/recurring",
    {
      batch_id: input.batchId,
      title: input.title,
      instructions: input.instructions || undefined,
      start_date: input.startDate,
      end_date: input.endDate,
      start_time: input.startTime,
      duration_minutes: input.durationMinutes,
      frequency: input.frequency,
      days: input.frequency === "weekly" ? input.days : undefined,
    },
  );
  return { created: response.data.created, skippedPast: response.data.skipped_past, firstAt: response.data.first_at, lastAt: response.data.last_at };
}

function mapTeacherRecording(value: ApiTeacherRecording): TeacherRecording {
  return {
    id: value.id,
    title: value.title,
    moduleTitle: value.module_title,
    thumbnailUrl: resolveAssetUrl(value.thumbnail_url),
    duration: formatDuration(value.duration_seconds),
    state: value.state,
    released: value.released_at !== null,
  };
}

export async function fetchTeacherRecordings(batchId: string): Promise<TeacherRecording[]> {
  const response = await api.get<ApiResponse<ApiTeacherRecording[]>>(`/api/v1/teacher/batches/${batchId}/recordings`);
  return response.data.map(mapTeacherRecording);
}

export type NewRecordingInput = { batchId: string; title: string; youtubeVideoId: string; moduleTitle?: string; releaseNow: boolean };

export async function createTeacherRecording(input: NewRecordingInput): Promise<{ id: string; state: string; warning: string | null }> {
  const response = await api.post<ApiResponse<{ id: string; state: string; warning: string | null }>>(`/api/v1/teacher/batches/${input.batchId}/recordings`, {
    title: input.title,
    youtube_video_id: input.youtubeVideoId,
    module_title: input.moduleTitle || undefined,
    release_at: input.releaseNow ? new Date().toISOString() : undefined,
  });
  return response.data;
}

function mapTeacherResource(value: ApiTeacherResource): TeacherResource {
  return {
    id: value.id,
    title: value.title,
    moduleTitle: value.module_title,
    fileType: value.file_type,
    size: formatFileSize(value.size_bytes),
    released: value.released,
    downloadCount: value.download_count,
    isPublic: value.is_public,
  };
}

export async function fetchTeacherResources(batchId: string): Promise<TeacherResource[]> {
  const response = await api.get<ApiResponse<ApiTeacherResource[]>>(`/api/v1/teacher/batches/${batchId}/resources`);
  return response.data.map(mapTeacherResource);
}

export type NewResourceInput = { batchId: string; title: string; moduleTitle?: string; releaseNow: boolean; file: { uri: string; name: string; type: string } };

export async function uploadTeacherResource(input: NewResourceInput): Promise<{ id: string; released: boolean }> {
  const form = new FormData();
  form.append("title", input.title);
  if (input.moduleTitle) form.append("module_title", input.moduleTitle);
  form.append("release_now", input.releaseNow ? "1" : "0");
  form.append("file", input.file as unknown as Blob);

  const response = await api.post<ApiResponse<{ id: string; released: boolean }>>(`/api/v1/teacher/batches/${input.batchId}/resources`, form);
  return response.data;
}

function mapTeacherTestSummary(value: ApiTeacherTestSummary): TeacherTestSummary {
  return {
    id: value.id,
    title: value.title,
    durationMinutes: value.duration_minutes,
    submissionsCount: value.submissions_count,
    attemptsAllowed: value.attempts_allowed,
    status: value.status,
  };
}

export async function fetchTeacherTestsForBatch(batchId: string): Promise<TeacherTestSummary[]> {
  const response = await api.get<ApiResponse<ApiTeacherTestSummary[]>>(`/api/v1/teacher/batches/${batchId}/tests`);
  return response.data.map(mapTeacherTestSummary);
}

export async function fetchTeacherTestResults(testId: string): Promise<TestResults> {
  const response = await api.get<ApiResponse<ApiTestResults>>(`/api/v1/teacher/tests/${testId}/results`);
  const data = response.data;
  return {
    test: { id: data.test.id, title: data.test.title, totalMarks: data.test.total_marks, passMark: data.test.pass_mark },
    metrics: {
      submissions: data.metrics.submissions,
      graded: data.metrics.graded,
      passed: data.metrics.passed,
      averageScore: data.metrics.average_score,
    },
    attempts: data.attempts.map((attempt) => ({
      id: attempt.id,
      studentName: attempt.student_name,
      studentCode: attempt.student_code,
      attemptNumber: attempt.attempt_number,
      status: attempt.status,
      score: attempt.score,
      maxScore: attempt.max_score,
      passed: attempt.passed,
      submittedAt: attempt.submitted_at,
      autoSubmitted: attempt.auto_submitted,
    })),
  };
}

export type NewTestInput = {
  batchId: string;
  title: string;
  durationMinutes: number;
  attemptsAllowed: number;
  passMark: number;
  questions: {
    type: "single" | "multiple" | "true_false" | "short_text";
    prompt: string;
    marks: number;
    options?: { label: string; isCorrect: boolean }[];
    acceptedAnswers?: string[];
  }[];
  publish: boolean;
};

export async function createTeacherTest(input: NewTestInput): Promise<{ id: string }> {
  const response = await api.post<ApiResponse<{ id: string }>>("/api/v1/teacher/tests", {
    batch_id: input.batchId,
    title: input.title,
    duration_minutes: input.durationMinutes,
    attempts_allowed: input.attemptsAllowed,
    pass_mark: input.passMark,
    questions: input.questions.map((question) => ({
      type: question.type,
      prompt: question.prompt,
      marks: question.marks,
      options: question.options?.map((option) => ({ label: option.label, is_correct: option.isCorrect })),
      accepted_answers: question.acceptedAnswers,
    })),
  });

  if (input.publish) {
    await api.post(`/api/v1/teacher/tests/${response.data.id}/publish`, { publish: true });
  }

  return response.data;
}
