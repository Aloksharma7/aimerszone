import { api } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/contracts";
import type { ApiAttempt, ApiAttemptResult, ApiTestLaunch } from "@/lib/data/api-dtos";
import type { Attempt, AttemptResult, TestLaunch } from "@/types/lms";

function mapAttempt(value: ApiAttempt): Attempt {
  return {
    id: value.id,
    testId: value.test_id,
    title: value.title,
    courseTitle: value.course_title,
    totalMarks: value.total_marks,
    durationSeconds: value.duration_seconds,
    expiresAt: value.expires_at,
    serverNow: value.server_now,
    attemptNumber: value.attempt_number,
    attemptsAllowed: value.attempts_allowed,
    questions: value.questions.map((question) => ({
      id: question.id,
      order: question.order,
      type: question.type,
      prompt: question.prompt,
      marks: question.marks,
      options: question.options,
      response: question.response,
      responses: question.responses,
      flagged: question.flagged,
    })),
  };
}

export async function fetchTestLaunch(testId: string): Promise<TestLaunch> {
  const response = await api.get<ApiResponse<ApiTestLaunch>>(`/api/v1/student/tests/${testId}/launch`);
  const data = response.data;
  return {
    id: data.id,
    title: data.title,
    courseTitle: data.course_title,
    totalMarks: data.total_marks,
    durationSeconds: data.duration_seconds,
    attemptsUsed: data.attempts_used,
    attemptsAllowed: data.attempts_allowed,
    canStart: data.can_start,
    reason: data.reason,
  };
}

export async function startAttempt(testId: string): Promise<Attempt> {
  const response = await api.post<ApiResponse<ApiAttempt>>(`/api/v1/student/tests/${testId}/attempts`);
  return mapAttempt(response.data);
}

export type AttemptAnswer = { questionId: string; response: string[] | null };

export async function saveAttemptResponses(attemptId: string, answers: AttemptAnswer[], flaggedQuestionIds: string[]): Promise<{ secondsRemaining: number }> {
  const response = await api.patch<ApiResponse<{ saved_at: string; seconds_remaining: number }>>(`/api/v1/student/attempts/${attemptId}/responses`, {
    answers: answers.map((answer) => ({ question_id: answer.questionId, response: answer.response })),
    flagged_question_ids: flaggedQuestionIds,
  });
  return { secondsRemaining: response.data.seconds_remaining };
}

export async function submitAttempt(attemptId: string, automatic = false): Promise<{ attemptId: string }> {
  const response = await api.post<ApiResponse<{ attempt_id: string; result_path: string }>>(`/api/v1/student/attempts/${attemptId}/submit`, { automatic });
  return { attemptId: response.data.attempt_id };
}

export async function fetchAttemptResult(attemptId: string): Promise<AttemptResult> {
  const response = await api.get<ApiResponse<ApiAttemptResult>>(`/api/v1/student/attempts/${attemptId}/result`);
  const data = response.data;
  return {
    id: data.id,
    title: data.title,
    courseTitle: data.course_title,
    releaseState: data.release_state,
    score: data.score,
    totalMarks: data.total_marks,
    passMarks: data.pass_marks,
    correct: data.correct,
    incorrect: data.incorrect,
    unanswered: data.unanswered,
    timeUsedSeconds: data.time_used_seconds,
    attemptsRemaining: data.attempts_remaining,
    reattemptTestId: data.reattempt_test_id,
  };
}
