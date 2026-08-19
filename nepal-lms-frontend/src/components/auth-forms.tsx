"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import { useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui";
import { browserRequest, normalizeApiError, type NormalizedApiError } from "@/lib/api/browser-client";
import type { ApiResponse, AuthenticatedUser } from "@/lib/api/contracts";
import { safeInternalPath } from "@/lib/auth/safe-return";
import { cn } from "@/lib/utils";

const previewRoles = [
  { label: "Student", path: "/student/dashboard" },
  { label: "Teacher", path: "/teacher/dashboard" },
  { label: "Staff", path: "/staff/dashboard" },
  { label: "Admin", path: "/admin/dashboard" },
  { label: "Super Admin", path: "/admin/dashboard" },
];

const mockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

/**
 * Portal prefixes and the machine role that may open them.
 *
 * Used to decide whether a returnTo path is meaningful for the person who has
 * just signed in.
 */
const portalOwners: Array<{ prefix: string; role: string }> = [
  { prefix: "/student", role: "student" },
  { prefix: "/teacher", role: "teacher" },
  { prefix: "/staff", role: "staff" },
  { prefix: "/accounting", role: "staff" },
  { prefix: "/admin", role: "admin" },
];

export function authDestination(auth: AuthenticatedUser, requested?: string | null): string {
  if (auth.required_action === "change_password") return "/change-password";
  if (auth.required_action === "two_factor_challenge") return "/two-factor-challenge";
  if (auth.required_action === "verify_email") return "/verify-email";

  const requestedPath = safeInternalPath(requested, "");
  const home = safeInternalPath(auth.portal_home, "/unauthorized");

  if (!requestedPath) return home;

  /*
   * A returnTo left over from a previous session must not decide where a
   * different person lands.
   *
   * Signing out of a student account and back in as an administrator left
   * ?returnTo=/student/... on the login URL, so the admin was sent into the
   * student portal. Honour the requested path only when this account's own
   * roles actually include that portal — not just "can reach it anyway",
   * since admin/super_admin can open every portal once signed in, which
   * previously meant this check never rejected anything for them. That is a
   * live-session navigation privilege, not a reason to auto-land somewhere
   * else's dashboard after login.
   */
  const owner = portalOwners.find(({ prefix }) => requestedPath === prefix || requestedPath.startsWith(`${prefix}/`));

  if (!owner) return requestedPath;

  return auth.roles.includes(owner.role) ? requestedPath : home;
}

