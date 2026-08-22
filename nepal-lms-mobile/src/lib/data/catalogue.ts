import { resolveAssetUrl } from "@/lib/api/assets";
import { api } from "@/lib/api/client";
import type { ApiResponse, PaginatedResponse } from "@/lib/api/contracts";
import type { CapturedProof } from "@/components/proof-capture";
import type { ApiCatalogueCourse, ApiPaymentOptions } from "@/lib/data/api-dtos";
import { mapPaymentMethodOption } from "@/lib/data/staff-adapters";
import { formatDate } from "@/lib/data/format";
import type { CatalogueBatch, CatalogueCourse, PaymentOptions } from "@/types/lms";

function mapCatalogueCourse(value: ApiCatalogueCourse): CatalogueCourse {
  return {
    id: value.id,
    slug: value.slug,
    title: value.short_title || value.title,
    shortDescription: value.short_description || "",
    description: value.description || value.short_description || "",
    categoryName: value.category?.name ?? null,
    thumbnailUrl: resolveAssetUrl(value.thumbnail_url),
    accessType: value.access_type,
    startingPriceNpr: value.starting_price_npr,
    originalPriceNpr: value.original_price_npr,
    features: value.features,
    teacherName: value.teacher?.name ?? null,
    batches: value.batches.map(
      (batch): CatalogueBatch => ({
        id: batch.id,
        title: batch.title,
        status: batch.status,
        scheduleSummary: batch.schedule_summary || "Schedule to be announced",
        startDate: batch.start_at ? formatDate(batch.start_at) : "To be announced",
        accessUntil: batch.access_until ? formatDate(batch.access_until) : "Shown before enrollment",
        priceNpr: batch.price_npr ?? value.starting_price_npr,
        capacity: batch.capacity,
        teacherNames: batch.teacher_names,
      }),
    ),
  };
}

export type CataloguePage = { items: CatalogueCourse[]; nextPage: number | null };

export async function fetchCataloguePage(page: number, query?: string): Promise<CataloguePage> {
  const q = query ? `&q=${encodeURIComponent(query)}` : "";
  const response = await api.get<PaginatedResponse<ApiCatalogueCourse>>(`/api/v1/public/courses?page=${page}${q}`, { skipAuth: true });
  return {
    items: response.data.map(mapCatalogueCourse),
    nextPage: response.meta.current_page < response.meta.last_page ? response.meta.current_page + 1 : null,
  };
}

export async function fetchCatalogueCourseDetail(slug: string): Promise<CatalogueCourse> {
  const response = await api.get<ApiResponse<ApiCatalogueCourse>>(`/api/v1/public/courses/${slug}`, { skipAuth: true });
  return mapCatalogueCourse(response.data);
}

export async function enrollInFreeBatch(batchId: string): Promise<{ enrollmentId: string; courseTitle: string | null }> {
  const response = await api.post<ApiResponse<{ enrollment_id: string; course_title: string | null }>>("/api/v1/student/enroll-free", {
    batch_id: batchId,
  });
  return { enrollmentId: response.data.enrollment_id, courseTitle: response.data.course_title };
}

export async function fetchPaymentOptions(batchId: string): Promise<PaymentOptions> {
  const response = await api.get<ApiResponse<ApiPaymentOptions>>(`/api/v1/student/payment-options?batch_id=${batchId}`);
  const data = response.data;
  return {
    batchId: data.batch_id,
    batchTitle: data.batch_title,
    courseTitle: data.course_title || "Course",
    expectedAmountNpr: data.expected_amount_npr,
    seatsRemaining: data.seats_remaining,
    alreadyEnrolled: data.already_enrolled,
    pendingReview: data.pending_review,
    methods: data.methods.map(mapPaymentMethodOption),
  };
}

export type StudentPaymentSubmission = {
  batchId: string;
  paymentMethodId: string;
  amountNpr: number;
  payerName: string;
  transactionReference?: string;
  paidAt: string;
  proof: CapturedProof;
};

export async function submitStudentPayment(input: StudentPaymentSubmission): Promise<{ id: string; status: string }> {
  const form = new FormData();
  form.append("batch_id", input.batchId);
  form.append("payment_method_id", input.paymentMethodId);
  form.append("amount_npr", String(input.amountNpr));
  form.append("payer_name", input.payerName);
  if (input.transactionReference) form.append("transaction_reference", input.transactionReference);
  form.append("paid_at", input.paidAt);
  form.append("proof_file", input.proof as unknown as Blob);

  const response = await api.post<ApiResponse<{ id: string; status: string }>>("/api/v1/student/payments", form);
  return response.data;
}
