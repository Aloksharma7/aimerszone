import "server-only";

import type { ApiResponse } from "@/lib/api/contracts";
import { isServerApiError, serverApiFetch } from "@/lib/api/server-client";
import { isMockDataEnabled } from "@/lib/data/config";
import { formatDateTime } from "@/lib/data/format";
import type { AttemptResult, QuestionType, StudentTestLaunch, TeacherTestBuilderData } from "@/lib/data/assessment-shared";

// Re-exported for existing importers of this module; the types themselves
// live in assessment-shared.ts so client components can use them without
// pulling in this file's "server-only" import.
export type {
  AttemptQuestion,
  AttemptResult,
  QuestionType,
  StudentAttempt,
  StudentAttemptApiPayload,
  StudentTestLaunch,
  TeacherQuestionOption,
  TeacherTestBuilderData,
  TeacherTestQuestion,
} from "@/lib/data/assessment-shared";
export { isChoiceQuestion, mapStudentAttempt, mockStudentAttempt, questionTypeLabels } from "@/lib/data/assessment-shared";

type ApiTeacherTestBuilder = {
  id?: string | null;
  status: "draft" | "published" | "closed";
  batch_id?: string | null;
  title?: string | null;
  opens_at?: string | null;
  closes_at?: string | null;
  duration_minutes?: number | null;

  // Field names are the API's. The frontend previously invented pass_marks,
  // randomize_options and negative_marks, which the API silently ignored, so
  // pass mark and negative marking never persisted.
  pass_mark?: number | null;
  attempts_allowed?: number | null;
  result_release?: TeacherTestBuilderData["resultRelease"] | null;
  shuffle_options?: boolean | null;
  negative_marking?: number | null;
  has_attempts?: boolean | null;
  can_publish?: boolean | null;
  questions?: Array<{
    id: string;
    type: QuestionType;
    prompt: string;
    marks: number;
    options?: Array<{ id: string; label: string; is_correct: boolean }>;
    accepted_answers?: string[];
  }>;
  batches?: Array<{ id: string; course_title: string; batch_title: string }>;
};

type ApiStudentTestLaunch = {
  id: string;
  title: string;
  course_title: string;
  total_marks: number;
  duration_seconds: number;
  attempts_used: number;
  attempts_allowed: number;
  status: string;
  can_start: boolean;
  reason?: string | null;
};

type ApiAttemptResult = {
  id: string;
  title: string;
  course_title: string;
  submitted_at: string;
  release_state: AttemptResult["releaseState"];
  score?: number | null;
  total_marks: number;
  pass_marks: number;
  correct?: number | null;
  incorrect?: number | null;
  unanswered?: number | null;
  time_used_seconds?: number | null;
  attempts_remaining: number;
  reattempt_test_id?: string | null;
  topic_performance?: Array<{ label: string; percent: number }>;
};

function localInputDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kathmandu",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function mockBuilder(testId?: string | null, batchId?: string | null): TeacherTestBuilderData {
  const editing = Boolean(testId);
  return {
    id: editing ? testId || "test-elasticity-01" : null,
    status: editing ? "published" : "draft",
    batchId: batchId || "batch-micro-evening-2083",
    title: editing ? "Elasticity Practice Test" : "",
    opensAt: editing ? "2026-08-09T19:00" : "",
    closesAt: editing ? "2026-08-12T21:00" : "",
    durationMinutes: 25,
    passMarks: 10,
    attemptsAllowed: 2,
    resultRelease: "immediate",
    randomizeOptions: true,
    negativeMarks: 0,
    hasAttempts: false,
    canPublish: true,
    batches: [
      { id: "batch-micro-evening-2083", label: "BBS First Year Microeconomics · Evening Batch" },
      { id: "batch-bba-morning-2083", label: "BBA Business Economics · Morning Batch" },
      { id: "batch-cmat-weekend", label: "CMAT Foundation · Weekend Batch" },
    ],
    questions: editing ? [
      {
        id: "q-1",
        type: "single",
        prompt: "When quantity changes proportionately more than price, demand is:",
        marks: 5,
        acceptedAnswers: [],
        options: [
          { id: "q1-a", text: "Perfectly inelastic", correct: false },
          { id: "q1-b", text: "Elastic", correct: true },
          { id: "q1-c", text: "Unitary elastic", correct: false },
          { id: "q1-d", text: "Inelastic", correct: false },
        ],
      },
      {
        id: "q-2",
        type: "multiple",
        prompt: "A movement along the same demand curve is caused by:",
        marks: 5,
        acceptedAnswers: [],
        options: [
          { id: "q2-a", text: "Consumer income", correct: false },
          { id: "q2-b", text: "Price of the commodity", correct: true },
          { id: "q2-c", text: "Taste and preference", correct: false },
          { id: "q2-d", text: "Price of related goods", correct: false },
        ],
      },
      {
        id: "q-3",
        type: "short_text",
        prompt: "Name the method that uses the average of initial and final values.",
        marks: 5,
        acceptedAnswers: ["Arc method", "Arc elasticity method"],
        options: [],
      },
    ] : [],
  };
}

