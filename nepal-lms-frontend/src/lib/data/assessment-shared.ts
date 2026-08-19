/*
 * Types and pure helpers shared between server-only data fetching
 * (src/lib/data/assessment.ts) and client components (test-builder.tsx,
 * test-runner.tsx). This file must never import "server-only" or anything
 * that depends on it — a client component cannot import from a module that
 * does, even for values that never touch the server.
 */

/*
 * Question vocabulary is the backend's, not a frontend synonym for it.
 * "multiple_choice" / "short_answer" were rejected by the API on every save,
 * and collapsing four types into two made multi-answer papers unanswerable.
 */
export type QuestionType = "single" | "multiple" | "true_false" | "short_text";

export const questionTypeLabels: Record<QuestionType, string> = {
  single: "Single answer",
  multiple: "Multiple answers",
  true_false: "True / false",
  short_text: "Short answer",
};

export function isChoiceQuestion(type: QuestionType): boolean {
  return type !== "short_text";
}

export type TeacherQuestionOption = { id: string; text: string; correct: boolean };
export type TeacherTestQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  marks: number;
  options: TeacherQuestionOption[];
  acceptedAnswers: string[];
};
export type TeacherTestBuilderData = {
  id: string | null;
  status: "draft" | "published" | "closed";
  batchId: string;
  title: string;
  opensAt: string;
  closesAt: string;
  durationMinutes: number;
  passMarks: number;
  attemptsAllowed: number;
  resultRelease: "immediate" | "after_close" | "manual";
  randomizeOptions: boolean;
  negativeMarks: number;

  /** True once a student has attempted it; the API refuses question edits then. */
  hasAttempts: boolean;

  /** False when the viewer holds tests.manage but is not this batch's assigned teacher — publishing is theirs alone. */
  canPublish: boolean;
  questions: TeacherTestQuestion[];
  batches: Array<{ id: string; label: string }>;
};

export type StudentTestLaunch = {
  id: string;
  title: string;
  course: string;
  totalMarks: number;
  durationSeconds: number;
  attemptsUsed: number;
  attemptsAllowed: number;
  status: string;
  canStart: boolean;
  reason: string | null;
};

export type AttemptQuestion = {
  id: string;
  order: number;
  type: QuestionType;
  prompt: string;
  marks: number;
  options: Array<{ id: string; label: string; text: string }>;

  /** Free text, or the single selected option id. */
  response: string | null;

  /** Every selected option id. Length > 1 only for "multiple". */
  responses: string[];
  flagged: boolean;
};

export type StudentAttempt = {
  id: string;
  testId: string;
  title: string;
  course: string;
  totalMarks: number;
  durationSeconds: number;
  startedAt: string;
  expiresAt: string;
  serverNow: string;
  attemptNumber: number;
  attemptsAllowed: number;
  questions: AttemptQuestion[];
};

export type AttemptResult = {
  id: string;
  title: string;
  course: string;
  submittedAt: string;
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
  topicPerformance: Array<{ label: string; percent: number }>;
};

export type StudentAttemptApiPayload = {
  id: string;
  test_id: string;
  title: string;
  course_title: string;
  total_marks: number;
  duration_seconds: number;
  started_at: string;
  expires_at: string;
  server_now: string;
  attempt_number: number;
  attempts_allowed: number;
  questions: Array<{
    id: string;
    order: number;
    type: QuestionType;
    prompt: string;
    marks: number;
    options?: Array<{ id: string; label: string; text: string }>;
    response?: string | null;
    responses?: string[];
    flagged?: boolean;
  }>;
};

export function mockStudentAttempt(testId: string): StudentAttempt {
  const now = Date.now();
  return {
    id: "attempt-elasticity-01",
    testId,
    title: "Elasticity Practice Test",
    course: "BBS First Year Microeconomics",
    totalMarks: 20,
    durationSeconds: 1500,
    startedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 1500 * 1000).toISOString(),
    serverNow: new Date(now).toISOString(),
    attemptNumber: 1,
    attemptsAllowed: 2,
    questions: [
      { id: "q-1", order: 1, type: "single", prompt: "When the percentage change in quantity demanded is greater than the percentage change in price, demand is:", marks: 5, response: null, responses: [], flagged: false, options: [{ id: "q1-a", label: "A", text: "Perfectly inelastic" }, { id: "q1-b", label: "B", text: "Elastic" }, { id: "q1-c", label: "C", text: "Unitary elastic" }, { id: "q1-d", label: "D", text: "Inelastic" }] },
      { id: "q-2", order: 2, type: "single", prompt: "A movement along the same demand curve is caused by a change in:", marks: 5, response: null, responses: [], flagged: false, options: [{ id: "q2-a", label: "A", text: "Consumer income" }, { id: "q2-b", label: "B", text: "Price of the commodity" }, { id: "q2-c", label: "C", text: "Taste and preference" }, { id: "q2-d", label: "D", text: "Price of related goods" }] },
      { id: "q-3", order: 3, type: "multiple", prompt: "Which method measures elasticity using the average of the initial and final values?", marks: 5, response: null, responses: [], flagged: false, options: [{ id: "q3-a", label: "A", text: "Point method" }, { id: "q3-b", label: "B", text: "Total outlay method" }, { id: "q3-c", label: "C", text: "Arc method" }, { id: "q3-d", label: "D", text: "Geometric method" }] },
      { id: "q-4", order: 4, type: "short_text", prompt: "If price rises by 10% and quantity demanded falls by 5%, enter the absolute price elasticity.", marks: 5, response: null, responses: [], flagged: false, options: [] },
    ],
  };
}

export function mapStudentAttempt(value: StudentAttemptApiPayload): StudentAttempt {
  return {
    id: value.id,
    testId: value.test_id,
    title: value.title,
    course: value.course_title,
    totalMarks: value.total_marks,
    durationSeconds: value.duration_seconds,
    startedAt: value.started_at,
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
      options: question.options || [],
      response: question.response || null,
      responses: question.responses || (question.response ? [question.response] : []),
      flagged: Boolean(question.flagged),
    })),
  };
}
