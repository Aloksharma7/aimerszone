"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, LoaderCircle, LockKeyhole, Save, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { AlertBox, Button, Panel, StatusBadge, fieldClass } from "@/components/ui";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { browserRequest, createIdempotencyKey, type NormalizedApiError } from "@/lib/api/browser-client";
import type { ApiResponse } from "@/lib/api/contracts";
import type { AdminUser } from "@/types/lms";

const mockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
// Shared token; see fieldClass in components/ui.
const inputClass = fieldClass;

function Notice({ value }: { value: { tone: "success" | "danger"; title: string; message: string } | null }) {
  return value ? <AlertBox title={value.title} tone={value.tone}>{value.message}</AlertBox> : null;
}

export function UserProfileEditor({ userId, user }: { userId: string; user: AdminUser & { studentCode?: string | null } }) {
  const [values, setValues] = useState({ name: user.name, email: user.email === "Not provided" ? "" : user.email, phone: user.phone === "Not provided" ? "" : user.phone, role: user.role, language: "English" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; title: string; message: string } | null>(null);
  async function save() {
    if (values.name.trim().length < 3) { setNotice({ tone: "danger", title: "Profile not saved", message: "Enter the user’s full name." }); return; }
    setBusy(true); setNotice(null);
    try {
      if (!mockMode) await browserRequest<ApiResponse<{ id: string }>>({ url: `/api/v1/admin/users/${encodeURIComponent(userId)}`, method: "PATCH", data: { name: values.name.trim(), email: values.email.trim() || null, mobile: values.phone.trim() || null, primary_role: values.role.toLowerCase().replace(/\s+/g, "_"), language: values.language.toLowerCase() }, headers: { "Idempotency-Key": createIdempotencyKey("admin-update-user") } });
      else await new Promise((resolve) => window.setTimeout(resolve, 300));
      setNotice({ tone: "success", title: mockMode ? "Preview validated" : "Profile saved", message: mockMode ? "The profile payload is ready for the Laravel endpoint." : "Verified profile information was updated and audited." });
    } catch (caught) { const error = caught as Partial<NormalizedApiError>; setNotice({ tone: "danger", title: "Profile not saved", message: error.message || "The request could not be completed." }); }
    finally { setBusy(false); }
  }
  return <div className="space-y-4"><Notice value={notice}/><Panel><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-950">Profile and role</h2><p className="mt-1 text-sm leading-6 text-slate-500">Edit verified information. Laravel rechecks protected role assignments.</p></div><ShieldCheck className="h-6 w-6 text-brand-700"/></div><div className="mt-6 grid gap-5 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold text-slate-800">Full name</span><input className={inputClass} value={values.name} onChange={(event)=>setValues((current)=>({...current,name:event.target.value}))}/></label><label><span className="mb-2 block text-sm font-semibold text-slate-800">Student ID</span><input className={inputClass} value={user.studentCode || "Not assigned"} readOnly/></label><label><span className="mb-2 block text-sm font-semibold text-slate-800">Email</span><input className={inputClass} type="email" value={values.email} onChange={(event)=>setValues((current)=>({...current,email:event.target.value}))}/></label><label><span className="mb-2 block text-sm font-semibold text-slate-800">Phone</span><input className={inputClass} value={values.phone} onChange={(event)=>setValues((current)=>({...current,phone:event.target.value}))}/></label><label><span className="mb-2 block text-sm font-semibold text-slate-800">Primary role</span><select className={inputClass} value={values.role} onChange={(event)=>setValues((current)=>({...current,role:event.target.value}))}><option>Student</option><option>Teacher</option><option>Staff</option><option>Admin</option><option>Super Admin</option></select></label><label><span className="mb-2 block text-sm font-semibold text-slate-800">Language</span><select className={inputClass} value={values.language} onChange={(event)=>setValues((current)=>({...current,language:event.target.value}))}><option>English</option><option>Nepali</option></select></label></div><div className="mt-6 flex justify-end"><Button onClick={save} disabled={busy}>{busy?<LoaderCircle className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}{busy?"Saving…":"Save profile"}</Button></div></Panel></div>;
}

export function AccountControlPanel({ userId, initialStatus }: { userId: string; initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; title: string; message: string } | null>(null);
  async function act(action: "password-reset" | "mfa-reset" | "revoke-sessions" | "suspend" | "reactivate") {
    if (["mfa-reset","suspend","reactivate"].includes(action) && reason.trim().length < 5) { setNotice({ tone: "danger", title: "Reason required", message: "Enter a short operational reason for this audited action." }); return; }
    setBusy(action); setNotice(null);
    try {
      if (!mockMode) await browserRequest<ApiResponse<{ status?: string }>>({ url: `/api/v1/admin/users/${encodeURIComponent(userId)}/actions/${action}`, method: "POST", data: { reason: reason.trim() || null }, headers: { "Idempotency-Key": createIdempotencyKey(`admin-user-${action}`) } });
      else await new Promise((resolve) => window.setTimeout(resolve, 300));
      if (action === "suspend") setStatus("Suspended"); if (action === "reactivate") setStatus("Active");
      setNotice({ tone: "success", title: mockMode ? "Preview validated" : "Account action completed", message: mockMode ? "The audited action payload is ready for Laravel." : "The server accepted the request and recorded the audit reason." });
      setReason("");
    } catch (caught) { const error = caught as Partial<NormalizedApiError>; setNotice({ tone: "danger", title: "Account action failed", message: error.message || "The request could not be completed." }); }
    finally { setBusy(null); }
  }
  const actionButton = (action: Parameters<typeof act>[0], icon: React.ReactNode, title: string, description: string, variant: "outline" | "danger" = "outline") => <Button variant={variant} onClick={()=>act(action)} disabled={Boolean(busy)} className="h-auto min-h-24 w-full items-start justify-start whitespace-normal p-4 text-left">{busy===action?<LoaderCircle className="mt-0.5 h-5 w-5 shrink-0 animate-spin"/>:icon}<span><span className="block font-semibold">{title}</span><span className="mt-1 block text-xs font-normal leading-5 opacity-80">{description}</span></span></Button>;
  const tileClass = (variant: "outline" | "danger") => `inline-flex h-auto min-h-24 w-full items-start justify-start gap-2 whitespace-normal rounded-lg border p-4 text-left font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 ${variant === "danger" ? "bg-red-700 text-white hover:bg-red-800 border-red-700" : "bg-white text-slate-800 hover:bg-slate-50 border-slate-300"}`;
  const confirmActionButton = (action: Parameters<typeof act>[0], icon: React.ReactNode, title: string, description: string, confirmTitle: string, variant: "outline" | "danger" = "outline") => (
    <ConfirmAction
      label={title}
      icon={icon}
      title={confirmTitle}
      description="This is an audited action, recorded with the reason above."
      confirmLabel={title}
      tone={variant === "danger" ? "danger" : "primary"}
      disabled={Boolean(busy)}
      triggerClassName={tileClass(variant)}
      triggerChildren={<>{busy === action ? <LoaderCircle className="mt-0.5 h-5 w-5 shrink-0 animate-spin" /> : icon}<span><span className="block font-semibold">{title}</span><span className="mt-1 block text-xs font-normal leading-5 opacity-80">{description}</span></span></>}
      onConfirm={() => act(action)}
    />
  );
  return <div className="space-y-4"><Notice value={notice}/><Panel><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-950">Account controls</h2><p className="mt-1 text-sm leading-6 text-slate-500">Sensitive actions require Laravel authorization, identity checks and immutable audit entries.</p></div><StatusBadge status={status}/></div><label className="mt-6 block"><span className="mb-2 block text-sm font-semibold text-slate-800">Operational reason</span><textarea className="min-h-20 w-full rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" value={reason} onChange={(event)=>setReason(event.target.value)} maxLength={500} placeholder="Required for suspension, restoration and MFA reset"/></label><div className="mt-5 grid gap-4 sm:grid-cols-2">{actionButton("password-reset",<KeyRound className="mt-0.5 h-5 w-5 shrink-0"/>,"Send password reset","Sends a time-limited link to the verified email.")}{actionButton("revoke-sessions",<LockKeyhole className="mt-0.5 h-5 w-5 shrink-0"/>,"Revoke active sessions","Ends existing browser and device sessions.")}{confirmActionButton("mfa-reset",<ShieldCheck className="mt-0.5 h-5 w-5 shrink-0"/>,"Reset MFA enrollment","Requires identity verification and forced re-enrollment.","Reset MFA enrollment for this account?")}{status.toLowerCase().includes("suspend")?confirmActionButton("reactivate",<UserCheck className="mt-0.5 h-5 w-5 shrink-0"/>,"Restore active access","Enrollment expiry and role policies still apply.","Restore active access for this account?"):confirmActionButton("suspend",<UserX className="mt-0.5 h-5 w-5 shrink-0"/>,"Suspend account","Blocks sign-in without deleting records.","Suspend this account?","danger")}</div><div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4"><div className="flex gap-3"><UserX className="mt-0.5 h-5 w-5 shrink-0 text-red-700"/><div><p className="font-bold text-red-950">Permanent deletion is intentionally unavailable</p><p className="mt-1 text-sm leading-6 text-red-800">Accounts linked to payments, attendance, attempts or audit history are never erased. The Archive control removes the account from active lists while keeping that history intact.</p></div></div></div></Panel></div>;
}
