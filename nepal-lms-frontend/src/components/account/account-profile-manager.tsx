"use client";

import { KeyRound, Laptop, LoaderCircle, LockKeyhole, LogOut, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { AlertBox, Button, Panel, labelledFieldClass } from "@/components/ui";
import { browserRequest, createIdempotencyKey, normalizeApiError } from "@/lib/api/browser-client";
import type { ApiResponse } from "@/lib/api/contracts";
import { safeInternalPath } from "@/lib/auth/safe-return";
import type { AccountProfileData } from "@/lib/data/account";

type Notice = { tone: "success" | "danger" | "info"; title: string; message: string } | null;
const mockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
// Shared token; see fieldClass in components/ui.
const inputClass = labelledFieldClass;

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function Result({ value }: { value: Notice }) {
  if (!value) return null;
  return <AlertBox title={value.title} tone={value.tone}>{value.message}</AlertBox>;
}

function errorMessage(error: unknown): string {
  return normalizeApiError(error).message || "The request could not be completed.";
}

export function AccountProfileManager({
  initialData,
  role,
}: {
  initialData: AccountProfileData;
  role: "student" | "teacher";
}) {
  const [profile, setProfile] = useState(initialData);
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [securityBusy, setSecurityBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [sessions, setSessions] = useState(initialData.sessions);
  const identityLabel = role === "student" ? "Student ID" : "Teacher ID";
  const roleLabel = role === "student" ? "Student" : "Teacher";
  const nonCurrentSessions = useMemo(() => sessions.filter((session) => !session.current), [sessions]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (profileBusy) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const mobile = String(form.get("mobile") || "").trim();
    const email = String(form.get("email") || "").trim();
    const locale = form.get("locale") === "ne" ? "ne" : "en";
    if (name.length < 2 || mobile.length < 7 || (email && !/^\S+@\S+\.\S+$/.test(email))) {
      setNotice({ tone: "danger", title: "Profile not saved", message: "Enter a valid name, mobile number and email address." });
      return;
    }
    setProfileBusy(true);
    setNotice(null);
    try {
      if (!mockMode) {
        await browserRequest<ApiResponse<{ updated_at: string }>>({
          url: "/api/v1/account/profile",
          method: "PATCH",
          data: { name, mobile, email: email || null, locale },
          headers: { "Idempotency-Key": createIdempotencyKey("account-profile") },
        });
      }
      setProfile((value) => ({ ...value, name, mobile, email, locale }));
      setNotice({
        tone: "success",
        title: mockMode ? "Preview validated" : "Profile updated",
        message: mockMode ? "The form passed validation. Preview mode does not save changes." : "Your account details were saved securely.",
      });
    } catch (error) {
      setNotice({ tone: "danger", title: "Profile not saved", message: errorMessage(error) });
    } finally {
      setProfileBusy(false);
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordBusy) return;
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const currentPassword = String(form.get("current_password") || "");
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("password_confirmation") || "");
    if (currentPassword.length < 1 || password.length < 10 || password !== confirmation) {
      setNotice({ tone: "danger", title: "Password not updated", message: "Enter the current password, use at least 10 characters, and confirm the new password exactly." });
      return;
    }
    setPasswordBusy(true);
    setNotice(null);
    try {
      if (!mockMode) {
        await browserRequest<ApiResponse<{ sessions_revoked: number }>>({
          url: "/api/v1/account/password",
          method: "PUT",
          data: { current_password: currentPassword, password, password_confirmation: confirmation },
          headers: { "Idempotency-Key": createIdempotencyKey("account-password") },
        });
      }
      formEl.reset();
      setNotice({
        tone: "success",
        title: mockMode ? "Preview validated" : "Password updated",
        message: mockMode ? "The form passed validation. Preview mode does not change your password." : "Your password was changed. Other sessions may be revoked according to institution policy.",
      });
    } catch (error) {
      setNotice({ tone: "danger", title: "Password not updated", message: errorMessage(error) });
    } finally {
      setPasswordBusy(false);
    }
  }

  async function revokeOtherSessions() {
    if (securityBusy || nonCurrentSessions.length === 0) return;
    setSecurityBusy(true);
    setNotice(null);
    try {
      if (!mockMode) {
        await browserRequest<ApiResponse<{ revoked: number }>>({
          url: "/api/v1/account/sessions/revoke-others",
          method: "POST",
          headers: { "Idempotency-Key": createIdempotencyKey("account-sessions") },
        });
      }
      setSessions((items) => items.filter((session) => session.current));
      setNotice({ tone: "success", title: mockMode ? "Preview validated" : "Other sessions revoked", message: mockMode ? "The form passed validation. Preview mode does not sign anyone out." : "All other authenticated sessions were signed out." });
    } catch (error) {
      setNotice({ tone: "danger", title: "Sessions not revoked", message: errorMessage(error) });
    } finally {
      setSecurityBusy(false);
    }
  }

  async function startTwoFactorSetup() {
    if (securityBusy || profile.twoFactorEnabled) return;
    setSecurityBusy(true);
    setNotice(null);
    try {
      if (mockMode) {
        setNotice({ tone: "info", title: "Preview validated", message: "The setup secret is generated securely on the server and never exposed to the browser." });
        return;
      }
      const response = await browserRequest<ApiResponse<{ redirect_to?: string | null }>>({
        url: "/api/v1/account/two-factor/setup",
        method: "POST",
        headers: { "Idempotency-Key": createIdempotencyKey("account-two-factor") },
      });
      window.location.assign(safeInternalPath(response.data.redirect_to, "/two-factor-challenge?setup=1"));
    } catch (error) {
      setNotice({ tone: "danger", title: "Two-factor setup not started", message: errorMessage(error) });
    } finally {
      setSecurityBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Result value={notice} />
        <Panel>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-lg font-bold text-brand-900">{initials(profile.name)}</div>
            <div><h2 className="text-xl font-bold text-slate-950">{profile.name}</h2><p className="mt-1 text-sm text-slate-500">{identityLabel} {profile.identityCode || "Not assigned"}</p></div>
          </div>
          <form onSubmit={saveProfile} className="mt-7 grid gap-5 sm:grid-cols-2" noValidate>
            <label className="text-sm font-semibold text-slate-700">Full name<input name="name" defaultValue={profile.name} minLength={2} maxLength={120} autoComplete="name" required className={inputClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Mobile number<input name="mobile" defaultValue={profile.mobile} minLength={7} maxLength={20} autoComplete="tel" required className={inputClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Email<input name="email" type="email" defaultValue={profile.email} maxLength={190} autoComplete="email" className={inputClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Interface language<select name="locale" defaultValue={profile.locale} className={`${inputClass} bg-white`}><option value="en">English</option><option value="ne">Nepali</option></select></label>
            <div className="sm:col-span-2"><Button type="submit" disabled={profileBusy}>{profileBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4" />}{profileBusy ? "Saving…" : "Save profile"}</Button></div>
          </form>
        </Panel>
        <Panel>
          <div className="flex items-center gap-3"><LockKeyhole className="h-6 w-6 text-brand-700" /><h2 className="text-xl font-bold text-slate-950">Change password</h2></div>
          <form onSubmit={changePassword} className="mt-6 grid gap-5 sm:grid-cols-2" noValidate>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Current password<input name="current_password" type="password" autoComplete="current-password" required className={inputClass} /></label>
            <label className="text-sm font-semibold text-slate-700">New password<input name="password" type="password" minLength={10} autoComplete="new-password" required className={inputClass} /></label>
            <label className="text-sm font-semibold text-slate-700">Confirm password<input name="password_confirmation" type="password" minLength={10} autoComplete="new-password" required className={inputClass} /></label>
            <div className="sm:col-span-2"><Button type="submit" disabled={passwordBusy}>{passwordBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}{passwordBusy ? "Updating…" : "Update password"}</Button></div>
          </form>
        </Panel>
      </div>
      <aside className="space-y-6">
        <Panel>
          <div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-green-700" /><h2 className="text-lg font-bold text-slate-950">Account security</h2></div>
          <p className="mt-3 text-sm leading-6 text-slate-600">Two-factor authentication is {profile.twoFactorRequired ? `required for ${roleLabel.toLowerCase()} accounts by institution policy.` : "available as additional account protection."}</p>
          <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">Status: {profile.twoFactorEnabled ? "Enabled" : "Not enabled"}</div>
          <Button onClick={startTwoFactorSetup} disabled={securityBusy || profile.twoFactorEnabled} className="mt-5 w-full">{profile.twoFactorEnabled ? "Two-factor enabled" : "Set up two-factor authentication"}</Button>
        </Panel>
        <Panel>
          <h2 className="text-lg font-bold text-slate-950">Active sessions</h2>
          <div className="mt-5 space-y-4">{sessions.map((session) => {
            const Icon = session.device.toLowerCase().includes("mobile") ? Smartphone : Laptop;
            return <div key={session.id} className="flex gap-3"><Icon className={`h-5 w-5 shrink-0 ${session.current ? "text-brand-700" : "text-slate-500"}`} /><div><p className="text-sm font-semibold text-slate-900">{session.browser} on {session.platform}</p><p className="mt-1 text-xs text-slate-500">{session.location} · {session.lastActive}</p></div></div>;
          })}</div>
          <Button variant="outline" onClick={revokeOtherSessions} disabled={securityBusy || nonCurrentSessions.length === 0} className="mt-5 w-full"><LogOut className="h-4 w-4" />{nonCurrentSessions.length ? "Revoke other sessions" : "No other sessions"}</Button>
        </Panel>
        <AlertBox title="Identity protection" tone="info"><p>Locked identity fields and role changes require verified staff support, and every change stays in the permanent audit history.</p></AlertBox>
      </aside>
    </div>
  );
}
