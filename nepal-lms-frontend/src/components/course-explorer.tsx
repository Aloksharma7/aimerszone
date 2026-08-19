"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { CourseCard } from "@/components/course-card";
import type { Course, CourseCategory } from "@/types/lms";
import { cn } from "@/lib/utils";

export function CourseExplorer({
  courses,
  categories,
  detailBasePath = "/courses",
  initialQuery = "",
  initialCategory = "All",
  initialPrice = "All",
  initialSort = "recommended",
}: {
  courses: Course[];
  categories: CourseCategory[];
  detailBasePath?: string;
  initialQuery?: string;
  initialCategory?: string;
  initialPrice?: string;
  initialSort?: string;
}) {
  const filters = ["All", ...categories.map((item) => item.name)];
  const [query, setQuery] = useState(initialQuery.slice(0, 100));
  const [category, setCategory] = useState(filters.includes(initialCategory) ? initialCategory : "All");
  const [price, setPrice] = useState(["All", "Paid", "Free"].includes(initialPrice) ? initialPrice : "All");
  const [sort, setSort] = useState(["recommended", "start", "price-asc", "newest"].includes(initialSort) ? initialSort : "recommended");

  const visible = useMemo(() => {
    const filtered = courses.filter((course) => {
      const queryMatch = `${course.title} ${course.category} ${course.description}`.toLowerCase().includes(query.toLowerCase());
      const categoryMatch = category === "All" || course.category === category;
      const priceMatch = price === "All" || (price === "Free" ? course.isFree : !course.isFree);
      return queryMatch && categoryMatch && priceMatch;
    });
    return [...filtered].sort((a, b) => {
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "start") return a.startDate.localeCompare(b.startDate);
      if (sort === "newest") return (b.createdAt || "").localeCompare(a.createdAt || "");
      return Number(Boolean(b.isFree)) - Number(Boolean(a.isFree));
    });
  }, [category, courses, price, query, sort]);

  return (
    <div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <label className="flex h-11 items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100">
            <Search className="h-5 w-5 text-slate-400" />
            <span className="sr-only">Search courses</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by course, exam or subject" className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-slate-400" />
          </label>
          <label className="flex h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700">
            <SlidersHorizontal className="h-4 w-4 text-slate-400" />
            <span className="sr-only">Price filter</span>
            <select value={price} onChange={(event) => setPrice(event.target.value)} className="bg-transparent outline-none"><option>All</option><option>Paid</option><option>Free</option></select>
          </label>
          <select value={sort} onChange={(event) => setSort(event.target.value)} className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 outline-none"><option value="recommended">Sort: Recommended</option><option value="start">Start date</option><option value="price-asc">Price: low to high</option><option value="newest">Newest</option></select>
        </div>
        <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
          {filters.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={cn("shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors", category === item ? "bg-brand-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>{item}</button>)}
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{visible.length} courses available</p><p className="hidden text-xs text-slate-400 sm:block">Schedule and access validity are shown before enrollment</p></div>
      {visible.length ? <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visible.map((course) => <CourseCard key={course.slug} course={course} href={`${detailBasePath}/${course.slug}`} />)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><h2 className="text-lg font-bold text-slate-900">No matching courses</h2><p className="mt-2 text-sm text-slate-500">Try a different search or filter.</p></div>}
    </div>
  );
}
