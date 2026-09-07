import { CalendarDays } from "lucide-react";
import { TeacherSessionForm } from "@/components/teacher/teacher-actions";
import { AlertBox, PageHeader, Panel } from "@/components/ui";
import { getSessionUser, requirePermission } from "@/lib/auth/server";
import { getTeacherBatches } from "@/lib/data/teacher";

export default async function NewTeacherClassPage() {
  const user = await getSessionUser("teacher");
  if (user) await requirePermission(user, "sessions.manage");
  const batches = await getTeacherBatches();
  return <><PageHeader back={{ href: "/teacher/classes", label: "All classes" }} eyebrow="Schedule" title="Create class session" description="Schedule a class only for a batch assigned to your teacher account." /><div className="grid gap-6 xl:grid-cols-[1fr_340px]"><Panel><TeacherSessionForm batches={batches} /></Panel><aside className="space-y-5"><AlertBox title="The server has the final say" tone="info">Batch assignment, schedule conflicts, Zoom configuration and teacher permission are all rechecked before a session is created.</AlertBox><Panel><CalendarDays className="h-6 w-6 text-brand-700" /><h2 className="mt-4 font-bold text-slate-950">Time zone</h2><p className="mt-2 text-sm leading-6 text-slate-600">Enter the schedule in Nepal Time — it is stored and displayed unambiguously wherever it appears.</p></Panel></aside></div></>;
}