function ErrorMessage({ error }: { error: NormalizedApiError | null }) {
  if (!error) return null;
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <p className="font-semibold">{error.message}</p>
      {error.requestId ? <p className="mt-1 text-xs text-red-700">Reference: {error.requestId}</p> : null}
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [selectedRole, setSelectedRole] = useState(previewRoles[0].path);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      if (mockMode) {
        router.push(selectedRole);
        return;
      }
      await browserRequest({
        url: "/api/v1/auth/login",
        method: "POST",
        data: {
          identifier: String(form.get("identifier") || "").trim(),
          password: String(form.get("password") || ""),
          remember: form.get("remember") === "on",
        },
      });
      const response = await browserRequest<ApiResponse<AuthenticatedUser>>({ url: "/api/v1/auth/me", method: "GET" });
      window.location.assign(authDestination(response.data, searchParams.get("returnTo")));
    } catch (caught) {
      setError(normalizeApiError(caught));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-7 space-y-5" noValidate>
      <label className="block text-sm font-semibold text-slate-700">
        Phone number or email
        <span className="relative mt-2 flex items-center">
          <Mail className="pointer-events-none absolute left-3 h-5 w-5 text-slate-400" />
          <input name="identifier" className="h-12 w-full rounded-lg border border-slate-300 pl-11 pr-3 font-normal outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="98XXXXXXXX or name@example.com" autoComplete="username" maxLength={190} required />
        </span>
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Password
        <span className="relative mt-2 flex items-center">
          <LockKeyhole className="pointer-events-none absolute left-3 h-5 w-5 text-slate-400" />
          <input name="password" type={showPassword ? "text" : "password"} className="h-12 w-full rounded-lg border border-slate-300 pl-11 pr-12 font-normal outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="Enter your password" autoComplete="current-password" required />
          <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
        </span>
      </label>
      <div className="flex items-center justify-between gap-4 text-sm">
        <label className="flex items-center gap-2 font-medium text-slate-600"><input name="remember" type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-brand-700" />Remember me</label>
        <Link href="/forgot-password" className="font-semibold text-brand-700 hover:text-brand-900">Forgot password?</Link>
      </div>
      {mockMode ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-800">Local preview</p>
          <p className="mt-1 text-xs leading-5 text-blue-700">Choose a role only while mock data is enabled. This selector is removed from production mode.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {previewRoles.map((role) => <button key={role.path} type="button" onClick={() => setSelectedRole(role.path)} className={cn("rounded-lg border px-3 py-2 text-left text-xs font-semibold transition", selectedRole === role.path ? "border-brand-700 bg-white text-brand-800 ring-2 ring-brand-100" : "border-blue-200 bg-blue-50 text-slate-600 hover:bg-white")}>{role.label}</button>)}
          </div>
        </div>
      ) : null}
      <ErrorMessage error={error} />
      <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? "Signing in…" : "Login"}</Button>
      <p className="text-center text-sm text-slate-600">New student? <Link href="/register" className="font-bold text-brand-700">Create an account</Link></p>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const passwordConfirmation = String(form.get("password_confirmation") || "");
    if (password !== passwordConfirmation) {
      setError({ status: 422, code: "validation_failed", message: "The password confirmation does not match.", retryable: false });
      setLoading(false);
      return;
    }

    try {
      if (mockMode) {
        router.push("/student/dashboard");
        return;
      }
      await browserRequest({
        url: "/api/v1/auth/register",
        method: "POST",
        data: {
          name: String(form.get("name") || "").trim(),
          mobile: String(form.get("mobile") || "").trim(),
          email: String(form.get("email") || "").trim() || null,
          password,
          password_confirmation: passwordConfirmation,
          preferred_language: String(form.get("language") || "en"),
          terms_accepted: form.get("terms") === "on",
          recording_policy_acknowledged: form.get("recording_policy") === "on",
        },
      });
      const response = await browserRequest<ApiResponse<AuthenticatedUser>>({ url: "/api/v1/auth/me", method: "GET" });
      window.location.assign(authDestination(response.data));
    } catch (caught) {
      setError(normalizeApiError(caught));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-7 grid gap-5 sm:grid-cols-2" noValidate>
      <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Full name<span className="text-red-600"> *</span><span className="relative mt-2 flex"><UserRound className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-slate-400" /><input name="name" className="h-12 w-full rounded-lg border border-slate-300 pl-11 pr-3 font-normal outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="Your full name" minLength={2} maxLength={120} autoComplete="name" required /></span></label>
      <label className="text-sm font-semibold text-slate-700">Mobile number<span className="text-red-600"> *</span><span className="relative mt-2 flex"><Phone className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-slate-400" /><input name="mobile" className="h-12 w-full rounded-lg border border-slate-300 pl-11 pr-3 font-normal outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="98XXXXXXXX" minLength={7} maxLength={20} autoComplete="tel" required /></span></label>
      <label className="text-sm font-semibold text-slate-700">Email <span className="font-normal text-slate-400">(optional)</span><span className="relative mt-2 flex"><Mail className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-slate-400" /><input name="email" type="email" className="h-12 w-full rounded-lg border border-slate-300 pl-11 pr-3 font-normal outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="name@example.com" autoComplete="email" /></span></label>
      <label className="text-sm font-semibold text-slate-700">Password<span className="text-red-600"> *</span><input name="password" type="password" className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="At least 8 characters" minLength={8} autoComplete="new-password" required /></label>
      <label className="text-sm font-semibold text-slate-700">Confirm password<span className="text-red-600"> *</span><input name="password_confirmation" type="password" className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" placeholder="Repeat password" minLength={8} autoComplete="new-password" required /></label>
      <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Preferred interface language<select name="language" className="mt-2 h-12 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal outline-none focus:border-brand-600"><option value="en">English</option><option value="ne">Nepali</option></select></label>
      <label className="flex items-start gap-3 text-sm leading-6 text-slate-600 sm:col-span-2"><input name="terms" type="checkbox" className="mt-1 h-4 w-4 shrink-0 rounded accent-brand-700" required /><span>I agree to the <Link href="/terms" className="font-semibold text-brand-700">Terms</Link> and <Link href="/privacy" className="font-semibold text-brand-700">Privacy Notice</Link>.</span></label>
      <label className="flex items-start gap-3 text-sm leading-6 text-slate-600 sm:col-span-2"><input name="recording_policy" type="checkbox" className="mt-1 h-4 w-4 shrink-0 rounded accent-brand-700" /><span>I have read the <Link href="/recording-policy" className="font-semibold text-brand-700">Recording Policy</Link>.</span></label>
      <div className="sm:col-span-2"><ErrorMessage error={error} /><Button type="submit" size="lg" className="mt-4 w-full" disabled={loading}>{loading ? "Creating account…" : "Create student account"}</Button><p className="mt-4 text-center text-sm text-slate-600">Already registered? <Link href="/login" className="font-bold text-brand-700">Login</Link></p></div>
    </form>
  );
}

