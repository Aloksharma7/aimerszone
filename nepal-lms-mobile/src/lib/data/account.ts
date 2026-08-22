import { api } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/contracts";
import { mapAccountProfile } from "@/lib/data/adapters";
import type { ApiAccountProfile } from "@/lib/data/api-dtos";
import type { AccountProfile } from "@/types/lms";

/** Shared across every portal — see app/Http/Controllers/Api/V1/Account/*.php, reached by any signed-in role. */
export async function fetchAccountProfile(): Promise<AccountProfile> {
  const response = await api.get<ApiResponse<ApiAccountProfile>>("/api/v1/account/profile");
  return mapAccountProfile(response.data);
}

export type ProfileEdits = { name?: string; email?: string | null; mobile?: string | null };

export async function updateAccountProfile(edits: ProfileEdits): Promise<AccountProfile> {
  const response = await api.patch<ApiResponse<ApiAccountProfile>>("/api/v1/account/profile", edits);
  return mapAccountProfile(response.data);
}

export async function changeAccountPassword(input: { currentPassword: string; password: string; passwordConfirmation: string }): Promise<void> {
  await api.put("/api/v1/account/password", {
    current_password: input.currentPassword,
    password: input.password,
    password_confirmation: input.passwordConfirmation,
  });
}

export async function revokeOtherSessions(password: string): Promise<{ revoked: number }> {
  const response = await api.post<ApiResponse<{ revoked: number }>>("/api/v1/account/sessions/revoke-others", { password });
  return response.data;
}

export type TwoFactorSetupStart = { secret: string; otpauthUrl: string };

export async function startTwoFactorSetup(): Promise<TwoFactorSetupStart> {
  const response = await api.post<ApiResponse<{ enabled: boolean; secret: string; otpauth_url: string }>>("/api/v1/account/two-factor/setup");
  return { secret: response.data.secret, otpauthUrl: response.data.otpauth_url };
}

export async function confirmTwoFactorSetup(code: string): Promise<{ recoveryCodes: string[] }> {
  const response = await api.post<ApiResponse<{ enabled: boolean; recovery_codes: string[] }>>("/api/v1/account/two-factor/setup", { code });
  return { recoveryCodes: response.data.recovery_codes };
}
