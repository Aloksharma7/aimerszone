"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Copy, KeyRound, LoaderCircle, Save, Smartphone, UserPlus } from "lucide-react";
import { AlertBox, Button, Panel, labelledFieldClass } from "@/components/ui";
import { browserRequest, createIdempotencyKey, type NormalizedApiError } from "@/lib/api/browser-client";
import type { ApiResponse } from "@/lib/api/contracts";
import { usePortalPath } from "@/lib/use-portal-path";
import type { StaffStudent } from "@/types/lms";

const mockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
// Shared token; see fieldClass in components/ui.
const inputClass = labelledFieldClass;
const textareaClass = "mt-2 min-h-24 w-full rounded-lg border border-slate-300 p-3 font-normal outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100";

type Notice = { tone: "success" | "danger"; title: string; message: string } | null;
function Result({ value }: { value: Notice }) { return value ? <AlertBox title={value.title} tone={value.tone}>{value.message}</AlertBox> : null; }
function getError(error: unknown, fallback: string): string { return (error as Partial<NormalizedApiError>)?.message || fallback; }

type CreatedStudent = { id: string; studentCode: string | null; temporaryPassword: string | null };

export function CreateStudentForm() {
  const router = useRouter();
  const portalPath = usePortalPath();
  const [values,setValues]=useState({name:"",mobile:"",email:"",language:"en",setupMethod:"link",interest:"",note:""});
  const [busy,setBusy]=useState(false); const [notice,setNotice]=useState<Notice>(null);
  const [created, setCreated] = useState<CreatedStudent | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if(values.name.trim().length<3 || !/^\+?[0-9\s-]{8,18}$/.test(values.mobile)){setNotice({tone:"danger",title:"Student not created",message:"Enter a full name and valid mobile number."});return;}
    setBusy(true);setNotice(null);
    try{
      if(!mockMode){
        const response=await browserRequest<ApiResponse<{id:string;student_code?:string;temporary_password?:string}>>({url:"/api/v1/staff/students",method:"POST",data:{name:values.name.trim(),mobile:values.mobile.trim(),email:values.email.trim()||null,preferred_language:values.language,password_setup_method:values.setupMethod,inquiry:values.interest.trim()||null,internal_note:values.note.trim()||null},headers:{"Idempotency-Key":createIdempotencyKey("staff-create-student")}});
        setCreated({ id: response.data.id, studentCode: response.data.student_code ?? null, temporaryPassword: response.data.temporary_password ?? null });
        router.refresh();
      } else {
        await new Promise((r)=>window.setTimeout(r,300));
        setCreated({ id: "preview-student", studentCode: "STD-PREVIEW", temporaryPassword: values.setupMethod === "temporary" ? "Preview-Pass-1" : null });
      }
    }catch(error){setNotice({tone:"danger",title:"Student not created",message:getError(error,"The request could not be completed.")});}
    finally{setBusy(false);}
  }

  if (created) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <h2 className="text-lg font-bold text-emerald-900">Student created</h2>
        <p className="mt-1 text-sm text-emerald-800">{created.studentCode ? `Student code ${created.studentCode}. ` : ""}The account must change its password at first sign-in.</p>
        {created.temporaryPassword ? (
          <div className="mt-4 rounded-xl border border-emerald-300 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Temporary password — shown once</p>
            <div className="mt-2 flex items-center gap-3">
              <code className="flex-1 rounded-lg bg-slate-900 px-3 py-2 font-mono text-sm text-white">{created.temporaryPassword}</code>
              <button type="button" onClick={()=>{navigator.clipboard.writeText(created.temporaryPassword as string);setCopied(true);}} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Copy className="h-4 w-4" />{copied ? "Copied" : "Copy"}</button>
            </div>
            <p className="mt-2 text-xs text-slate-600">This is not recoverable. Hand it over directly, and if it is lost, send a password reset instead.</p>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-emerald-300 bg-white px-4 py-3 text-sm text-slate-700">A password setup link has been sent{values.email ? ` to ${values.email}` : ""}.</p>
        )}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={()=>{setCreated(null);setCopied(false);setValues({name:"",mobile:"",email:"",language:"en",setupMethod:"link",interest:"",note:""});}} className="h-11 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">Create another</button>
          {created.id !== "preview-student" ? <button type="button" onClick={()=>router.push(portalPath(`/staff/students/${encodeURIComponent(created.id)}`))} className="h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">View student</button> : null}
        </div>
      </div>
    );
  }

  return <div className="grid gap-6 xl:grid-cols-[1fr_340px]"><div className="space-y-4"><Result value={notice}/><Panel><div className="flex items-center gap-3"><UserPlus className="h-6 w-6 text-brand-700"/><h2 className="text-xl font-bold text-slate-950">Student details</h2></div><form onSubmit={submit} className="mt-6 grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Full name<span className="text-red-600"> *</span><input className={inputClass} value={values.name} onChange={(e)=>setValues({...values,name:e.target.value})} autoComplete="name"/></label><label className="text-sm font-semibold text-slate-700">Mobile number<span className="text-red-600"> *</span><input className={inputClass} value={values.mobile} onChange={(e)=>setValues({...values,mobile:e.target.value})} inputMode="tel" autoComplete="tel"/></label><label className="text-sm font-semibold text-slate-700">Email <span className="font-normal text-slate-400">(optional)</span><input className={inputClass} type="email" value={values.email} onChange={(e)=>setValues({...values,email:e.target.value})} autoComplete="email"/></label><label className="text-sm font-semibold text-slate-700">Preferred language<select className={inputClass} value={values.language} onChange={(e)=>setValues({...values,language:e.target.value})}><option value="en">English</option><option value="ne">Nepali</option></select></label><label className="text-sm font-semibold text-slate-700">Password setup<select className={inputClass} value={values.setupMethod} onChange={(e)=>setValues({...values,setupMethod:e.target.value})}><option value="link">Send setup link / code</option><option value="temporary">Generate temporary password</option></select></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Intended course or inquiry<input className={inputClass} value={values.interest} onChange={(e)=>setValues({...values,interest:e.target.value})}/></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Internal note<textarea className={textareaClass} value={values.note} onChange={(e)=>setValues({...values,note:e.target.value})} maxLength={1000}/></label><div className="sm:col-span-2"><Button type="submit" disabled={busy}>{busy?<LoaderCircle className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}{busy?"Creating…":"Create student"}</Button></div></form></Panel></div><aside className="space-y-5"><AlertBox title="Data minimization" tone="info">Do not collect identity documents or unrelated personal information without an approved need.</AlertBox><Panel><div className="flex gap-3"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"/><div><h2 className="font-bold text-slate-950">Duplicate check</h2><p className="mt-2 text-sm leading-6 text-slate-600">Laravel must normalize phone and email and reject or merge duplicate accounts.</p></div></div></Panel></aside></div>;
}

