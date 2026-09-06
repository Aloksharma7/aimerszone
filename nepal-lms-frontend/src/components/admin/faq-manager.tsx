"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import type { AdminFaq } from "@/lib/data/admin";
import { browserRequest, createIdempotencyKey, type NormalizedApiError } from "@/lib/api/browser-client";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { refreshPublicCatalogue } from "@/lib/catalogue-cache";
import { isMockDataEnabled } from "@/lib/data/config";
import { useToast } from "@/providers/toast-provider";

type Draft = { id: string | null; question: string; answer: string; category: string; isPublished: boolean };

const emptyDraft: Draft = { id: null, question: "", answer: "", category: "general", isPublished: true };

/**
 * FAQs were readable on the public site and the student support page, but
 * the only way one ever existed was a one-time demo seeder — no screen
 * anywhere could add, edit or remove a question after launch.
 */
export function FaqManager({ faqs }: { faqs: AdminFaq[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const mockMode = isMockDataEnabled();

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const editing = draft.id !== null;

  function reset() {
    setDraft(emptyDraft);
    setError(null);
  }

  async function submit() {
    if (draft.question.trim().length < 5) {
      setError("Enter a question of at least five characters.");
      return;
    }
    if (draft.answer.trim().length < 5) {
      setError("Enter an answer of at least five characters.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (mockMode) {
        setNotice("Preview mode: the FAQ was not saved.");
        return;
      }

      await browserRequest({
        url: editing ? `/api/v1/admin/faqs/${encodeURIComponent(draft.id as string)}` : "/api/v1/admin/faqs",
        method: editing ? "PATCH" : "POST",
        data: {
          question: draft.question.trim(),
          answer: draft.answer.trim(),
          category: draft.category.trim() || "general",
          is_published: draft.isPublished,
        },
        headers: { "Idempotency-Key": createIdempotencyKey(`faq-${editing ? "update" : "create"}`) },
      });

      const message = editing ? "FAQ updated." : "FAQ created.";
      setNotice(message);
      toast({ tone: "success", title: message });
      reset();
      await refreshPublicCatalogue({ tags: ["public-faqs"] });
      router.refresh();
    } catch (caught) {
      const apiError = caught as Partial<NormalizedApiError>;
      const message = apiError.message || "The FAQ could not be saved.";
      setError(message);
      toast({ tone: "danger", title: "Could not save FAQ", message });
    } finally {
      setBusy(false);
    }
  }

  async function remove(faq: AdminFaq) {
    if (mockMode) {
      setNotice("Preview mode: nothing was deleted.");
      return;
    }

    try {
      await browserRequest({ url: `/api/v1/admin/faqs/${encodeURIComponent(faq.id)}`, method: "DELETE" });
      setNotice("FAQ deleted.");
      toast({ tone: "success", title: "FAQ deleted." });
      await refreshPublicCatalogue({ tags: ["public-faqs"] });
      router.refresh();
    } catch (caught) {
      const apiError = caught as Partial<NormalizedApiError>;
      const message = apiError.message || "The FAQ could not be deleted.";
      setError(message);
      toast({ tone: "danger", title: "Could not delete FAQ", message });
      throw caught;
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Question</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {faqs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                  No FAQs yet. Create the first one to populate the public FAQ page.
                </td>
              </tr>
            ) : (
              faqs.map((faq) => (
                <tr key={faq.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{faq.question}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-slate-500">{faq.answer}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{faq.category}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${faq.isPublished ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {faq.isPublished ? "Published" : "Hidden"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setDraft({ id: faq.id, question: faq.question, answer: faq.answer, category: faq.category, isPublished: faq.isPublished })}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <ConfirmAction
                        label="Delete"
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        title={`Delete "${faq.question}"?`}
                        confirmLabel="Delete FAQ"
                        onConfirm={() => remove(faq)}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <form
        className="h-fit rounded-2xl border border-slate-200 bg-white p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <h2 className="text-base font-bold text-slate-950">{editing ? "Edit FAQ" : "New FAQ"}</h2>
        <p className="mt-1 text-sm text-slate-600">Shown on the public FAQ page and the student support page.</p>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Question</span>
            <input
              value={draft.question}
              onChange={(event) => setDraft((current) => ({ ...current, question: event.target.value }))}
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
              placeholder="What is the refund policy?"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Answer</span>
            <textarea
              value={draft.answer}
              onChange={(event) => setDraft((current) => ({ ...current, answer: event.target.value }))}
              rows={4}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Answer shown to students and visitors."
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Category</span>
            <input
              value={draft.category}
              onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
              placeholder="general"
            />
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.isPublished}
              onChange={(event) => setDraft((current) => ({ ...current, isPublished: event.target.checked }))}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">Visible on the public site</span>
          </label>

          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          {notice ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p> : null}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {editing ? "Save changes" : "Create FAQ"}
            </button>
            {editing ? (
              <button type="button" onClick={reset} className="h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      </form>
    </div>
  );
}