function mapBuilder(value: ApiTeacherTestBuilder): TeacherTestBuilderData {
  // `batches` is defensive on purpose: it was absent from the builder response
  // and the unguarded .map() threw before the edit screen could render.
  const batches = value.batches ?? [];

  return {
    id: value.id || null,
    status: value.status || "draft",
    batchId: value.batch_id || batches[0]?.id || "",
    title: value.title || "",
    opensAt: localInputDate(value.opens_at),
    closesAt: localInputDate(value.closes_at),
    durationMinutes: value.duration_minutes || 25,
    passMarks: value.pass_mark ?? 1,
    attemptsAllowed: value.attempts_allowed || 1,
    resultRelease: value.result_release || "after_close",
    randomizeOptions: Boolean(value.shuffle_options),
    negativeMarks: value.negative_marking ?? 0,
    hasAttempts: Boolean(value.has_attempts),

    // Absent (new-test context, no batch chosen yet) defaults to allowed —
    // the server re-checks for real once a batch is actually selected.
    canPublish: value.can_publish ?? true,
    questions: (value.questions || []).map((question) => ({
      id: question.id,
      type: question.type,
      prompt: question.prompt,
      marks: question.marks,
      options: (question.options || []).map((option) => ({
        id: option.id,
        text: option.label,
        correct: option.is_correct,
      })),
      acceptedAnswers: question.accepted_answers || [],
    })),
    batches: batches.map((batch) => ({ id: batch.id, label: `${batch.course_title} · ${batch.batch_title}` })),
  };
}

export async function getTeacherTestBuilder(testId?: string | null, batchId?: string | null): Promise<TeacherTestBuilderData | null> {
  if (isMockDataEnabled()) return mockBuilder(testId, batchId);
  const path = testId
    ? `/api/v1/teacher/tests/${encodeURIComponent(testId)}/builder`
    : `/api/v1/teacher/tests/new-context${batchId ? `?batch_id=${encodeURIComponent(batchId)}` : ""}`;
  try {
    const response = await serverApiFetch<ApiResponse<ApiTeacherTestBuilder>>(path);
    return mapBuilder(response.data);
  } catch (error) {
    if (isServerApiError(error) && error.status === 404) return null;
    throw error;
  }
}

export type TeacherTestResults = {
  test: { id: string; title: string; totalMarks: number; passMark: number };
  metrics: { submissions: number; graded: number; passed: number; averageScore: number | null };
  attempts: Array<{
    id: string;
    studentName: string;
    studentCode: string | null;
    attemptNumber: number;
    status: string;
    score: number | null;
    maxScore: number;
    passed: boolean | null;
    submittedAt: string;
    autoSubmitted: boolean;
  }>;
};

type ApiTeacherTestResults = {
  test: { id: string; title: string; total_marks: number; pass_mark: number };
  metrics: { submissions: number; graded: number; passed: number; average_score: number | null };
  attempts: Array<{
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
  }>;
};

/**
 * Teachers could author, publish and see submission counts for a test, but
 * grading never surfaced anywhere on this side — the only place a result
 * ever appeared was the student's own attempt screen.
 */
