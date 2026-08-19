"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Loader2, Lock, Save, ShieldCheck } from "lucide-react";
import type { AdminPermission } from "@/lib/data/admin";
import type { RoleDefinition } from "@/types/lms";
import { browserRequest, createIdempotencyKey, type NormalizedApiError } from "@/lib/api/browser-client";
import { isMockDataEnabled } from "@/lib/data/config";

/**
 * The role matrix above this is read-only by design. This is the only place
 * that can actually change what a role can do — Laravel is still the final
 * authority: every save goes through the same validated, audited PATCH the
 * matrix's own warning text describes.
 */
export function RoleEditor({ roles, permissions }: { roles: RoleDefinition[]; permissions: AdminPermission[] }) {
  const router = useRouter();
  const mockMode = isMockDataEnabled();

  const editableRoles = roles.filter((role) => role.key !== "super_admin");
  const [selectedId, setSelectedId] = useState<string | null>(editableRoles[0]?.id ?? null);
  const selected = roles.find((role) => role.id === selectedId) ?? null;
  const locked = selected ? selected.key === "super_admin" : false;

  const [name, setName] = useState(selected?.name ?? "");
  const [description, setDescription] = useState(selected?.description ?? "");
  const [checked, setChecked] = useState<Set<string>>(new Set(selected?.permissions ?? []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const groups = new Map<string, AdminPermission[]>();
    for (const permission of permissions) {
      const bucket = groups.get(permission.group) ?? [];
      bucket.push(permission);
      groups.set(permission.group, bucket);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  function select(role: RoleDefinition) {
    setSelectedId(role.id);
    setName(role.name);
    setDescription(role.description);
    setChecked(new Set(role.permissions));
    setError(null);
    setNotice(null);
  }

  function toggle(key: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    if (!selected || locked || busy) return;
    if (name.trim().length < 3) {
      setError("Enter a role name of at least three characters.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (mockMode) {
        setNotice("Preview mode: the role was not saved.");
        return;
      }

      await browserRequest({
        url: `/api/v1/admin/roles/${encodeURIComponent(selected.id)}`,
        method: "PATCH",
        data: { name: name.trim(), description: description.trim() || null, permissions: [...checked] },
        headers: { "Idempotency-Key": createIdempotencyKey("role-update") },
      });

      setNotice("Role updated.");
      router.refresh();
    } catch (caught) {
      const apiError = caught as Partial<NormalizedApiError>;
      setError(apiError.message || "The role could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
      <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
        {roles.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => select(role)}
            className={`shrink-0 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
              role.id === selectedId ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span className="flex items-center gap-1.5">
              {role.key === "super_admin" ? <Lock className="h-3.5 w-3.5" /> : null}
              {role.name}
            </span>
            <span className="mt-0.5 block text-xs font-normal text-slate-500">{role.users} {role.users === 1 ? "user" : "users"}</span>
          </button>
        ))}
      </nav>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        {!selected ? (
          <p className="text-sm text-slate-500">Select a role to edit.</p>
        ) : locked ? (
          <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <p>Super Admin always holds every permission by design (enforced directly in the authorization layer, not by this list) and cannot be edited here.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-sm font-semibold text-slate-800">Role name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} className="h-11 rounded-lg border border-slate-300 px-3 text-sm" />
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm font-semibold text-slate-800">Description</span>
                <input value={description} onChange={(event) => setDescription(event.target.value)} className="h-11 rounded-lg border border-slate-300 px-3 text-sm" />
              </label>
            </div>

            <div className="mt-5 grid gap-4">
              {grouped.map(([group, items]) => (
                <fieldset key={group} className="rounded-xl border border-slate-200 p-4">
                  <legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">{group}</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {items.map((permission) => (
                      <label key={permission.id} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked.has(permission.key)}
                          onChange={() => toggle(permission.key)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300"
                        />
                        <span>
                          <span className="block font-medium text-slate-800">{permission.key}</span>
                          {permission.description ? <span className="block text-xs text-slate-500">{permission.description}</span> : null}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>

            {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
            {notice ? <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p> : null}

            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </button>
          </>
        )}
      </div>
    </div>
  );
}
