"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, LoaderCircle } from "lucide-react";
import { browserRequest, createIdempotencyKey, type NormalizedApiError } from "@/lib/api/browser-client";
import { cn } from "@/lib/utils";

const mockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

/**
 * Marks a syllabus lesson done.
 *
 * `lesson_completions` had a table, a model, a relation and a quarter of the
 * progress calculation behind it, and no way at all to write a row — so the
 * syllabus bar read 0% for every student forever, and the tick beside a lesson
 * could never appear. This is the missing half.
 */
export function LessonCompletionToggle({
  enrollmentId,
  lessonId,
  initialCompleted,
  label,
}: {
  enrollmentId: string;
  lessonId: string;
  initialCompleted: boolean;
  label: string;
}) {
  const router = useRouter();
  const [completed, setCompleted] = useState(initialCompleted);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function toggle() {
    const next = !completed;

    // Optimistic: ticking a lesson should feel instant. Reverted on failure.
    setCompleted(next);
    setBusy(true);
    setError(null);

    try {
      if (mockMode) return;

      await browserRequest({
        url: `/api/v1/student/courses/${encodeURIComponent(enrollmentId)}/lessons/${encodeURIComponent(lessonId)}/complete`,
        method: "POST",
        data: { completed: next },
        headers: { "Idempotency-Key": createIdempotencyKey("lesson-complete") },
      });

      // Refresh so the module and course progress bars move too.
      startTransition(() => router.refresh());
    } catch (caught) {
      setCompleted(!next);
      const apiError = caught as Partial<NormalizedApiError>;
      setError(apiError.message || "Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={completed}
        aria-label={completed ? `Mark "${label}" as not done` : `Mark "${label}" as done`}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition disabled:opacity-60",
          completed ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
        )}
      >
        {busy ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : completed ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Circle className="h-3.5 w-3.5" />
        )}
        {completed ? "Done" : "Mark done"}
      </button>
      {error ? <span className="text-xs font-medium text-red-700">{error}</span> : null}
    </span>
  );
}