export async function getTeacherTestResults(testId: string): Promise<TeacherTestResults | null> {
  if (isMockDataEnabled()) {
    return {
      test: { id: testId, title: "Elasticity Practice Test", totalMarks: 20, passMark: 10 },
      metrics: { submissions: 3, graded: 3, passed: 2, averageScore: 14.3 },
      attempts: [
        { id: "attempt-1", studentName: "Sita Rai", studentCode: "STD-2083-1002", attemptNumber: 1, status: "graded", score: 18, maxScore: 20, passed: true, submittedAt: "9 Aug 2026, 8:02 PM", autoSubmitted: false },
        { id: "attempt-2", studentName: "Rohan K.C.", studentCode: "STD-2083-1044", attemptNumber: 1, status: "graded", score: 12, maxScore: 20, passed: true, submittedAt: "9 Aug 2026, 8:10 PM", autoSubmitted: false },
        { id: "attempt-3", studentName: "Nima Sherpa", studentCode: "STD-2083-1098", attemptNumber: 1, status: "graded", score: 8, maxScore: 20, passed: false, submittedAt: "9 Aug 2026, 8:15 PM", autoSubmitted: true },
      ],
    };
  }
  try {
    const response = await serverApiFetch<ApiResponse<ApiTeacherTestResults>>(`/api/v1/teacher/tests/${encodeURIComponent(testId)}/results`);
    return {
      test: { id: response.data.test.id, title: response.data.test.title, totalMarks: response.data.test.total_marks, passMark: response.data.test.pass_mark },
      metrics: { submissions: response.data.metrics.submissions, graded: response.data.metrics.graded, passed: response.data.metrics.passed, averageScore: response.data.metrics.average_score },
      attempts: response.data.attempts.map((attempt) => ({
        id: attempt.id,
        studentName: attempt.student_name,
        studentCode: attempt.student_code,
        attemptNumber: attempt.attempt_number,
        status: attempt.status,
        score: attempt.score,
        maxScore: attempt.max_score,
        passed: attempt.passed,
        submittedAt: formatDateTime(attempt.submitted_at),
        autoSubmitted: attempt.auto_submitted,
      })),
    };
  } catch (error) {
    if (isServerApiError(error) && error.status === 404) return null;
    throw error;
  }
}

export async function getStudentTestLaunch(testId: string): Promise<StudentTestLaunch | null> {
  if (isMockDataEnabled()) return { id: testId, title: "Elasticity Practice Test", course: "BBS First Year Microeconomics", totalMarks: 20, durationSeconds: 1500, attemptsUsed: 0, attemptsAllowed: 2, status: "Available", canStart: true, reason: null };
  try {
    const response = await serverApiFetch<ApiResponse<ApiStudentTestLaunch>>(`/api/v1/student/tests/${encodeURIComponent(testId)}/launch`);
    return {
      id: response.data.id,
      title: response.data.title,
      course: response.data.course_title,
      totalMarks: response.data.total_marks,
      durationSeconds: response.data.duration_seconds,
      attemptsUsed: response.data.attempts_used,
      attemptsAllowed: response.data.attempts_allowed,
      status: response.data.status,
      canStart: response.data.can_start,
      reason: response.data.reason || null,
    };
  } catch (error) {
    if (isServerApiError(error) && error.status === 404) return null;
    throw error;
  }
}

export async function getAttemptResult(attemptId: string): Promise<AttemptResult | null> {
  if (isMockDataEnabled()) return { id: attemptId, title: "Elasticity Practice Test", course: "BBS First Year Microeconomics", submittedAt: "9 Aug 2026, 8:02 PM", releaseState: "released", score: 18, totalMarks: 20, passMarks: 10, correct: 18, incorrect: 2, unanswered: 0, timeUsedSeconds: 1140, attemptsRemaining: 1, reattemptTestId: "test-elasticity-01", topicPerformance: [{ label: "Elasticity concepts", percent: 100 }, { label: "Numerical calculation", percent: 80 }, { label: "Demand curve movement", percent: 90 }] };
  try {
    const response = await serverApiFetch<ApiResponse<ApiAttemptResult>>(`/api/v1/student/attempts/${encodeURIComponent(attemptId)}/result`);
    return {
      id: response.data.id,
      title: response.data.title,
      course: response.data.course_title,
      submittedAt: response.data.submitted_at,
      releaseState: response.data.release_state,
      score: response.data.score ?? null,
      totalMarks: response.data.total_marks,
      passMarks: response.data.pass_marks,
      correct: response.data.correct ?? null,
      incorrect: response.data.incorrect ?? null,
      unanswered: response.data.unanswered ?? null,
      timeUsedSeconds: response.data.time_used_seconds ?? null,
      attemptsRemaining: response.data.attempts_remaining,
      reattemptTestId: response.data.reattempt_test_id || null,
      topicPerformance: response.data.topic_performance || [],
    };
  } catch (error) {
    if (isServerApiError(error) && error.status === 404) return null;
    throw error;
  }
}
