import "server-only";

import type { ApiResponse } from "@/lib/api/contracts";
import { serverApiFetch } from "@/lib/api/server-client";
import { isMockDataEnabled } from "@/lib/data/config";
import { formatDateTime } from "@/lib/data/format";

export type SupportTicketSummary = {
  id: string;
  reference: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  studentName: string;
  assigneeName: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SupportTicketMessage = {
  id: string;
  body: string;
  isInternal: boolean;
  authorName: string;
  fromStudent: boolean;
  createdAt: string;
};

export type SupportTicketDetail = SupportTicketSummary & {
  message: string;
  email: string | null;
  mobile: string | null;
  resolutionNote: string | null;
  canManage: boolean;
  messages: SupportTicketMessage[];
};

export type SupportInbox = {
  items: SupportTicketSummary[];
  metrics: { open: number; pending: number; resolvedMonth: number; waitingOver2Days: number };
};

type ApiSummary = {
  id: string;
  reference: string;
  subject: string;
  category?: string | null;
  status: string;
  priority?: string | null;
  student_name?: string | null;
  assignee_name?: string | null;
  message_count?: number | null;
  created_at: string;
  updated_at: string;
};

function mapSummary(value: ApiSummary): SupportTicketSummary {
  return {
    id: value.id,
    reference: value.reference,
    subject: value.subject,
    category: value.category || "General",
    status: value.status,
    priority: value.priority || "normal",
    studentName: value.student_name || "Unknown",
    assigneeName: value.assignee_name || null,
    messageCount: value.message_count ?? 0,
    createdAt: formatDateTime(value.created_at),
    updatedAt: formatDateTime(value.updated_at),
  };
}

const previewInbox: SupportInbox = {
  items: [
    {
      id: "preview-1",
      reference: "SUP-20260812-A1B2C",
      subject: "Recording will not open",
      category: "Class or recording",
      status: "open",
      priority: "normal",
      studentName: "Preview Student",
      assigneeName: null,
      messageCount: 0,
      createdAt: "12 Aug 2026, 9:12 AM",
      updatedAt: "12 Aug 2026, 9:12 AM",
    },
  ],
  metrics: { open: 1, pending: 0, resolvedMonth: 0, waitingOver2Days: 0 },
};

export async function getSupportInbox(filters: Record<string, string | undefined> = {}): Promise<SupportInbox> {
  if (isMockDataEnabled()) return previewInbox;

  const query = new URLSearchParams({ per_page: "100" });
  for (const key of ["search", "status", "assigned_to"]) {
    const value = filters[key]?.trim();
    if (value) query.set(key, value.slice(0, 160));
  }

  const response = await serverApiFetch<ApiResponse<{
    items: ApiSummary[];
    metrics: { open: number; pending: number; resolved_month: number; waiting_over_2_days: number };
  }>>(`/api/v1/support/tickets?${query.toString()}`);

  return {
    items: response.data.items.map(mapSummary),
    metrics: {
      open: response.data.metrics.open,
      pending: response.data.metrics.pending,
      resolvedMonth: response.data.metrics.resolved_month,
      waitingOver2Days: response.data.metrics.waiting_over_2_days,
    },
  };
}

export async function getSupportTicket(ticketId: string): Promise<SupportTicketDetail | null> {
  if (isMockDataEnabled()) {
    return {
      ...previewInbox.items[0],
      message: "The recording for Sunday's class does not open on my phone.",
      email: "student@example.test",
      mobile: null,
      resolutionNote: null,
      canManage: true,
      messages: [],
    };
  }

  try {
    const response = await serverApiFetch<ApiResponse<ApiSummary & {
      message: string;
      email?: string | null;
      mobile?: string | null;
      resolution_note?: string | null;
      can_manage?: boolean | null;
      messages?: Array<{
        id: string;
        body: string;
        is_internal: boolean;
        author_name: string;
        from_student: boolean;
        created_at: string;
      }> | null;
    }>>(`/api/v1/support/tickets/${encodeURIComponent(ticketId)}`);

    return {
      ...mapSummary(response.data),
      message: response.data.message,
      email: response.data.email || null,
      mobile: response.data.mobile || null,
      resolutionNote: response.data.resolution_note || null,
      canManage: Boolean(response.data.can_manage),
      messages: (response.data.messages || []).map((item) => ({
        id: item.id,
        body: item.body,
        isInternal: item.is_internal,
        authorName: item.author_name,
        fromStudent: item.from_student,
        createdAt: formatDateTime(item.created_at),
      })),
    };
  } catch {
    return null;
  }
}
