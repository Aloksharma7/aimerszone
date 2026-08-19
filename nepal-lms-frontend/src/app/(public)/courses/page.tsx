import type { Metadata } from "next";
import { CourseExplorer } from "@/components/course-explorer";
import { getPublicCategories, getPublicCourses } from "@/lib/data/public";
import { firstParam, type PageSearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "Courses", description: "Browse published courses and batches with clear schedules, access periods and prices." };

export default async function CoursesPage({ searchParams }: { searchParams: PageSearchParams }) {
  const raw = await searchParams;
  const [courses, categories] = await Promise.all([getPublicCourses(), getPublicCategories()]);
  return (
    <section className="bg-canvas py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand-700">Course catalogue</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Find the right batch without guessing.</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">Compare the subject, teacher, weekly schedule, start date, access validity and actual price before you enroll.</p>
        </div>
        <div className="mt-8">
          <CourseExplorer
            courses={courses}
            categories={categories}
            initialQuery={firstParam(raw.search)}
            initialCategory={firstParam(raw.category)}
            initialPrice={firstParam(raw.price)}
            initialSort={firstParam(raw.sort)}
          />
        </div>
      </div>
    </section>
  );
}
