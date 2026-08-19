"use client";

import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Flag, LoaderCircle, Save, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertBox, Button, ButtonLink, Panel } from "@/components/ui";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { browserRequest, createIdempotencyKey, normalizeApiError } from "@/lib/api/browser-client";
import { clearAttemptDraft, pruneOldDrafts, readAttemptDraft, saveAttemptDraft, type AttemptAnswer } from "@/lib/data/attempt-draft";
import type { ApiResponse } from "@/lib/api/contracts";
import { safeInternalPath } from "@/lib/auth/safe-return";
import { isChoiceQuestion, mapStudentAttempt, mockStudentAttempt, type StudentAttempt, type StudentAttemptApiPayload, type StudentTestLaunch } from "@/lib/data/assessment-shared";
import { cn } from "@/lib/utils";

const mockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
type SaveState = "idle" | "saving" | "saved" | "error";

type SubmitResponse = { attempt_id: string; result_path?: string | null };

function secondsLabel(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

/** An answer counts as given when it has text, or at least one selected option. */
function hasAnswer(value: AttemptAnswer | undefined): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "string" && value.trim().length > 0;
}

function isSelected(value: AttemptAnswer | undefined, optionId: string): boolean {
  return Array.isArray(value) ? value.includes(optionId) : value === optionId;
}

/** Text value for the short-answer box; an array can never reach it. */
function textAnswer(value: AttemptAnswer | undefined): string {
  return typeof value === "string" ? value : "";
}

function attemptRemaining(attempt: StudentAttempt): number {
  const serverOffset = Date.parse(attempt.serverNow) - Date.now();
  return Math.max(0, Math.ceil((Date.parse(attempt.expiresAt) - (Date.now() + serverOffset)) / 1000));
}

