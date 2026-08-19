"use client";

import { ClipboardCheck, Eye, GripVertical, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertBox, Button, PageHeader, Panel, StatusBadge, labelledFieldClass } from "@/components/ui";
import { browserRequest, createIdempotencyKey, normalizeApiError } from "@/lib/api/browser-client";
import type { ApiResponse } from "@/lib/api/contracts";
import {
  isChoiceQuestion,
  questionTypeLabels,
  type QuestionType,
  type TeacherTestBuilderData,
  type TeacherTestQuestion,
} from "@/lib/data/assessment-shared";

const mockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
// Shared token; see fieldClass in components/ui.
const inputClass = labelledFieldClass;
const textareaClass = "mt-2 min-h-24 w-full rounded-lg border border-slate-300 p-3 font-normal outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100";
type Notice = { tone: "success" | "danger" | "info"; title: string; message: string } | null;

function defaultOptions(id: string, type: QuestionType): TeacherTestQuestion["options"] {
  if (type === "short_text") return [];
  if (type === "true_false") {
    return [
      { id: `${id}-true`, text: "True", correct: true },
      { id: `${id}-false`, text: "False", correct: false },
    ];
  }
  return ["a", "b", "c", "d"].map((suffix, index) => ({ id: `${id}-${suffix}`, text: "", correct: type === "multiple" ? false : index === 0 }));
}

function newQuestion(type: QuestionType = "single"): TeacherTestQuestion {
  const id = crypto.randomUUID();
  return { id, type, prompt: "", marks: 1, acceptedAnswers: [], options: defaultOptions(id, type) };
}

/**
 * Switching type rebuilds the answer shape rather than carrying it over: a
 * true/false question must have exactly two options, and a single-answer
 * question exactly one correct one, both of which the API enforces.
 */
function retype(question: TeacherTestQuestion, type: QuestionType): TeacherTestQuestion {
  if (question.type === type) return question;
  if (type === "multiple" && question.type === "single") {
    return { ...question, type };
  }
  if (type === "single" && question.type === "multiple") {
    const options = question.options.map((option, index) => ({ ...option, correct: index === 0 }));
    return { ...question, type, options };
  }
  return { ...question, type, options: defaultOptions(question.id, type) };
}

function apiMessage(error: unknown): string {
  return normalizeApiError(error).message || "The request could not be completed.";
}

function validate(values: TeacherTestBuilderData, publish: boolean): string | null {
  if (!values.batchId) return "Select an assigned batch.";
  if (values.title.trim().length < 4) return "Enter a test title of at least four characters.";
  if (values.durationMinutes < 1 || values.durationMinutes > 600) return "Duration must be between 1 and 600 minutes.";
  if (values.attemptsAllowed < 1 || values.attemptsAllowed > 10) return "Allowed attempts must be between 1 and 10.";
  if (values.opensAt && values.closesAt && Date.parse(values.opensAt) >= Date.parse(values.closesAt)) return "The closing time must be after the opening time.";
  if (!publish) return null;
  if (!values.opensAt || !values.closesAt) return "Set both opening and closing times before publishing.";
  if (!values.questions.length) return "Add at least one question before publishing.";
  const totalMarks = values.questions.reduce((sum, question) => sum + Number(question.marks || 0), 0);
  if (values.passMarks < 0 || values.passMarks > totalMarks) return `Pass marks must be between 0 and ${totalMarks}.`;
  for (const [index, question] of values.questions.entries()) {
    if (question.prompt.trim().length < 3 || question.marks <= 0) return `Complete the prompt and marks for question ${index + 1}.`;
    if (isChoiceQuestion(question.type)) {
      if (question.options.length < 2 || question.options.some((option) => option.text.trim().length < 1)) return `Complete at least two options for question ${index + 1}.`;
      const correct = question.options.filter((option) => option.correct).length;
      if (question.type === "multiple") {
        if (correct < 1) return `Select at least one correct option for question ${index + 1}.`;
      } else if (correct !== 1) {
        return `Select exactly one correct option for question ${index + 1}.`;
      }
      if (question.type === "true_false" && question.options.length !== 2) return `Question ${index + 1} is true/false and must have exactly two options.`;
    }
    if (question.type === "short_text" && !question.acceptedAnswers.some((answer) => answer.trim().length > 0)) return `Add at least one accepted answer for question ${index + 1}.`;
  }
  return null;
}