export function SimpleAuthForm({ type }: { type: "forgot" | "reset" | "two-factor" | "change" | "verify" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const config = {
    forgot: { title: "Reset your password", description: "Enter your phone number or email. If recovery is available, instructions will be sent.", button: "Send recovery instructions" },
    reset: { title: "Create a new password", description: "Use a strong password that you do not reuse on other services.", button: "Save new password" },
    "two-factor": { title: "Two-factor verification", description: "Enter the current code from your authenticator or an approved recovery code.", button: "Verify and continue" },
    change: { title: "Change required password", description: "Your account must use a new password before the workspace can load.", button: "Change password" },
    verify: { title: "Verify your email", description: "Open the verification message or request another email.", button: "Resend verification email" },
  }[type];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    const form = new FormData(event.currentTarget);
    try {
      if (mockMode) {
        router.push(safeInternalPath(searchParams.get("returnTo"), "/student/dashboard"));
        return;
      }
      if (type === "forgot") {
        await browserRequest({ url: "/api/v1/auth/forgot-password", method: "POST", data: { identifier: String(form.get("identifier") || "").trim() } });
        setSuccess("If the account can be recovered, instructions have been sent.");
      } else if (type === "two-factor") {
        await browserRequest({ url: "/api/v1/auth/two-factor-challenge", method: "POST", data: { code: String(form.get("code") || "").trim(), recovery_code: String(form.get("recovery_code") || "").trim() || null } });
        const me = await browserRequest<ApiResponse<AuthenticatedUser>>({ url: "/api/v1/auth/me" });
        window.location.assign(authDestination(me.data, searchParams.get("returnTo")));
      } else if (type === "verify") {
        await browserRequest({ url: "/api/v1/auth/email/verification-notification", method: "POST" });
        setSuccess("A new verification message has been sent.");
      } else {
        const password = String(form.get("password") || "");
        const confirmation = String(form.get("password_confirmation") || "");
        if (password !== confirmation) {
          setError({ status: 422, code: "validation_failed", message: "The password confirmation does not match.", retryable: false });
          return;
        }
        const endpoint = type === "reset" ? "/api/v1/auth/reset-password" : "/api/v1/auth/change-password";
        await browserRequest({
          url: endpoint,
          method: "POST",
          data: type === "reset"
            ? { token: searchParams.get("token"), email: searchParams.get("email"), password, password_confirmation: confirmation }
            : { current_password: String(form.get("current_password") || ""), password, password_confirmation: confirmation },
        });
        window.location.assign(safeInternalPath(searchParams.get("returnTo"), "/login"));
      }
    } catch (caught) {
      setError(normalizeApiError(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><ShieldCheck className="h-6 w-6" /></div><h1 className="mt-5 text-2xl font-bold text-slate-950">{config.title}</h1><p className="mt-2 text-sm leading-6 text-slate-600">{config.description}</p><form ref={formRef} onSubmit={handleSubmit} className="mt-7 space-y-5" noValidate>{type === "forgot" ? <label className="block text-sm font-semibold text-slate-700">Phone or email<input name="identifier" className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-brand-600" placeholder="98XXXXXXXX or name@example.com" maxLength={190} required /></label> : type === "two-factor" ? <><label className="block text-sm font-semibold text-slate-700">Verification code<input name="code" inputMode="numeric" autoComplete="one-time-code" className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 text-center text-lg font-bold tracking-[.45em] outline-none focus:border-brand-600" placeholder="000000" /></label><label className="block text-sm font-semibold text-slate-700">Recovery code <span className="font-normal text-slate-400">(optional)</span><input name="recovery_code" className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-brand-600" /></label></> : type === "verify" ? null : <>{type === "change" ? <label className="block text-sm font-semibold text-slate-700">Current or temporary password<input name="current_password" type="password" className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-brand-600" autoComplete="current-password" required /></label> : null}<label className="block text-sm font-semibold text-slate-700">New password<input name="password" type="password" minLength={8} className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-brand-600" autoComplete="new-password" required /></label><label className="block text-sm font-semibold text-slate-700">Confirm password<input name="password_confirmation" type="password" minLength={8} className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-brand-600" autoComplete="new-password" required /></label></>}<ErrorMessage error={error} />{success ? <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">{success}</div> : null}<Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? "Please wait…" : config.button}</Button><ButtonLink href="/login" variant="ghost" className="w-full">Back to login</ButtonLink></form></div>
  );
}
