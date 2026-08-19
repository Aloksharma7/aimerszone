"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, Loader2, UserPlus } from "lucide-react";
import { browserRequest, createIdempotencyKey, type NormalizedApiError } from "@/lib/api/browser-client";
import type { ApiResponse } from "@/lib/api/contracts";
import { isMockDataEnabled } from "@/lib/data/config";

const roles = [
  { value: "teacher", label: "Teacher", detail: "Runs batches, classes, attendance and assessments." },
  { value: "staff", label: "Staff", detail: "Onboards students, manages the catalogue and reviews payments." },
  { value: "admin", label: "Admin", detail: "Day-to-day operations. Not settings, integrations or role management." },
  { value: "super_admin", label: "Super Admin", detail: "Full control including settings, roles and integrations. Only a Super Admin can grant this." },
  { value: "student", label: "Student", detail: "Learner account. Normally created by the enrollment office." },
];

type Created = { id: string; staffCode: string | null; temporaryPassword: string | null };

/**
 * Creates a staff account.
 *
 * Students arrive through the enrollment office, but teachers, accountants and
 * officers had no creation path at all — the institution could not be staffed
 * without direct database access.
 *
 * The administrator never chooses a lasting password. Either a reset link is
 * emailed, or a one-time temporary password is shown once and the account is
 * flagged to change it at first sign-in.
 */
export function CreateUserForm() {
  const router = useRouter();
  const mockMode = isMockDataEnabled();

  const [values, setValues] = useState({
    name: "",
    email: "",
    mobile: "",
    primaryRole: "teacher",
    passwordSetupMethod: "link" as "link" | "temporary",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);

  function update<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function validate(): string | null {
    if (values.name.trim().length < 2) return "Enter the person's full name.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email.trim())) return "Enter a valid email address.";
    if (values.passwordSetupMethod === "link" && !values.email.trim()) {
      return "A reset link needs an email address. Choose a temporary password instead.";
    }
    return null;
  }

  async function submit() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      if (mockMode) {
        setCreated({ id: "preview", staffCode: "TEA-0001", temporaryPassword: values.passwordSetupMethod === "temporary" ? "Preview-Pass-1" : null });
        return;
      }

      const response = await browserRequest<ApiResponse<{ id: string; staff_code?: string; temporary_password?: string }>>({
        url: "/api/v1/admin/users",
        method: "POST",
        data: {
          name: values.name.trim(),
          email: values.email.trim().toLowerCase(),
          mobile: values.mobile.trim() || null,
          primary_role: values.primaryRole,
          password_setup_method: values.passwordSetupMethod,
        },
        headers: { "Idempotency-Key": createIdempotencyKey("admin-create-user") },
      });

      setCreated({
        id: response.data.id,
        staffCode: response.data.staff_code ?? null,
        temporaryPassword: response.data.temporary_password ?? null,
      });

      router.refresh();
    } catch (caught) {
      const apiError = caught as Partial<NormalizedApiError>;
      setError(apiError.message || "The account could not be created.");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <h2 className="text-lg font-bold text-emerald-900">Account created</h2>
        <p className="mt-1 text-sm text-emerald-800">
          {created.staffCode ? `Staff code ${created.staffCode}. ` : ""}
          The account must change its password at first sign-in.
        </p>

        {created.temporaryPassword ? (
          <div className="mt-4 rounded-xl border border-emerald-300 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Temporary password — shown once</p>
            <div className="mt-2 flex items-center gap-3">
              <code className="flex-1 rounded-lg bg-slate-900 px-3 py-2 font-mono text-sm text-white">{created.temporaryPassword}</code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(created.temporaryPassword as string);
                  setCopied(true);
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Copy className="h-4 w-4" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              This is not recoverable. Hand it over directly, and if it is lost, send a password reset instead.
            </p>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-emerald-300 bg-white px-4 py-3 text-sm text-slate-700">
            A password reset link has been emailed to {values.email}.
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setCreated(null);
              setCopied(false);
              setValues({ name: "", email: "", mobile: "", primaryRole: "teacher", passwordSetupMethod: "link" });
            }}
            className="h-11 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Create another
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/users")}
            className="h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to users
          </button>
        </div>
      </div>
    );
  }

  const selectedRole = roles.find((role) => role.value === values.primaryRole);

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
          <span className="text-sm font-semibold text-slate-800">Full name</span>
          <input
            value={values.name}
            onChange={(event) => update("name", event.target.value)}
            className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
            placeholder="Sita Sharma"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Email</span>
            <input
              type="email"
              value={values.email}
              onChange={(event) => update("email", event.target.value)}
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
              placeholder="sita@example.com"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Mobile <span className="font-normal text-slate-500">(optional)</span></span>
            <input
              value={values.mobile}
              onChange={(event) => update("mobile", event.target.value)}
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
              placeholder="98XXXXXXXX"
            />
          </label>
        </div>

        <label className="grid gap-1.5">
          <span className="text-sm font-semibold text-slate-800">Role</span>
          <select
            value={values.primaryRole}
            onChange={(event) => update("primaryRole", event.target.value)}
            className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
          >
            {roles.map((role) => (
              <option key={role.value} value={role.value}>{role.label}</option>
            ))}
          </select>
          {selectedRole ? <span className="text-xs text-slate-500">{selectedRole.detail}</span> : null}
        </label>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold text-slate-800">How should they set their password?</legend>
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
            <input
              type="radio"
              checked={values.passwordSetupMethod === "link"}
              onChange={() => update("passwordSetupMethod", "link")}
              className="mt-1 h-4 w-4"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">Email a reset link</span>
              <span className="block text-xs text-slate-500">Preferred. Nobody else ever sees the password.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
            <input
              type="radio"
              checked={values.passwordSetupMethod === "temporary"}
              onChange={() => update("passwordSetupMethod", "temporary")}
              className="mt-1 h-4 w-4"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">Show a temporary password once</span>
              <span className="block text-xs text-slate-500">For handing over in person. Not recoverable afterwards.</span>
            </span>
          </label>
        </fieldset>

        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Create account
        </button>
      </div>
    </form>
  );
}
