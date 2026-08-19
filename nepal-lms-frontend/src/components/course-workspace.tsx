"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, BookOpen, CalendarDays, CheckSquare, ClipboardCheck, FileText, Megaphone, PlayCircle } from "lucide-react";
import { Badge, ProgressBar } from "@/components/ui";
import type { Course } from "@/types/lms";
import { cn } from "@/lib/utils";

const tabs = [
  { segment: "", label: "Overview", icon: BookOpen },
  { segment: "syllabus", label: "Syllabus", icon: FileText },
  { segment: "live", label: "Live Classes", icon: CalendarDays },
  { segment: "recordings", label: "Recordings", icon: PlayCircle },
  { segment: "tests", label: "Tests", icon: ClipboardCheck },

  // Attendance was recorded by teachers and never shown back to the student
  // beyond a single percentage on a progress bar.
  { segment: "attendance", label: "Attendance", icon: CheckSquare },
  { segment: "resources", label: "Resources", icon: FileText },
  { segment: "announcements", label: "Announcements", icon: Megaphone },
];

export function CourseWorkspaceHeader({ enrollmentId, course, progress, accessExpiry }: { enrollmentId: string; course: Course; progress: number; accessExpiry: string }) {
  const pathname = usePathname();
  const base = `/student/courses/${enrollmentId}`;
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="bg-brand-950 px-5 py-6 text-white sm:px-6">
        {/* Route back to the course list; the workspace tabs only move sideways. */}
        <Link href="/student/courses" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-100 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          My courses
        </Link>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="flex flex-wrap gap-2"><Badge tone="blue" className="bg-blue-400/15 text-blue-100 ring-white/10">{course.batch}</Badge><Badge tone="green" className="bg-green-400/15 text-green-100 ring-white/10">Active access</Badge></div><h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">{course.title}</h1><p className="mt-2 text-sm text-blue-100">{course.teacher} · {course.schedule} · Access until {accessExpiry}</p></div>
          <div className="w-full max-w-sm rounded-xl bg-white/10 p-4 ring-1 ring-inset ring-white/10"><div className="mb-2 flex items-center justify-between text-xs font-semibold text-blue-100"><span>Overall course progress</span><span>{progress}%</span></div><ProgressBar value={progress} showValue={false} compact /></div>
        </div>
      </div>
      <nav className="no-scrollbar flex gap-1 overflow-x-auto border-t border-slate-200 bg-white px-3 py-2" aria-label="Course workspace">
        {tabs.map((tab) => {
          const href = tab.segment ? `${base}/${tab.segment}` : base;
          const active = pathname === href;
          const Icon = tab.icon;
          return <Link key={href} href={href} className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors", active ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950")}><Icon className="h-4 w-4" />{tab.label}</Link>;
        })}
      </nav>
    </div>
  );
}