export function TestRunner({ launch }: { launch: StudentTestLaunch }) {
  const router = useRouter();
  const [attempt, setAttempt] = useState<StudentAttempt | null>(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AttemptAnswer>>({});
  const [flagged, setFlagged] = useState<string[]>([]);
  const [remaining, setRemaining] = useState(launch.durationSeconds);
  const [startBusy, setStartBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [offline, setOffline] = useState(false);
  const dirtyRef = useRef(false);
  const saveVersion = useRef(0);
  const autoSubmitRef = useRef(false);

  // flushAnswers reads through these so it does not need answers/flagged in its
  // dependency list; otherwise it would be rebuilt on every keystroke and the
  // retry interval would restart with it.
  const answersRef = useRef(answers);
  const flaggedRef = useRef(flagged);
  useEffect(() => {
    answersRef.current = answers;
    flaggedRef.current = flagged;
  });

  const questions = attempt?.questions || [];
  const question = questions[current];
  const answered = Object.values(answers).filter(hasAnswer).length;
  const unanswered = questions.length - answered;
  const palette = useMemo(
    () => questions.map((item) => ({ ...item, answered: hasAnswer(answers[item.id]), flagged: flagged.includes(item.id) })),
    [answers, flagged, questions],
  );

  async function startAttempt() {
    if (startBusy || !launch.canStart) return;
    setStartBusy(true);
    setError(null);
    try {
      let nextAttempt: StudentAttempt;
      if (mockMode) {
        await new Promise((resolve) => window.setTimeout(resolve, 250));
        nextAttempt = mockStudentAttempt(launch.id);
      } else {
        const response = await browserRequest<ApiResponse<StudentAttemptApiPayload>>({
          url: `/api/v1/student/tests/${encodeURIComponent(launch.id)}/attempts`,
          method: "POST",
          headers: { "Idempotency-Key": createIdempotencyKey("student-attempt-start") },
        });
        nextAttempt = mapStudentAttempt(response.data);
      }
      setAttempt(nextAttempt);

      // Server answers first, then anything this device saved but never managed
      // to send — the local copy is newer by definition, since it is written
      // before the request that would have delivered it.
      const serverAnswers: Record<string, AttemptAnswer> = Object.fromEntries(
        nextAttempt.questions.map((item) => [item.id, item.type === "multiple" ? item.responses : item.response || ""]),
      );
      const draft = readAttemptDraft(nextAttempt.id);
      const restored = draft
        ? Object.fromEntries(
            Object.entries({ ...serverAnswers, ...draft.answers }).filter(([questionId]) => questionId in serverAnswers),
          )
        : serverAnswers;

      if (draft && JSON.stringify(restored) !== JSON.stringify(serverAnswers)) {
        // Re-send it: the student should not have to touch anything for work
        // they already did to reach the server.
        dirtyRef.current = true;
      }

      pruneOldDrafts(nextAttempt.id);
      setAnswers(restored);
      setFlagged(draft?.flagged ?? nextAttempt.questions.filter((item) => item.flagged).map((item) => item.id));
      setRemaining(attemptRemaining(nextAttempt));
      setSaveState("saved");
    } catch (caught) {
      setError(normalizeApiError(caught).message);
    } finally {
      setStartBusy(false);
    }
  }

  /**
   * Pushes the current answers to the server.
   *
   * Returns whether the write landed, so the caller can decide what to do —
   * the timer-driven autosave retries, and submit refuses to proceed on a
   * failure rather than grading work the server never received.
   */
  const flushAnswers = useCallback(async (): Promise<boolean> => {
    if (!attempt || submitted) return true;
    if (!dirtyRef.current) return true;

    const version = ++saveVersion.current;
    setSaveState("saving");

    try {
      if (!mockMode) {
        await browserRequest<ApiResponse<{ saved_at: string }>>({
          url: `/api/v1/student/attempts/${encodeURIComponent(attempt.id)}/responses`,
          method: "PATCH",
          data: {
            answers: Object.entries(answersRef.current).map(([questionId, response]) => ({
              question_id: questionId,
              // Arrays go through intact: a multi-answer question needs every
              // chosen option id, not just the first.
              response: hasAnswer(response) ? response : null,
            })),
            flagged_question_ids: flaggedRef.current,
            client_sequence: version,
          },
        });
      }

      // A newer edit started while this request was in flight; that save owns
      // the dirty flag now.
      if (saveVersion.current === version) {
        dirtyRef.current = false;
        setSaveState("saved");
      }

      return true;
    } catch {
      if (saveVersion.current === version) setSaveState("error");

      return false;
    }
  }, [attempt, submitted]);

  const submitAttempt = useCallback(async (automatic = false) => {
    if (!attempt || submitBusy || submitted) return;
    setSubmitBusy(true);
    setError(null);

    /*
     * Push anything outstanding before grading.
     *
     * Submit used to fire immediately, so an answer still inside the debounce
     * window — or one whose save had failed — was simply never sent, and the
     * server graded work the student had actually done. On a manual submit a
     * failure here stops the process so nothing is lost silently; on an
     * automatic submit the clock has run out and the attempt must close either
     * way, so it proceeds with whatever did reach the server.
     */
    const flushed = await flushAnswers();

    if (!flushed && !automatic) {
      setError("Your latest answers could not be saved. Check your connection — submitting now would lose them.");
      setSubmitBusy(false);
      return;
    }

    try {
      let path = `/student/attempts/${encodeURIComponent(attempt.id)}`;
      if (!mockMode) {
        const response = await browserRequest<ApiResponse<SubmitResponse>>({
          url: `/api/v1/student/attempts/${encodeURIComponent(attempt.id)}/submit`,
          method: "POST",
          data: { automatic, client_submitted_at: new Date().toISOString() },
          headers: { "Idempotency-Key": createIdempotencyKey("student-attempt-submit") },
        });
        path = safeInternalPath(response.data.result_path, path);
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }
      setSubmitted(true);
      clearAttemptDraft(attempt.id);
      router.replace(path);
      router.refresh();
    } catch (caught) {
      if (automatic) {
        /*
         * The clock ran out and the network is gone. The attempt is not lost:
         * the server closes and grades expired attempts on a schedule, using
         * whatever reached it. Saying so is far better than a raw error on a
         * student who has just finished an exam.
         */
        setSubmitted(true);
        setError("Time is up and your connection dropped. This attempt has closed and will be graded from the answers already received. You can check the result once you are back online.");
        setSubmitBusy(false);
        return;
      }

      setError(normalizeApiError(caught).message);
      setSubmitBusy(false);
    }
  }, [attempt, flushAnswers, router, submitBusy, submitted]);

  useEffect(() => {
    if (!attempt || submitted) return;
    const update = () => {
      const next = attemptRemaining(attempt);
      setRemaining(next);
      if (next === 0 && !autoSubmitRef.current) {
        autoSubmitRef.current = true;
        void submitAttempt(true);
      }
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [attempt, submitAttempt, submitted]);


  /*
   * Local backup, written synchronously on every change.
   *
   * The banner tells students their work is held on this device while offline.
   * This is what makes that true: a tab crash or an accidental close on a
   * low-memory phone no longer loses an exam. It is a backup only — the server
   * copy remains authoritative and decides the grade.
   */
  useEffect(() => {
    if (!attempt || submitted) return;
    saveAttemptDraft({ attemptId: attempt.id, answers, flagged, savedAt: Date.now() });
  }, [answers, attempt, flagged, submitted]);

  // Debounced save on every edit.
  useEffect(() => {
    if (!attempt || !dirtyRef.current || submitted) return;
    const timeout = window.setTimeout(() => void flushAnswers(), 650);
    return () => window.clearTimeout(timeout);
  }, [answers, attempt, flagged, flushAnswers, submitted]);

  /**
   * Retry loop for a failed save.
   *
   * Without this the interface claimed to be retrying while doing nothing: a
   * student whose connection blipped after their last answer would lose it
   * entirely, having been told it was safe. Runs until the write lands or the
   * attempt ends.
   */
  useEffect(() => {
    if (!attempt || submitted || saveState !== "error") return;

    const retry = window.setInterval(() => {
      if (dirtyRef.current) void flushAnswers();
    }, 5000);

    return () => window.clearInterval(retry);
  }, [attempt, flushAnswers, saveState, submitted]);

  // Connection state, so an offline student is told rather than left watching
  // a stale "Saved".
  useEffect(() => {
    const goOnline = () => {
      setOffline(false);
      // Reconnecting is the best moment to push whatever is outstanding.
      if (dirtyRef.current) void flushAnswers();
    };
    const goOffline = () => setOffline(true);

    // Intentionally set here rather than in the initial useState: navigator
    // doesn't exist during server rendering, so reading it before mount would
    // make the server and an actually-offline client render different text.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [flushAnswers]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!attempt || submitted) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [attempt, submitted]);

  const unsaved = offline || saveState === "error";

  function answer(questionId: string, value: AttemptAnswer) {
    dirtyRef.current = true;
    setAnswers((items) => ({ ...items, [questionId]: value }));
  }

  function toggleFlag(questionId: string) {
    dirtyRef.current = true;
    setFlagged((items) => items.includes(questionId) ? items.filter((id) => id !== questionId) : [...items, questionId]);
  }

  if (!attempt) {
    return (
      <div className="mx-auto max-w-2xl py-6">
        <Panel>
          <p className="text-sm font-bold uppercase tracking-wider text-brand-700">Assessment</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">{launch.title}</h1>
          <p className="mt-2 text-sm text-slate-600">{launch.course}</p>
          <div className="mt-6 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-3"><div><p className="text-slate-500">Duration</p><p className="mt-1 font-bold text-slate-900">{Math.ceil(launch.durationSeconds / 60)} minutes</p></div><div><p className="text-slate-500">Marks</p><p className="mt-1 font-bold text-slate-900">{launch.totalMarks}</p></div><div><p className="text-slate-500">Attempts</p><p className="mt-1 font-bold text-slate-900">{launch.attemptsUsed} of {launch.attemptsAllowed} used</p></div></div>
          <AlertBox title="Before you begin" tone="warning"><p>The timer is controlled by the server. Do not refresh or close the browser during the attempt. Answers are saved automatically.</p></AlertBox>
          {error ? <div className="mt-4"><AlertBox title="Attempt not started" tone="danger">{error}</AlertBox></div> : null}
          {!launch.canStart ? <div className="mt-4"><AlertBox title="Test unavailable" tone="info">{launch.reason || "This test cannot be started now."}</AlertBox></div> : null}
          <div className="mt-6 flex flex-wrap gap-3"><Button onClick={() => void startAttempt()} disabled={startBusy || !launch.canStart}>{startBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{startBusy ? "Starting…" : "Start test"}</Button><ButtonLink href="/student/tests" variant="outline">Back to tests</ButtonLink></div>
        </Panel>
      </div>
    );
  }

  if (!question) return <Panel><AlertBox title="No questions available" tone="danger">The server did not provide any authorized questions for this attempt.</AlertBox></Panel>;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-sm font-bold text-slate-950">{attempt.title}</p><p className="mt-1 text-xs text-slate-500">{attempt.totalMarks} marks · {Math.ceil(attempt.durationSeconds / 60)} minutes · attempt {attempt.attemptNumber} of {attempt.attemptsAllowed}</p></div>
        <div className="flex items-center gap-4"><span className={cn("inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold", remaining < 300 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800")}><Clock3 className="h-4 w-4" />{secondsLabel(remaining)}</span><span className={cn("inline-flex items-center gap-2 text-xs font-medium", offline || saveState === "error" ? "text-red-700" : "text-green-700")}><Save className="h-4 w-4" />{offline ? "Offline — your answers are held here" : saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed — retrying every 5s" : "Saved"}</span></div>
      </div>
      {error ? <div className="mb-5"><AlertBox title="Action not completed" tone="danger">{error}</AlertBox></div> : null}
      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <Panel className="min-h-[500px]">
          <div className="flex items-center justify-between gap-4"><p className="text-sm font-bold uppercase tracking-wider text-brand-700">Question {current + 1} of {questions.length} · {question.marks} marks</p><button type="button" onClick={() => toggleFlag(question.id)} className={cn("inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold", flagged.includes(question.id) ? "bg-amber-50 text-amber-800" : "text-slate-600 hover:bg-slate-100")}><Flag className="h-4 w-4" />{flagged.includes(question.id) ? "Flagged" : "Flag for review"}</button></div>
          <h1 className="mt-8 text-xl font-semibold leading-8 text-slate-950 sm:text-2xl">{question.prompt}</h1>
          {unsaved ? (
            <p role="status" aria-live="polite" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              {offline
                ? "You are offline. Keep answering — every answer is saved on this device and sent automatically when the connection returns."
                : "Your last answers have not reached the server yet. Keep this tab open; it retries every few seconds."}
            </p>
          ) : null}
          {isChoiceQuestion(question.type) ? (
            <fieldset className="mt-8 space-y-3">
              <legend className="sr-only">
                {question.type === "multiple" ? "Answer options — select every correct answer" : "Answer options — select one"}
              </legend>
              {question.type === "multiple" ? (
                <p className="text-sm font-medium text-slate-600">Select every answer that applies.</p>
              ) : null}
              {question.options.map((option) => {
                const selected = isSelected(answers[question.id], option.id);
                return (
                  <label
                    key={option.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition",
                      selected ? "border-brand-600 bg-brand-50 ring-2 ring-brand-100" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    <input
                      type={question.type === "multiple" ? "checkbox" : "radio"}
                      name={`question-${question.id}`}
                      checked={selected}
                      onChange={() => {
                        if (question.type !== "multiple") {
                          answer(question.id, option.id);
                          return;
                        }
                        const current = answers[question.id];
                        const chosen = Array.isArray(current) ? current : current ? [current] : [];
                        answer(
                          question.id,
                          chosen.includes(option.id) ? chosen.filter((id) => id !== option.id) : [...chosen, option.id],
                        );
                      }}
                      className="mt-1 h-4 w-4 accent-brand-700"
                    />
                    <span>
                      <span className="mr-2 font-bold text-slate-500">{option.label}.</span>
                      <span className="text-sm leading-6 text-slate-800">{option.text}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ) : (
            <label className="mt-8 block text-sm font-semibold text-slate-700">
              Your answer
              <textarea
                value={textAnswer(answers[question.id])}
                onChange={(event) => answer(question.id, event.target.value)}
                maxLength={4000}
                className="mt-2 min-h-40 w-full rounded-xl border border-slate-300 p-4 font-normal outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
              />
            </label>
          )}
          <div className="mt-10 flex items-center justify-between border-t border-slate-100 pt-5"><Button variant="outline" disabled={current === 0} onClick={() => setCurrent((value) => Math.max(0, value - 1))}><ChevronLeft className="h-4 w-4" />Previous</Button>{current < questions.length - 1 ? <Button onClick={() => setCurrent((value) => Math.min(questions.length - 1, value + 1))}>Next<ChevronRight className="h-4 w-4" /></Button> : unanswered > 0 ? <ConfirmAction label={submitBusy ? "Submitting…" : "Review and submit"} icon={submitBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} title="Submit now?" description={`${unanswered} question${unanswered === 1 ? " is" : "s are"} unanswered.`} confirmLabel="Submit test" tone="primary" disabled={submitBusy} triggerClassName="inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold text-white transition-colors disabled:pointer-events-none disabled:opacity-50 bg-brand-700 hover:bg-brand-800 border-brand-700" onConfirm={() => submitAttempt(false)} /> : <Button onClick={() => void submitAttempt(false)} disabled={submitBusy}>{submitBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{submitBusy ? "Submitting…" : "Review and submit"}</Button>}</div>
        </Panel>
        <div className="space-y-5"><Panel><h2 className="font-bold text-slate-950">Question palette</h2><div className="mt-4 grid grid-cols-5 gap-2">{palette.map((item, index) => <button key={item.id} type="button" onClick={() => setCurrent(index)} className={cn("relative flex h-10 items-center justify-center rounded-lg border text-sm font-bold", index === current ? "border-brand-700 bg-brand-700 text-white" : item.answered ? "border-green-200 bg-green-50 text-green-700" : "border-slate-200 bg-white text-slate-600")} aria-label={`Go to question ${item.order}`}>{item.order}{item.flagged ? <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" /> : null}</button>)}</div><div className="mt-5 space-y-2 text-xs text-slate-500"><p>{answered} answered · {questions.length - answered} unanswered</p><p>{flagged.length} flagged for review</p></div></Panel><Panel><div className="flex gap-3"><AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" /><div><h2 className="font-bold text-slate-950">Before submitting</h2><p className="mt-2 text-sm leading-6 text-slate-600">Unanswered questions remain blank. The backend enforces the deadline, attempts and score release.</p></div></div>{unanswered > 0 ? <ConfirmAction label={submitBusy ? "Submitting…" : "Submit test"} title="Submit now?" description={`${unanswered} question${unanswered === 1 ? " is" : "s are"} unanswered.`} confirmLabel="Submit test" tone="primary" disabled={submitBusy} triggerClassName="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold text-slate-800 transition-colors disabled:pointer-events-none disabled:opacity-50 bg-white hover:bg-slate-50 border-slate-300" onConfirm={() => submitAttempt(false)} /> : <Button onClick={() => void submitAttempt(false)} disabled={submitBusy} variant="outline" className="mt-5 w-full">{submitBusy ? "Submitting…" : "Submit test"}</Button>}</Panel></div>
      </div>
    </div>
  );
}
