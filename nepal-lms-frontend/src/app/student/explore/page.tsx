import { CourseExplorer } from "@/components/course-explorer";
import { PageHeader } from "@/components/ui";
import { getPublicCategories, getPublicCourses } from "@/lib/data/public";
import { firstParam, searchTerm, type PageSearchParams } from "@/lib/search-params";

export default async function StudentExplorePage({ searchParams }: { searchParams: PageSearchParams }) {
  const raw = await searchParams;
  const [courses, categories] = await Promise.all([getPublicCourses(), getPublicCategories()]);
  return (
    <>
      <PageHeader
        eyebrow="Course catalogue"
        title="Explore Courses"
        description="Find a course without leaving your student workspace. Open the details, choose a batch and submit payment from your dashboard."
      />
      <CourseExplorer
        courses={courses}
        categories={categories}
        detailBasePath="/student/explore"
        initialQuery={searchTerm(raw)}
        initialCategory={firstParam(raw.category)}
        initialPrice={firstParam(raw.price)}
        initialSort={firstParam(raw.sort)}
      />
    </>
  );
}
