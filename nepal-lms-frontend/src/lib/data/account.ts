import "server-only";

import type { ApiResponse } from "@/lib/api/contracts";
import { serverApiFetch } from "@/lib/api/server-client";
import { isMockDataEnabled } from "@/lib/data/config";
import type { SessionUser } from "@/types/lms";

export type AccountSession = {
  id: string;
  device: string;
  browser: string;
  platform: string;
  location: string;
  lastActive: string;
  current: boolean;
};

export type AccountProfileData = {
  id: string;
  name: string;
  email: string;
  mobile: string;
  identityCode: string | null;
  avatarUrl: string | null;
  locale: "en" | "ne";
  twoFactorEnabled: boolean;
  twoFactorRequired: boolean;
  sessions: AccountSession[];
};

type ApiAccountProfile = {
  id: string;
  name: string;
  email?: string | null;
  mobile?: string | null;
  identity_code?: string | null;
  avatar_url?: string | null;
  locale?: "en" | "ne" | null;
  two_factor_enabled: boolean;
  two_factor_required?: boolean;
  sessions: Array<{
    id: string;
    device?: string | null;
    browser?: string | null;
    platform?: string | null;
    location?: string | null;
    last_active_at?: string | null;
    current: boolean;
  }>;
};

function formatSessionTime(value?: string | null): string {
  if (!value) return "Recently active";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-NP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kathmandu",
  }).format(date);
}

function mapProfile(value: ApiAccountProfile): AccountProfileData {
  return {
    id: value.id,
    name: value.name,
    email: value.email || "",
    mobile: value.mobile || "",
    identityCode: value.identity_code || null,
    avatarUrl: value.avatar_url || null,
    locale: value.locale === "ne" ? "ne" : "en",
    twoFactorEnabled: value.two_factor_enabled,
    twoFactorRequired: Boolean(value.two_factor_required),
    sessions: value.sessions.map((session) => ({
      id: session.id,
      device: session.device || "Unknown device",
      browser: session.browser || "Unknown browser",
      platform: session.platform || "Unknown platform",
      location: session.location || "Location unavailable",
      lastActive: session.current ? "Current session" : formatSessionTime(session.last_active_at),
      current: session.current,
    })),
  };
}

function mockProfile(user: SessionUser, role: "student" | "teacher"): AccountProfileData {
  return {
    id: user.id,
    name: user.name,
    email: user.email || "",
    mobile: user.mobile || "",
    identityCode: role === "student" ? user.studentCode : "TCH-2083-0042",
    avatarUrl: user.avatarUrl,
    locale: "en",
    twoFactorEnabled: false,
    twoFactorRequired: role === "teacher",
    sessions: [
      {
        id: "current-session",
        device: "Desktop",
        browser: "Chrome",
        platform: "Windows",
        location: "Kathmandu, Nepal",
        lastActive: "Current session",
        current: true,
      },
      {
        id: "mobile-session",
        device: "Mobile",
        browser: "Chrome",
        platform: "Android",
        location: "Kathmandu, Nepal",
        lastActive: "8 Aug 2026, 8:40 PM",
        current: false,
      },
    ],
  };
}

export async function getAccountProfile(user: SessionUser, role: "student" | "teacher"): Promise<AccountProfileData> {
  if (isMockDataEnabled()) return mockProfile(user, role);
  const response = await serverApiFetch<ApiResponse<ApiAccountProfile>>("/api/v1/account/profile");
  return mapProfile(response.data);
}
