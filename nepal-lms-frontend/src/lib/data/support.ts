import "server-only";

import type { ApiResponse } from "@/lib/api/contracts";
import { serverApiFetch } from "@/lib/api/server-client";
import { isMockDataEnabled } from "@/lib/data/config";

export type SupportCourseOption = { id: string; title: string };
export type SupportTicket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  createdAt: string;
  latestReply: string | null;

  /** Staff replies on the thread, so "waiting" is distinguishable from "answered". */
  replyCount: number;
  updatedAt: string;
};
export type StudentSupportData = { courses: SupportCourseOption[]; tickets: SupportTicket[] };

type ApiStudentSupport = {
  courses: Array<{ id: string; title: string }>;
  tickets: Array<{
    id: string;
    subject: string;
    category: string;
    status: string;
    created_at: string;
    updated_at?: string | null;
    reply_count?: number | null;
    latest_reply?: string | null;
  }>;
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-NP", { dateStyle: "medium", timeZone: "Asia/Kathmandu" }).format(date);
}

export async function getStudentSupportData(): Promise<StudentSupportData> {
  if (isMockDataEnabled()) {
    return {
      courses: [
        { id: "enr-bbs-micro", title: "BBS First Year Microeconomics" },
        { id: "enr-cmat", title: "CMAT Preparation Foundation" },
      ],
      tickets: [
        {
          id: "TKT-2083-0082",
          subject: "Recording not opening",
          category: "Class or recording",
          status: "Resolved",
          createdAt: "4 Aug 2026",
          latestReply: "Access refreshed after session verification.",
          replyCount: 1,
          updatedAt: "5 Aug 2026",
        },
      ],
    };
  }
  const response = await serverApiFetch<ApiResponse<ApiStudentSupport>>("/api/v1/student/support");
  return {
    // Defensive: a missing selector should narrow the form, not blank the page.
    courses: response.data.courses ?? [],
    tickets: response.data.tickets.map((ticket) => ({
      id: ticket.id,
      subject: ticket.subject,
      category: ticket.category,
      status: ticket.status.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()),
      createdAt: formatDate(ticket.created_at),
      latestReply: ticket.latest_reply || null,
      replyCount: ticket.reply_count ?? 0,
      updatedAt: formatDate(ticket.updated_at || ticket.created_at),
    })),
  };
}