/**
 * Field names below are the API's contract, not frontend synonyms.
 * pass_marks / randomize_options / negative_marks were accepted as "sometimes"
 * rules and then dropped, so those three settings never actually saved.
 */
function payload(values: TeacherTestBuilderData, includeQuestions: boolean) {
  const body: Record<string, unknown> = {
    batch_id: values.batchId,
    title: values.title.trim(),
    opens_at: values.opensAt || null,
    closes_at: values.closesAt || null,
    duration_minutes: values.durationMinutes,
    pass_mark: values.passMarks,
    attempts_allowed: values.attemptsAllowed,
    result_release: values.resultRelease,
    shuffle_options: values.randomizeOptions,
    negative_marking: values.negativeMarks,
  };

  // The API refuses question edits once an attempt exists; sending them anyway
  // would turn a harmless metadata edit into a rejected save.
  if (includeQuestions) {
    body.questions = values.questions.map((question, index) => ({
      order: index + 1,
      type: question.type,
      prompt: question.prompt.trim(),
      marks: Number(question.marks),
      options: isChoiceQuestion(question.type)
        ? question.options.map((option) => ({ label: option.text.trim(), is_correct: option.correct }))
        : [],
      accepted_answers: question.type === "short_text"
        ? question.acceptedAnswers.map((answer) => answer.trim()).filter(Boolean)
        : [],
    }));
  }

  return body;
}

/**
 * One question row.
 *
 * The correctness control follows the question type: radios where exactly one
 * answer is allowed, checkboxes for multiple. Rendering a radio group for a
 * multi-answer question was why those questions could never be answered
 * correctly, and then attracted a negative mark for the attempt.
 */
