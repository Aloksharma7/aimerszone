import { ChevronLeft, ChevronRight, Plus, Repeat } from "lucide-react";
import { ButtonLink, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { getTeacherClasses } from "@/lib/data/teacher";
import { portalPath } from "@/lib/portal-path";
import { kathmanduToday } from "@/lib/utils";

function validDate(value: string | undefined): string { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : kathmanduToday(); }
function shiftDate(value: string, days: number): string { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }

export default async function TeacherClassesPage({ searchParams }: { searchParams: Promise<{ date?: string | string[] }> }) {
  const raw = await searchParams;
  const selectedDate = validDate(Array.isArray(raw.date) ? raw.date[0] : raw.date);
  const classes = await getTeacherClasses(selectedDate);
  const today = kathmanduToday();
  const base = await portalPath("/teacher/classes");
  return <><PageHeader eyebrow="Schedule" title="Classes" description="Create, start, reschedule and follow up only on sessions for assigned batches." actions={<><ButtonLink href={`${base}/recurring`} variant="outline"><Repeat className="h-4 w-4" />Recurring series</ButtonLink><ButtonLink href={`${base}/new`}><Plus className="h-4 w-4" />Create session</ButtonLink></>} /><Panel><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><ButtonLink href={`${base}?date=${shiftDate(selectedDate,-1)}`} variant="outline" size="sm"><ChevronLeft className="h-4 w-4" /><span className="sr-only">Previous day</span></ButtonLink><ButtonLink href={`${base}?date=${today}`} variant="outline" size="sm">Today</ButtonLink><ButtonLink href={`${base}?date=${shiftDate(selectedDate,1)}`} variant="outline" size="sm"><ChevronRight className="h-4 w-4" /><span className="sr-only">Next day</span></ButtonLink></div><p className="text-sm font-bold text-slate-900">{selectedDate} · Nepal Time</p></div><div className="mt-6 space-y-3">{classes.length ? classes.map((item) => <div key={item.id} className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-[160px_1fr_auto] sm:items-center"><div><p className="text-sm font-bold text-slate-950">{item.date} · {item.time}</p><p className="mt-1 text-xs text-slate-500">{item.duration}</p></div><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-slate-950">{item.title}</h2><StatusBadge status={item.status} /></div><p className="mt-1 text-sm text-slate-500">{item.course} · {item.batch}</p></div><ButtonLink href={`${base}/${item.id}`} variant={item.status === "Live now" ? "primary" : "outline"} size="sm">{item.status === "Live now" ? "Open class" : "View session"}</ButtonLink></div>) : <p className="text-sm text-slate-500">No assigned sessions found for this date.</p>}</div></Panel></>;
}
