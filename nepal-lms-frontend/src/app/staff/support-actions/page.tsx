import { ShieldCheck } from "lucide-react";
import { SupportActionForm } from "@/components/staff/operations-forms";
import { PageHeader, Panel } from "@/components/ui";
import { getStaffStudents } from "@/lib/data/staff";

export default async function StaffSupportActionsPage({ searchParams }: { searchParams: Promise<{ student?: string | string[]; action?: string | string[] }> }) {
  const [students, raw] = await Promise.all([getStaffStudents(), searchParams]);
  const student = Array.isArray(raw.student) ? raw.student[0] : raw.student;
  const action = Array.isArray(raw.action) ? raw.action[0] : raw.action;
  return <><PageHeader eyebrow="Account assistance" title="Support Actions" description="Help students recover and correct accounts without bypassing identity or access rules."/><SupportActionForm students={students} initialStudentId={student} initialAction={action}/><Panel className="mt-6"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-700"/><div><h2 className="font-bold text-slate-950">Every sensitive assistance action is audited</h2><p className="mt-2 text-sm leading-6 text-slate-600">Laravel records actor, student, action, reason, time and request context and rechecks staff permission.</p></div></div></Panel></>;
}
