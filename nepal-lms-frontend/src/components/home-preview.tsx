import { BookOpen, CalendarDays, CheckCircle2, Clock3, PlayCircle, Radio } from "lucide-react";
import { ProgressBar } from "@/components/ui";

export function HomeDashboardPreview() {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="absolute -left-4 top-16 hidden w-44 rounded-xl border border-white/70 bg-white p-3 shadow-float sm:block">
        <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 text-green-700"><CheckCircle2 className="h-5 w-5" /></div><div><p className="text-xs font-semibold text-slate-500">Payment status</p><p className="text-sm font-bold text-slate-900">Approved</p></div></div>
      </div>
      <div className="absolute -right-3 bottom-14 hidden w-48 rounded-xl border border-white/70 bg-white p-3 shadow-float sm:block">
        <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-700"><PlayCircle className="h-5 w-5" /></div><div><p className="text-xs font-semibold text-slate-500">Continue recording</p><p className="text-sm font-bold text-slate-900">Newton&apos;s Laws · 32 min</p></div></div>
      </div>
      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-float">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-900 text-white"><BookOpen className="h-4 w-4" /></div><div><p className="text-sm font-bold text-slate-900">My learning</p><p className="text-xs text-slate-500">Monday, 9 August</p></div></div>
          <div className="h-9 w-9 rounded-full bg-slate-100" />
        </div>
        <div className="space-y-4 bg-slate-50 p-4 sm:p-5">
          <div className="rounded-2xl bg-brand-900 p-5 text-white">
            <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold"><span className="h-2 w-2 rounded-full bg-red-400" />Live now</span><span className="text-xs text-blue-100">NPT</span></div>
            <p className="mt-4 text-sm font-semibold text-blue-200">Class 12 Physics</p>
            <h3 className="mt-1 text-lg font-bold">Newton&apos;s Laws of Motion — Practice</h3>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-blue-100"><span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />7:00–8:15 PM</span><span className="flex items-center gap-1.5"><Radio className="h-3.5 w-3.5" />Class is open</span></div>
            <div aria-hidden="true" className="mt-5 flex h-10 w-full items-center justify-center rounded-lg bg-white text-sm font-bold text-brand-900">Join class</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-brand-700">Continue learning</p><p className="mt-2 text-sm font-bold text-slate-900">Newton&apos;s Laws of Motion</p><p className="mt-1 text-xs text-slate-500">Recording · 1h 08m</p></div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><PlayCircle className="h-5 w-5" /></div></div>
            <div className="mt-4"><ProgressBar value={62} compact /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3"><CalendarDays className="h-4 w-4 text-amber-600" /><p className="mt-3 text-xs font-semibold text-slate-500">Next test</p><p className="mt-1 text-sm font-bold text-slate-900">Thursday</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-3"><CheckCircle2 className="h-4 w-4 text-green-600" /><p className="mt-3 text-xs font-semibold text-slate-500">Attendance</p><p className="mt-1 text-sm font-bold text-slate-900">88%</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}