function QuestionEditor({
  question,
  index,
  onChange,
  onDelete,
}: {
  question: TeacherTestQuestion;
  index: number;
  onChange: (updater: (question: TeacherTestQuestion) => TeacherTestQuestion) => void;
  onDelete: () => void;
}) {
  const multi = question.type === "multiple";
  const fixedOptions = question.type === "true_false";

  function toggleCorrect(optionId: string) {
    onChange((current) => ({
      ...current,
      options: current.options.map((item) =>
        multi
          ? item.id === optionId ? { ...item, correct: !item.correct } : item
          : { ...item, correct: item.id === optionId },
      ),
    }));
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <GripVertical className="mt-2 h-5 w-5 shrink-0 text-slate-300" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="grid gap-4 sm:grid-cols-[1fr_130px]">
            <label className="text-xs font-bold uppercase tracking-wider text-brand-700">
              Question {index + 1}
              <select
                value={question.type}
                onChange={(event) => onChange((current) => retype(current, event.target.value as QuestionType))}
                className={`${inputClass} normal-case tracking-normal text-slate-700`}
              >
                {(Object.keys(questionTypeLabels) as QuestionType[]).map((type) => (
                  <option key={type} value={type}>{questionTypeLabels[type]}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Marks
              <input
                value={question.marks}
                onChange={(event) => onChange((current) => ({ ...current, marks: Number(event.target.value) }))}
                min={0.5}
                step="0.5"
                type="number"
                className={`${inputClass} normal-case tracking-normal text-slate-700`}
              />
            </label>
          </div>

          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Question prompt
            <textarea
              value={question.prompt}
              onChange={(event) => onChange((current) => ({ ...current, prompt: event.target.value }))}
              maxLength={2000}
              className={textareaClass}
            />
          </label>

          {isChoiceQuestion(question.type) ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold text-slate-700">
                Answer options{" "}
                <span className="font-normal text-slate-500">
                  ({multi ? "tick every correct answer" : "select the correct one"})
                </span>
              </p>
              {question.options.map((option, optionIndex) => (
                <div key={option.id} className="flex items-center gap-3">
                  <input
                    type={multi ? "checkbox" : "radio"}
                    name={`correct-${question.id}`}
                    checked={option.correct}
                    onChange={() => toggleCorrect(option.id)}
                    className="h-4 w-4 accent-brand-700"
                    aria-label={`Mark option ${optionIndex + 1} correct`}
                  />
                  <input
                    value={option.text}
                    readOnly={fixedOptions}
                    onChange={(event) =>
                      onChange((current) => ({
                        ...current,
                        options: current.options.map((item) => (item.id === option.id ? { ...item, text: event.target.value } : item)),
                      }))
                    }
                    placeholder={`Option ${optionIndex + 1}`}
                    maxLength={500}
                    className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100 read-only:bg-slate-50 read-only:text-slate-500"
                  />
                  <button
                    type="button"
                    disabled={fixedOptions || question.options.length <= 2}
                    onClick={() =>
                      onChange((current) => {
                        const remaining = current.options.filter((item) => item.id !== option.id);
                        // Never leave a single-answer question with no correct option.
                        const needsCorrect = !multi && !remaining.some((item) => item.correct);
                        return {
                          ...current,
                          options: remaining.map((item, remainingIndex) => ({ ...item, correct: needsCorrect ? remainingIndex === 0 : item.correct })),
                        };
                      })
                    }
                    aria-label={`Delete option ${optionIndex + 1}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {fixedOptions ? null : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onChange((current) => ({
                      ...current,
                      options: [...current.options, { id: crypto.randomUUID(), text: "", correct: false }],
                    }))
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add option
                </Button>
              )}
            </div>
          ) : (
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Accepted answers <span className="font-normal text-slate-500">(separate alternatives with commas)</span>
              <textarea
                value={question.acceptedAnswers.join(", ")}
                onChange={(event) => onChange((current) => ({ ...current, acceptedAnswers: event.target.value.split(",") }))}
                maxLength={2000}
                className={textareaClass}
              />
              <span className="mt-2 block text-xs font-normal text-slate-500">
                Matching ignores capitalisation and extra spaces. A short-text question with no accepted answer cannot be scored.
              </span>
            </label>
          )}
        </div>

        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete question ${index + 1}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function TestBuilder({ initialData }: { initialData: TeacherTestBuilderData }) {
  const router = useRouter();
  const [values, setValues] = useState(initialData);
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const editing = Boolean(values.id);
  const totalMarks = useMemo(() => values.questions.reduce((sum, question) => sum + Number(question.marks || 0), 0), [values.questions]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function change<K extends keyof TeacherTestBuilderData>(key: K, value: TeacherTestBuilderData[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  function updateQuestion(questionId: string, updater: (question: TeacherTestQuestion) => TeacherTestQuestion) {
    setValues((current) => ({ ...current, questions: current.questions.map((question) => question.id === questionId ? updater(question) : question) }));
    setDirty(true);
  }

  async function save(publishAfter = false) {
    if (busy) return;
    const validation = validate(values, publishAfter);
    if (validation) {
      setNotice({ tone: "danger", title: publishAfter ? "Test not published" : "Draft not saved", message: validation });
      return;
    }
    setBusy(publishAfter ? "publish" : "save");
    setNotice(null);
    try {
      let testId = values.id;
      if (!mockMode) {
        const response = await browserRequest<ApiResponse<{ id: string; status: string }>>({
          url: testId ? `/api/v1/teacher/tests/${encodeURIComponent(testId)}` : "/api/v1/teacher/tests",
          method: testId ? "PATCH" : "POST",
          // batch_id is create-only; the API rejects it on update.
          data: (() => {
            const body = payload(values, !values.hasAttempts);
            if (testId) delete body.batch_id;
            return body;
          })(),
          headers: { "Idempotency-Key": createIdempotencyKey(testId ? "teacher-test-update" : "teacher-test-create") },
        });
        testId = response.data.id;
        if (publishAfter) {
          await browserRequest<ApiResponse<{ status: string }>>({
            url: `/api/v1/teacher/tests/${encodeURIComponent(testId)}/publish`,
            method: "POST",
            headers: { "Idempotency-Key": createIdempotencyKey("teacher-test-publish") },
          });
        }
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 250));
        testId = testId || "test-preview-new";
      }
      setValues((current) => ({ ...current, id: testId, status: publishAfter ? "published" : current.status }));
      setDirty(false);
      setNotice({
        tone: "success",
        title: mockMode ? "Preview validated" : publishAfter ? "Test published" : "Draft saved",
        message: mockMode ? "The complete assessment payload and answer-key rules are ready for Laravel." : publishAfter ? "The test is available according to the configured schedule." : "The draft and question order were saved.",
      });
      if (!values.id && testId && !mockMode) router.replace(`/teacher/tests/${encodeURIComponent(testId)}`);
      router.refresh();
    } catch (error) {
      setNotice({ tone: "danger", title: publishAfter ? "Test not published" : "Draft not saved", message: apiMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader back={{ href: "/teacher/content", label: "Tests & content" }}
        eyebrow="Test builder"
        title={editing ? values.title || "Edit test" : "Create a new test"}
        description={editing ? "Update settings and questions for an assigned batch." : "Set the batch, availability and scoring rules before publishing."}
        actions={<><Button variant="outline" onClick={() => setPreview((value) => !value)}><Eye className="h-4 w-4" />{preview ? "Close preview" : "Preview"}</Button><Button onClick={() => void save(false)} disabled={Boolean(busy)}>{busy === "save" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy === "save" ? "Saving…" : "Save draft"}</Button></>}
      />

      {notice ? <div className="mb-5"><AlertBox title={notice.title} tone={notice.tone}>{notice.message}</AlertBox></div> : null}
      {values.hasAttempts ? (
        <AlertBox title="Questions are locked" tone="warning">
          <p>A student has already attempted this test, so the paper itself can no longer change. Schedule, duration, attempts and result release can still be edited.</p>
        </AlertBox>
      ) : null}
      {preview ? <Panel className="mb-5 border-brand-200 bg-brand-50"><p className="text-xs font-bold uppercase tracking-wider text-brand-700">Student preview</p><h2 className="mt-2 text-xl font-bold text-slate-950">{values.title || "Untitled test"}</h2><p className="mt-2 text-sm text-slate-600">{values.questions.length} questions · {totalMarks} marks · {values.durationMinutes} minutes · {values.attemptsAllowed} attempt{values.attemptsAllowed === 1 ? "" : "s"}</p><div className="mt-4 rounded-xl border border-brand-200 bg-white p-4"><p className="text-sm font-semibold text-slate-900">{values.questions[0]?.prompt || "The first question will appear here."}</p></div></Panel> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Panel>
            <h2 className="text-xl font-bold text-slate-950">Test settings</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Assigned batch<select value={values.batchId} onChange={(event) => change("batchId", event.target.value)} className={`${inputClass} bg-white`}><option value="">Select assigned batch</option>{values.batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.label}</option>)}</select></label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Test title<input value={values.title} onChange={(event) => change("title", event.target.value)} maxLength={160} placeholder="For example: Unit 2 Practice Test" className={inputClass} /></label>
              <label className="text-sm font-semibold text-slate-700">Available from<input value={values.opensAt} onChange={(event) => change("opensAt", event.target.value)} type="datetime-local" className={inputClass} /></label>
              <label className="text-sm font-semibold text-slate-700">Available until<input value={values.closesAt} onChange={(event) => change("closesAt", event.target.value)} type="datetime-local" className={inputClass} /></label>
              <label className="text-sm font-semibold text-slate-700">Duration (minutes)<input value={values.durationMinutes} onChange={(event) => change("durationMinutes", Number(event.target.value))} min={1} max={600} type="number" className={inputClass} /></label>
              <label className="text-sm font-semibold text-slate-700">Pass mark<input value={values.passMarks} onChange={(event) => change("passMarks", Number(event.target.value))} min={0} max={totalMarks || undefined} type="number" className={inputClass} /></label>
              <label className="text-sm font-semibold text-slate-700">Allowed attempts<input value={values.attemptsAllowed} onChange={(event) => change("attemptsAllowed", Number(event.target.value))} min={1} max={10} type="number" className={inputClass} /></label>
              <label className="text-sm font-semibold text-slate-700">Result release<select value={values.resultRelease} onChange={(event) => change("resultRelease", event.target.value as TeacherTestBuilderData["resultRelease"])} className={`${inputClass} bg-white`}><option value="immediate">Immediately after submission</option><option value="after_close">After test closes</option><option value="manual">Manual release</option></select></label>
              <label className="flex items-center gap-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={values.randomizeOptions} onChange={(event) => change("randomizeOptions", event.target.checked)} className="h-4 w-4 accent-brand-700" />Randomize answer options per attempt</label>
              <label className="text-sm font-semibold text-slate-700">Negative mark per wrong answer<input value={values.negativeMarks} onChange={(event) => change("negativeMarks", Number(event.target.value))} min={0} step="0.25" type="number" className={inputClass} /></label>
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-950">Questions</h2><p className="mt-1 text-sm text-slate-500">{values.questions.length} questions · {totalMarks} marks</p></div><Button onClick={() => { change("questions", [...values.questions, newQuestion()]); }}><Plus className="h-4 w-4" />Add question</Button></div>
            {values.questions.length ? (
              <div className="mt-5 space-y-4">
                {values.questions.map((question, index) => (
                  <QuestionEditor
                    key={question.id}
                    question={question}
                    index={index}
                    onChange={(updater) => updateQuestion(question.id, updater)}
                    onDelete={() => change("questions", values.questions.filter((item) => item.id !== question.id))}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                <ClipboardCheck className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-3 font-semibold text-slate-900">Add the first question</p>
                <p className="mt-1 text-sm text-slate-500">Questions and correct answers are sent only through the authorized teacher endpoint.</p>
              </div>
            )}
          </Panel>
        </div>

        <aside className="space-y-5">
          <Panel><div className="flex items-center gap-3"><ClipboardCheck className="h-6 w-6 text-violet-700" /><h2 className="text-lg font-bold text-slate-950">Publishing</h2></div><div className="mt-5 space-y-4 text-sm"><div className="flex items-center justify-between"><span className="text-slate-500">Current status</span><StatusBadge status={values.status} /></div><div className="flex items-center justify-between"><span className="text-slate-500">Questions</span><span className="font-semibold text-slate-900">{values.questions.length}</span></div><div className="flex items-center justify-between"><span className="text-slate-500">Total marks</span><span className="font-semibold text-slate-900">{totalMarks}</span></div><div className="flex items-center justify-between"><span className="text-slate-500">Randomize options</span><span className="font-semibold text-slate-900">{values.randomizeOptions ? "Yes" : "No"}</span></div></div>{values.canPublish ? <Button className="mt-6 w-full" onClick={() => void save(true)} disabled={Boolean(busy)}>{busy === "publish" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{busy === "publish" ? "Publishing…" : values.status === "published" ? "Publish updated test" : "Publish test"}</Button> : <p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Only the assigned teacher can publish this test. You can still edit the draft and questions above.</p>}</Panel>
          <Panel><h2 className="font-bold text-slate-950">Security rule</h2><p className="mt-3 text-sm leading-6 text-slate-600">Correct answers remain restricted to teacher/admin APIs and are never included in active student-attempt payloads.</p></Panel>
        </aside>
      </div>
    </>
  );
}
