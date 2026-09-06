"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { browserRequest, createIdempotencyKey, type NormalizedApiError } from "@/lib/api/browser-client";
import { isMockDataEnabled } from "@/lib/data/config";
import { useToast } from "@/providers/toast-provider";

export type SyllabusLesson = { id: string | null; title: string; type: string };
export type SyllabusModule = { id: string | null; title: string; summary: string; lessons: SyllabusLesson[] };

const lessonTypes = ["Lesson", "Live class", "Recording", "Reading", "Test", "Assignment"];

/**
 * Builds the course syllabus.
 *
 * Courses could be created and published, but modules and lessons had no write
 * path at all, so every student's syllabus tab was permanently empty.
 *
 * The whole structure is saved in one call. Existing ids are sent back with it,
 * which is what lets the API keep lesson rows across a reorder — and with them,
 * every student's completion record.
 */
export function SyllabusBuilder({
  courseId,
  courseTitle,
  initialModules,
  endpointBase = "/api/v1/admin/courses",
}: {
  courseId: string;
  courseTitle: string;
  initialModules: SyllabusModule[];
  endpointBase?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const mockMode = isMockDataEnabled();

  const [modules, setModules] = useState<SyllabusModule[]>(initialModules);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function updateModule(index: number, patch: Partial<SyllabusModule>) {
    setModules((current) => current.map((module, i) => (i === index ? { ...module, ...patch } : module)));
  }

  function updateLesson(moduleIndex: number, lessonIndex: number, patch: Partial<SyllabusLesson>) {
    setModules((current) =>
      current.map((module, i) =>
        i === moduleIndex
          ? { ...module, lessons: module.lessons.map((lesson, j) => (j === lessonIndex ? { ...lesson, ...patch } : lesson)) }
          : module,
      ),
    );
  }

  function moveModule(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= modules.length) return;

    setModules((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    const empty = modules.find((module) => module.title.trim().length < 2);
    if (empty) {
      setError("Every module needs a title.");
      return;
    }

    const emptyLesson = modules.flatMap((m) => m.lessons).find((lesson) => lesson.title.trim().length < 2);
    if (emptyLesson) {
      setError("Every lesson needs a title. Remove any blank rows.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (mockMode) {
        setNotice("Preview mode: nothing was saved.");
        return;
      }

      await browserRequest({
        url: `${endpointBase}/${encodeURIComponent(courseId)}/syllabus`,
        method: "PUT",
        data: {
          modules: modules.map((module) => ({
            // Sending the id back is what preserves student progress on reorder.
            id: module.id,
            title: module.title.trim(),
            summary: module.summary.trim() || null,
            lessons: module.lessons.map((lesson) => ({
              id: lesson.id,
              title: lesson.title.trim(),
              type: lesson.type,
            })),
          })),
        },
        headers: { "Idempotency-Key": createIdempotencyKey("syllabus-save") },
      });

      setNotice("Syllabus saved. Students see it immediately.");
      toast({ tone: "success", title: "Syllabus saved", message: "Students see it immediately." });
      router.refresh();
    } catch (caught) {
      const apiError = caught as Partial<NormalizedApiError>;
      const message = apiError.message || "The syllabus could not be saved.";
      setError(message);
      toast({ tone: "danger", title: "Could not save syllabus", message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-slate-600">
        Syllabus for <strong>{courseTitle}</strong>. Modules appear in this order on the student&apos;s course page.
      </p>

      {modules.map((module, moduleIndex) => (
        <section key={moduleIndex} className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <div className="flex shrink-0 flex-col gap-1">
              <button
                type="button"
                onClick={() => moveModule(moduleIndex, -1)}
                disabled={moduleIndex === 0}
                className="h-7 w-7 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                aria-label="Move module up"
              >
                <ChevronUp className="mx-auto h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => moveModule(moduleIndex, 1)}
                disabled={moduleIndex === modules.length - 1}
                className="h-7 w-7 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                aria-label="Move module down"
              >
                <ChevronDown className="mx-auto h-4 w-4" />
              </button>
            </div>

            <div className="grid flex-1 gap-2">
              <input
                value={module.title}
                onChange={(event) => updateModule(moduleIndex, { title: event.target.value })}
                className="h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold"
                placeholder={`Module ${moduleIndex + 1} title`}
              />
              <input
                value={module.summary}
                onChange={(event) => updateModule(moduleIndex, { summary: event.target.value })}
                className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
                placeholder="Short summary (optional)"
              />
            </div>

            <button
              type="button"
              onClick={() => setModules((current) => current.filter((_, i) => i !== moduleIndex))}
              aria-label={`Remove module ${moduleIndex + 1}`}
              className="h-9 shrink-0 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4">
            {module.lessons.map((lesson, lessonIndex) => (
              <div key={lessonIndex} className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-xs font-semibold text-slate-400">{lessonIndex + 1}</span>
                <input
                  value={lesson.title}
                  onChange={(event) => updateLesson(moduleIndex, lessonIndex, { title: event.target.value })}
                  className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-sm"
                  placeholder="Lesson title"
                />
                <select
                  value={lesson.type}
                  onChange={(event) => updateLesson(moduleIndex, lessonIndex, { type: event.target.value })}
                  className="h-10 shrink-0 rounded-lg border border-slate-300 px-2 text-sm"
                >
                  {lessonTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    updateModule(moduleIndex, { lessons: module.lessons.filter((_, j) => j !== lessonIndex) })
                  }
                  className="h-10 w-10 shrink-0 rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-50"
                  aria-label="Remove lesson"
                >
                  <Trash2 className="mx-auto h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                updateModule(moduleIndex, { lessons: [...module.lessons, { id: null, title: "", type: "Lesson" }] })
              }
              className="mt-1 inline-flex h-10 w-fit items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" /> Add lesson
            </button>
          </div>
        </section>
      ))}

      <button
        type="button"
        onClick={() => setModules((current) => [...current, { id: null, title: "", summary: "", lessons: [] }])}
        className="inline-flex h-11 w-fit items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        <Plus className="h-4 w-4" /> Add module
      </button>

      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}

      <div>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-700 px-6 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save syllabus
        </button>
      </div>
    </div>
  );
}
