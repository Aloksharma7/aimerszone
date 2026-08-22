"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import type { AdminCategory } from "@/lib/data/admin";
import { browserRequest, createIdempotencyKey, type NormalizedApiError } from "@/lib/api/browser-client";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { refreshPublicCatalogue } from "@/lib/catalogue-cache";
import { isMockDataEnabled } from "@/lib/data/config";

type Draft = { id: string | null; name: string; description: string; isActive: boolean };

const emptyDraft: Draft = { id: null, name: "", description: "", isActive: true };

/**
 * Course categories had no management surface anywhere, which blocked course
 * creation entirely on a fresh install: the course form requires a category and
 * the dropdown could never be filled.
 */
export function CategoryManager({ categories, endpointBase = "/api/v1/admin/categories" }: { categories: AdminCategory[]; endpointBase?: string }) {
  const router = useRouter();
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
    if (draft.name.trim().length < 2) {
      setError("Enter a category name of at least two characters.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (mockMode) {
        setNotice("Preview mode: the category was not saved.");
        return;
      }

      await browserRequest({
        url: editing ? `${endpointBase}/${encodeURIComponent(draft.id as string)}` : endpointBase,
        method: editing ? "PATCH" : "POST",
        data: {
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          is_active: draft.isActive,
        },
        headers: { "Idempotency-Key": createIdempotencyKey(`category-${editing ? "update" : "create"}`) },
      });

      setNotice(editing ? "Category updated." : "Category created.");
      reset();
      await refreshPublicCatalogue({ tags: ["public-categories", "public-courses"] });
      router.refresh();
    } catch (caught) {
      const apiError = caught as Partial<NormalizedApiError>;
      setError(apiError.message || "The category could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(category: AdminCategory) {
    if (mockMode) {
      setNotice("Preview mode: nothing was deleted.");
      return;
    }

    try {
      await browserRequest({ url: `${endpointBase}/${encodeURIComponent(category.id)}`, method: "DELETE" });
      setNotice("Category deleted.");
      await refreshPublicCatalogue({ tags: ["public-categories", "public-courses"] });
      router.refresh();
    } catch (caught) {
      const apiError = caught as Partial<NormalizedApiError>;
      setError(apiError.message || "The category could not be deleted.");
      throw caught;
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Courses</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {categories.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                  No categories yet. Create the first one to start building the catalogue.
                </td>
              </tr>
            ) : (
              categories.map((category) => (
                <tr key={category.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{category.name}</p>
                    <p className="text-xs text-slate-500">{category.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{category.courseCount}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${category.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {category.isActive ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setDraft({ id: category.id, name: category.name, description: category.description || "", isActive: category.isActive })}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      {category.courseCount > 0 ? (
                        <button
                          type="button"
                          disabled
                          title={`Move ${category.courseCount} course(s) first, or deactivate it instead.`}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      ) : (
                        <ConfirmAction
                          label="Delete"
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                          title={`Delete the category "${category.name}"?`}
                          confirmLabel="Delete category"
                          onConfirm={() => remove(category)}
                        />
                      )}
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
          // Enter should save, as it does in every other form here.
          event.preventDefault();
          void submit();
        }}
      >
        <h2 className="text-base font-bold text-slate-950">{editing ? "Edit category" : "New category"}</h2>
        <p className="mt-1 text-sm text-slate-600">Categories group courses on the public catalogue.</p>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Name</span>
            <input
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
              placeholder="Management"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Description</span>
            <textarea
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              rows={3}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Shown under the category heading on the catalogue."
            />
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">Visible on the public catalogue</span>
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
              {editing ? "Save changes" : "Create category"}
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
