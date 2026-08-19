import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Clock3, FileText, PlayCircle, Radio, ClipboardCheck, ArrowRight } from "lucide-react";
import type { Course } from "@/types/lms";
import { Badge, StatusBadge } from "@/components/ui";
import { formatNpr } from "@/lib/utils";

const featureIcons = {
  Live: Radio,
  Recordings: PlayCircle,
  Tests: ClipboardCheck,
  Notes: FileText,
};

export function CourseCard({ course, href }: { course: Course; href?: string }) {
  const detailHref = href || `/courses/${course.slug}`;
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-card">
      <Link href={detailHref} className="relative block aspect-[16/9] overflow-hidden bg-slate-100">
        <Image src={course.image} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
        <div className="absolute left-3 top-3 flex gap-2">
          {course.isFree ? <Badge tone="green">Free</Badge> : <StatusBadge status={course.status} />}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-700">{course.category}</p>
        <Link href={detailHref} className="mt-2 text-lg font-bold leading-7 text-slate-950 transition-colors group-hover:text-brand-700">{course.title}</Link>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{course.description}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {course.features.map((feature) => {
            const Icon = featureIcons[feature];
            return <span key={feature} className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600"><Icon className="h-3.5 w-3.5" />{feature}</span>;
          })}
        </div>
        <div className="mt-5 space-y-2.5 border-t border-slate-100 pt-4 text-sm text-slate-600">
          <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-slate-400" />{course.startDate}</p>
          <p className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-slate-400" />{course.schedule}</p>
        </div>
        <div className="mt-auto flex items-end justify-between gap-4 pt-5">
          <div>
            {course.isFree ? <p className="text-xl font-bold text-green-700">Free</p> : (
              <>
                <p className="text-xl font-bold text-slate-950">{formatNpr(course.price)}</p>
                {course.originalPrice ? <p className="text-xs text-slate-400 line-through">{formatNpr(course.originalPrice)}</p> : null}
              </>
            )}
          </div>
          <Link href={detailHref} className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:text-brand-900">View details<ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>
    </article>
  );
}
