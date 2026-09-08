"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CalendarRange, Loader2 } from "lucide-react";
import { browserRequest, createIdempotencyKey, type NormalizedApiError } from "@/lib/api/browser-client";
import { isMockDataEnabled } from "@/lib/data/config";

const weekdays = [
  { value: 0, short: "Sun" },
  { value: 1, short: "Mon" },
  { value: 2, short: "Tue" },
  { value: 3, short: "Wed" },
  { value: 4, short: "Thu" },
  { value: 5, short: "Fri" },
  { value: 6, short: "Sat" },
];

/**
 * Schedules a repeating class in one action.
 *
 * A teacher running a daily batch would otherwise fill the single-class form
 * thirty times. Every occurrence becomes a real class rather than a recurrence
 * rule, so any one of them can later be rescheduled or cancelled on its own.
 */
export function RecurringClassForm({
  batches,
}: {
  batches: Array<{ id: string; title: string; courseTitle: string | null }>;
}) {
  const router = useRouter();
  const mockMode = isMockDataEnabled();

  const today = new Date().toISOString().slice(0, 10);

  const [values, setValues] = useState({
    batchId: batches[0]?.id ?? "",
    title: "",
    instructions: "",
    startDate: today,
    endDate: today,
    startTime: "18:00",
    durationMinutes: 90,
    frequency: "weekly" as "daily" | "weekly",
    days: [0, 1, 2, 3, 4] as number[],
    numberTheTopics: true,
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  /**
   * Rough count so the teacher sees the scale before committing. The server
   * decides the real number — it also skips occurrences already in the past.
   */
  const estimate = useMemo(() => {
    const start = new Date(values.startDate);
    const end = new Date(values.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;

    const selected = values.frequency === "daily" ? [0, 1, 2, 3, 4, 5, 6] : values.days;
    let count = 0;

    for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      if (selected.includes(cursor.getDay())) count++;
    }

    return count;
  }, [values.startDate, values.endDate, values.frequency, values.days]);

  function toggleDay(day: number) {
    setValues((current) => ({
      ...current,
      days: current.days.includes(day) ? current.days.filter((d) => d !== day) : [...current.days, day].sort(),
    }));
  }

  async function submit() {
    if (!values.batchId) {
      setError("Choose a batch.");
      return;
    }

    if (values.title.trim().length < 3) {
      setError("Give the class series a title.");
      return;
    }

    if (values.frequency === "weekly" && values.days.length === 0) {
      setError("Choose at least one day of the week.");
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);

    try {
      if (mockMode) {
        setResult({ created: estimate, skipped: 0 });
        return;
      }

      const response = await browserRequest<{ data: { created: number; skipped_past: number } }>({
        url: "/api/v1/teacher/classes/recurring",
        method: "POST",
        data: {
          batch_id: values.batchId,
          title: values.title.trim(),
          instructions: values.instructions.trim() || null,
          start_date: values.startDate,
          end_date: values.endDate,
          start_time: values.startTime,
          duration_minutes: values.durationMinutes,
          frequency: values.frequency,
          days: values.frequency === "weekly" ? values.days : undefined,
          number_the_topics: values.numberTheTopics,
        },
        headers: { "Idempotency-Key": createIdempotencyKey("recurring-classes") },
      });

      setResult({ created: response.data.created, skipped: response.data.skipped_past });
      router.refresh();
    } catch (caught) {
      const apiError = caught as Partial<NormalizedApiError>;
      setError(apiError.message || "The schedule could not be created.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <h2 className="text-lg font-bold text-emerald-900">{result.created} classes scheduled</h2>
        <p className="mt-1 text-sm text-emerald-800">
          Zoom meetings are being created for each one. Any that fail will show a fallback prompt on the class page.
          {result.skipped > 0 ? ` ${result.skipped} occurrence(s) already in the past were skipped.` : ""}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => router.push("/teacher/classes")}
            className="h-11 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800"
          >
            View classes
          </button>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Schedule another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="grid gap-4">
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold text-slate-800">Batch</span>
          <select
            value={values.batchId}
            onChange={(event) => setValues((c) => ({ ...c, batchId: event.target.value }))}
            className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
          >
            {batches.length === 0 ? <option value="">No batches assigned to you</option> : null}
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.courseTitle ? `${batch.courseTitle} — ` : ""}{batch.title}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-sm font-semibold text-slate-800">Class title</span>
          <input
            value={values.title}
            onChange={(event) => setValues((c) => ({ ...c, title: event.target.value }))}
            className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
            placeholder="Physics evening class"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">From</span>
            <input
              type="date"
              value={values.startDate}
              onChange={(event) => setValues((c) => ({ ...c, startDate: event.target.value }))}
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Until</span>
            <input
              type="date"
              value={values.endDate}
              onChange={(event) => setValues((c) => ({ ...c, endDate: event.target.value }))}
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Start time</span>
            <input
              type="time"
              value={values.startTime}
              onChange={(event) => setValues((c) => ({ ...c, startTime: event.target.value }))}
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Duration (minutes)</span>
            <input
              type="number"
              min={10}
              max={600}
              value={values.durationMinutes}
              onChange={(event) => setValues((c) => ({ ...c, durationMinutes: Number(event.target.value) }))}
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
            />
          </label>
        </div>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold text-slate-800">Repeats</legend>
          <div className="flex gap-2">
            {(["daily", "weekly"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setValues((c) => ({ ...c, frequency: option }))}
                className={`h-10 rounded-lg border px-4 text-sm font-semibold capitalize ${
                  values.frequency === option
                    ? "border-brand-700 bg-brand-50 text-brand-800"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>

        {values.frequency === "weekly" ? (
          <div className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">On these days</span>
            <div className="flex flex-wrap gap-2">
              {weekdays.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={`h-10 w-14 rounded-lg border text-sm font-semibold ${
                    values.days.includes(day.value)
                      ? "border-brand-700 bg-brand-50 text-brand-800"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {day.short}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={values.numberTheTopics}
            onChange={(event) => setValues((c) => ({ ...c, numberTheTopics: event.target.checked }))}
            className="h-4 w-4 rounded border-slate-300"
          />
          <span className="text-sm text-slate-700">Number each class (&ldquo;… — 1&rdquo;, &ldquo;… — 2&rdquo;)</span>
        </label>

        <label className="grid gap-1.5">
          <span className="text-sm font-semibold text-slate-800">Instructions <span className="font-normal text-slate-500">(optional)</span></span>
          <textarea
            value={values.instructions}
            onChange={(event) => setValues((c) => ({ ...c, instructions: event.target.value }))}
            rows={2}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Shown to students on the class card."
          />
        </label>

        {estimate > 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            About <strong>{estimate}</strong> classes. Occurrences already in the past are skipped.
          </p>
        ) : null}

        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        <button
          type="submit"
          disabled={busy || batches.length === 0}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarRange className="h-4 w-4" />}
          Create schedule
        </button>
      </div>
    </form>
  );
}
