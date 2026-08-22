import { api } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/contracts";
import type { SessionUser } from "@/lib/auth/session-store";

/** Matches the backend's AuthMeResource — used as-is by both /auth/me and /auth/mobile-login. */
type ApiAuthenticatedUser = {
  user: {
    id: string;
    name: string;
    email: string | null;
    mobile: string | null;
    student_code: string | null;
    avatar_url: string | null;
    status: string;
  };
  roles: string[];
  permissions: string[];
};

type ApiMobileLoginResponse = ApiAuthenticatedUser & {
  token: string | null;
  required_action?: string | null;
  message?: string;
};

function mapUser(payload: ApiAuthenticatedUser): SessionUser {
  return {
    id: payload.user.id,
    name: payload.user.name,
    email: payload.user.email,
    mobile: payload.user.mobile,
    studentCode: payload.user.student_code,
    avatarUrl: payload.user.avatar_url,
    status: payload.user.status,
    roles: payload.roles,
    permissions: payload.permissions,
  };
}

export async function fetchCurrentUser(): Promise<SessionUser> {
  const response = await api.get<ApiResponse<ApiAuthenticatedUser>>("/api/v1/auth/me");
  return mapUser(response.data);
}

export type LoginResult =
  | { status: "signed_in"; token: string; user: SessionUser }
  | { status: "requires_unsupported_action"; message: string };

/**
 * `POST /api/v1/auth/mobile-login` — see docs/ARCHITECTURE.md. A 2FA-enabled
 * account gets a 200 with `token: null` (credentials were correct, the
 * account just needs a step the mobile app cannot complete yet — see
 * docs/ROADMAP.md Phase 1), never a thrown error for that case.
 */
export async function loginWithPassword(identifier: string, password: string): Promise<LoginResult> {
  const response = await api.post<ApiResponse<ApiMobileLoginResponse>>(
    "/api/v1/auth/mobile-login",
    { identifier, password, device_name: "mobile-app" },
    { skipAuth: true },
  );

  if (!response.data.token) {
    return { status: "requires_unsupported_action", message: response.data.message ?? "This account cannot sign in from the app yet." };
  }

  return { status: "signed_in", token: response.data.token, user: mapUser(response.data) };
}

export type RegisterInput = {
  name: string;
  mobile: string;
  email?: string;
  password: string;
  passwordConfirmation: string;
  preferredLanguage: "en" | "ne";
  recordingPolicyAcknowledged: boolean;
};

/**
 * `POST /api/v1/auth/register` only establishes a web cookie session (see
 * RegisterController — it calls auth()->login(), never issues a Sanctum
 * token), which is useless to a native app. So registration is a two-step
 * call: create the account, then immediately sign in through the same
 * mobile-login endpoint every other sign-in uses, to get a real token. No
 * backend change needed — both endpoints already exist independently.
 */
export async function registerStudent(input: RegisterInput): Promise<LoginResult> {
  await api.post(
    "/api/v1/auth/register",
    {
      name: input.name,
      mobile: input.mobile,
      email: input.email || undefined,
      password: input.password,
      password_confirmation: input.passwordConfirmation,
      preferred_language: input.preferredLanguage,
      terms_accepted: true,
      recording_policy_acknowledged: input.recordingPolicyAcknowledged,
    },
    { skipAuth: true },
  );

  return loginWithPassword(input.mobile, input.password);
}

export async function requestPasswordReset(identifier: string): Promise<string> {
  // ApiResponse::message() on the backend returns a bare { message } object,
  // not the usual { data, meta } envelope every other endpoint uses.
  const response = await api.post<{ message: string }>("/api/v1/auth/forgot-password", { identifier }, { skipAuth: true });

  return response.message;
}
