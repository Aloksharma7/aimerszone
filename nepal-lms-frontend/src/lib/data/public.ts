import "server-only";

import type { ApiResponse, PaginatedResponse } from "@/lib/api/contracts";
import { serverApiFetch } from "@/lib/api/server-client";
import { mapCategory, mapCourse, mapFaq, mapTeacher } from "@/lib/data/adapters";
import type { ApiCategory, ApiCourseDetail, ApiCourseSummary, ApiFaq, ApiPublicPaymentMethod, ApiTeacher } from "@/lib/data/api-dtos";
import { isMockDataEnabled } from "@/lib/data/config";
import { categories, courses, faqs, teachers } from "@/data/mock";
import type { Course, CourseCategory, Faq, PaymentMethodOption, Teacher } from "@/types/lms";

/**
 * Public catalogue reads degrade instead of throwing.
 *
 * These run in the marketing site's layout and pages. A backend outage used to
 * turn every one of them into a 500 — the whole public site, including the
 * login page, went down with the database. A visitor should still see the
 * site, with whatever the catalogue could not supply simply absent.
 *
 * Portal pages are unaffected: they call their own data functions, which still
 * surface failures so staff know something is wrong rather than seeing an
 * empty list and trusting it.
 */
async function publicRead<T>(label: string, read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (error) {
    console.error(`[public] ${label} is unavailable; serving the fallback.`, error);
    return fallback;
  }
}

export async function getPublicCourses(): Promise<Course[]> {
  if (isMockDataEnabled()) return courses;
  return publicRead("course catalogue", async () => {
    const response = await serverApiFetch<PaginatedResponse<ApiCourseSummary>>("/api/v1/public/courses?per_page=100", {
      next: { revalidate: 300, tags: ["public-courses"] },
    });
    return response.data.map(mapCourse);
  }, []);
}

export async function getPublicCourse(slug: string): Promise<Course | null> {
  if (isMockDataEnabled()) return courses.find((course) => course.slug === slug) ?? null;
  try {
    const response = await serverApiFetch<ApiResponse<ApiCourseDetail>>(`/api/v1/public/courses/${encodeURIComponent(slug)}`, {
      next: { revalidate: 300, tags: [`public-course:${slug}`] },
    });
    return mapCourse(response.data);
  } catch (error) {
    if (typeof error === "object" && error && "status" in error && Number(error.status) === 404) return null;
    console.error("[public] course detail is unavailable.", error);
    return null;
  }
}

export async function getPublicCategories(): Promise<CourseCategory[]> {
  if (isMockDataEnabled()) return categories;
  return publicRead("categories", async () => {
    const response = await serverApiFetch<ApiResponse<ApiCategory[]>>("/api/v1/public/categories", {
      next: { revalidate: 600, tags: ["public-categories"] },
    });
    return response.data.map(mapCategory);
  }, []);
}

export async function getPublicTeachers(): Promise<Teacher[]> {
  if (isMockDataEnabled()) return teachers;
  return publicRead("teachers", async () => {
    const response = await serverApiFetch<ApiResponse<ApiTeacher[]>>("/api/v1/public/teachers", {
      next: { revalidate: 600, tags: ["public-teachers"] },
    });
    return response.data.map(mapTeacher);
  }, []);
}

export async function getPublicTeacher(slug: string): Promise<Teacher | null> {
  const items = await getPublicTeachers();
  return items.find((teacher) => teacher.slug === slug) ?? null;
}

export async function getPublicFaqs(): Promise<Faq[]> {
  if (isMockDataEnabled()) return faqs;
  return publicRead("FAQs", async () => {
    const response = await serverApiFetch<ApiResponse<ApiFaq[]>>("/api/v1/public/faqs", {
      next: { revalidate: 600, tags: ["public-faqs"] },
    });
    return response.data.map(mapFaq);
  }, []);
}

const previewPaymentMethods: PaymentMethodOption[] = [
  { id: "esewa", name: "eSewa", instructions: "Send the exact amount to the published eSewa account and upload your payment screenshot." },
  { id: "khalti", name: "Khalti", instructions: "Send the exact amount to the published Khalti account and upload your payment screenshot." },
  { id: "bank-transfer", name: "Bank transfer", instructions: "Transfer the exact amount to the published bank account and upload your deposit slip or transaction screenshot." },
];

export async function getPublicPaymentMethods(): Promise<PaymentMethodOption[]> {
  if (isMockDataEnabled()) return previewPaymentMethods;
  const response = await serverApiFetch<ApiResponse<ApiPublicPaymentMethod[]>>("/api/v1/public/payment-methods", {
    next: { revalidate: 300, tags: ["public-payment-methods"] },
  });
  return response.data.map((method) => ({
    id: method.id,
    name: method.name,
    accountName: method.account_name ?? null,
    accountIdentifier: method.account_identifier ?? null,
    qrImageUrl: method.qr_image_url ?? null,
    instructions: method.instructions ?? null,
  }));
}
