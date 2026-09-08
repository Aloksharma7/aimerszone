import type { MetadataRoute } from "next";
import { getPublicCourses, getPublicTeachers } from "@/lib/data/public";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const paths = ["", "/courses", "/teachers", "/about", "/services", "/faq", "/contact", "/free-learning", "/payment-instructions", "/privacy", "/terms", "/refund-policy", "/recording-policy"];
  const staticEntries: MetadataRoute.Sitemap = paths.map((path) => ({
    url: `${base}${path}`,
    changeFrequency: path === "" || path === "/courses" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/courses" ? 0.9 : 0.6,
  }));

  // Real course and teacher pages — previously absent, so a search engine
  // could only reach them by following links from the pages above rather
  // than being told about them directly.
  const [courses, teachers] = await Promise.all([getPublicCourses(), getPublicTeachers()]);
  const courseEntries: MetadataRoute.Sitemap = courses.map((course) => ({
    url: `${base}/courses/${course.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));
  const teacherEntries: MetadataRoute.Sitemap = teachers.map((teacher) => ({
    url: `${base}/teachers/${teacher.slug}`,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticEntries, ...courseEntries, ...teacherEntries];
}