export function SupportActionForm({ students, initialStudentId = "", initialAction = "password-reset" }: { students: StaffStudent[]; initialStudentId?: string; initialAction?: string }) {
  const safeAction = ["password-reset", "contact-correction", "revoke-sessions"].includes(initialAction) ? initialAction : "password-reset";
  const safeStudent = students.some((student) => student.id === initialStudentId) ? initialStudentId : "";
  const [values,setValues]=useState({studentId:safeStudent,action:safeAction,reason:""});const[busy,setBusy]=useState(false);const[notice,setNotice]=useState<Notice>(null);
  async function submit(event:React.FormEvent){event.preventDefault();if(!values.studentId||values.reason.trim().length<5){setNotice({tone:"danger",title:"Action not requested",message:"Select a student and enter a verification reason."});return;}setBusy(true);setNotice(null);try{if(!mockMode)await browserRequest<ApiResponse<{id:string}>>({url:`/api/v1/staff/students/${encodeURIComponent(values.studentId)}/support-actions`,method:"POST",data:{action:values.action,reason:values.reason.trim()},headers:{"Idempotency-Key":createIdempotencyKey("staff-support-action")}});else await new Promise((r)=>window.setTimeout(r,300));setNotice({tone:"success",title:mockMode?"Preview validated":"Support action requested",message:mockMode?"The audited support payload is ready for Laravel.":"The authorized action was recorded without revealing credentials."});}catch(error){setNotice({tone:"danger",title:"Action not requested",message:getError(error,"The request could not be completed.")});}finally{setBusy(false);}}
  return <div className="space-y-4"><Result value={notice}/><Panel><form onSubmit={submit} className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Student<select className={inputClass} value={values.studentId} onChange={(e)=>setValues({...values,studentId:e.target.value})}><option value="">Select student</option>{students.map((s)=><option key={s.id} value={s.id}>{s.name} · {s.phone}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Action<select className={inputClass} value={values.action} onChange={(e)=>setValues({...values,action:e.target.value})}><option value="password-reset">Password setup / reset</option><option value="contact-correction">Contact correction review</option><option value="revoke-sessions">Revoke other sessions</option></select></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Verification and reason<textarea className={textareaClass} value={values.reason} onChange={(e)=>setValues({...values,reason:e.target.value})} maxLength={1000}/></label><div className="sm:col-span-2"><Button type="submit" disabled={busy}>{busy?<LoaderCircle className="h-4 w-4 animate-spin"/>:values.action==="revoke-sessions"?<Smartphone className="h-4 w-4"/>:<KeyRound className="h-4 w-4"/>}{busy?"Submitting…":"Start audited action"}</Button></div></form></Panel></div>;
}
