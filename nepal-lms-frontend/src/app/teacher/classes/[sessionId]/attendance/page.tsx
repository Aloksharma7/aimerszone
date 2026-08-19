import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { TeacherAttendanceEditor } from "@/components/teacher/teacher-actions";
import { ButtonLink, PageHeader, Panel } from "@/components/ui";
import { getSessionUser, requirePermission } from "@/lib/auth/server";
import { getTeacherAttendanceDetail } from "@/lib/data/teacher";

export default async function AttendanceFinalizationPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const [detail, user] = await Promise.all([getTeacherAttendanceDetail(sessionId), getSessionUser("teacher")]);
  if (!detail || !user) notFound();
  if (!detail.summary.finalized) await requirePermission(user, "attendance.finalize");
  return <><PageHeader eyebrow="Attendance review" title={detail.session.title} description={`${detail.session.course} · ${detail.session.date} · ${detail.session.time}`} actions={<ButtonLink href="/teacher/attendance" variant="outline">Back to attendance</ButtonLink>} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Panel className="p-4"><p className="text-sm text-slate-500">Enrolled</p><p className="mt-2 text-2xl font-bold text-slate-950">{detail.summary.enrolled}</p></Panel><Panel className="p-4"><p className="text-sm text-slate-500">Matched</p><p className="mt-2 text-2xl font-bold text-green-700">{detail.summary.matched}</p></Panel><Panel className="p-4"><p className="text-sm text-slate-500">Unmatched Zoom names</p><p className="mt-2 text-2xl font-bold text-amber-700">{detail.summary.unmatched}</p></Panel><Panel className="p-4"><p className="text-sm text-slate-500">Needs review</p><p className="mt-2 text-2xl font-bold text-red-700">{detail.summary.needsReview}</p></Panel></div><Panel className="mt-6"><TeacherAttendanceEditor detail={detail} /><div className="mt-5 flex flex-col gap-4 rounded-xl bg-amber-50 p-4 sm:flex-row sm:items-center"><AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" /><p className="flex-1 text-sm leading-6 text-amber-950">Resolve low-confidence and unmatched records before finalizing. Every manual override requires a reason.</p></div></Panel><Panel className="mt-6"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700" /><div><h2 className="font-bold text-slate-950">Audit behaviour</h2><p className="mt-2 text-sm leading-6 text-slate-600">Finalization and reopening create audit entries. Reopening is available only to a permitted role with a recorded reason.</p></div></div></Panel></>;
}
