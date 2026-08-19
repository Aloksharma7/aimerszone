import "server-only";

import type { ApiResponse } from "@/lib/api/contracts";
import { serverApiFetch } from "@/lib/api/server-client";
import { isMockDataEnabled } from "@/lib/data/config";
import { formatDateTime } from "@/lib/data/format";

/**
 * The teacher/staff/admin bells surface outstanding work (pending
 * attendance, payments awaiting review, and so on) rather than archived
 * messages — see the matching backend NotificationController for each role.
 * `publishedAt` is usually null for these; it exists only because the
 * shared feed UI can show it when a role's items do carry one.
 */
export type WorkItemNotification = {
  id: string;
  title: string;
  summary: string | null;
  publishedAt: string | null;
  href: string | null;
};

type ApiWorkItemNotification = {
  id: string;
  title: string;
  summary: string | null;
  published_at: string | null;
  href: string | null;
};

function mapWorkItem(value: ApiWorkItemNotification): WorkItemNotification {
  return {
    id: value.id,
    title: value.title,
    summary: value.summary,
    publishedAt: value.published_at ? formatDateTime(value.published_at) : null,
    href: value.href,
  };
}

async function fetchWorkItems(endpoint: string, mockItems: WorkItemNotification[]): Promise<WorkItemNotification[]> {
  if (isMockDataEnabled()) return mockItems;
  const response = await serverApiFetch<ApiResponse<ApiWorkItemNotification[]>>(endpoint);
  return response.data.map(mapWorkItem);
}

export async function getTeacherNotifications(): Promise<WorkItemNotification[]> {
  return fetchWorkItems("/api/v1/teacher/notifications", [
    { id: "attendance-preview", title: "Finalize attendance: Elasticity of Demand", summary: "Evening Batch · ended 2h ago", publishedAt: null, href: "/teacher/attendance" },
  ]);
}

export async function getStaffNotifications(): Promise<WorkItemNotification[]> {
  return fetchWorkItems("/api/v1/staff/notifications", [
    { id: "payment-pending", title: "3 payments pending review", summary: "Oldest submission 1h 42m", publishedAt: null, href: "/accounting/payments" },
  ]);
}

export async function getAdminNotifications(): Promise<WorkItemNotification[]> {
  return fetchWorkItems("/api/v1/admin/notifications", [
    { id: "payment-pending", title: "18 payments pending", summary: "Oldest submission 1h 42m", publishedAt: null, href: "/admin/payments" },
  ]);
}
