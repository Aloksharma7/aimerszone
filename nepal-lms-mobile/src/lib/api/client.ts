import { API_BASE_URL } from "@/constants/config";
import { getSessionToken, useSessionStore } from "@/lib/auth/session-store";
import type { ApiErrorPayload, NormalizedApiError } from "@/lib/api/contracts";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Skip the Authorization header — only /auth/login and /auth/register need this. */
  skipAuth?: boolean;
};

/**
 * A 401 here means the token is gone (expired, revoked from another device,
 * or the account was suspended) — not that this one request failed for its
 * own reason. Clearing the session is what lets the navigation guard in
 * app/_layout.tsx redirect to login on the very next render, instead of
 * every screen having to notice and handle it individually.
 */
async function handleUnauthorized(): Promise<void> {
  await useSessionStore.getState().signOut();
}

function normalizeError(status: number, payload: ApiErrorPayload | null): NormalizedApiError {
  return {
    status,
    code: payload?.code ?? "unknown_error",
    message: payload?.message ?? "The request could not be completed.",
    requestId: payload?.request_id,
    validation: payload?.errors,
    retryable: status >= 500 || status === 0,
  };
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth, headers, ...rest } = options;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(headers as Record<string, string> | undefined),
  };

  if (!skipAuth) {
    const token = getSessionToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
      body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Network failure (offline, DNS, timeout) never reached the server at all.
    throw normalizeError(0, { message: "Could not reach the server. Check your connection." });
  }

  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok) {
    if (response.status === 401 && !skipAuth) await handleUnauthorized();
    throw normalizeError(response.status, json as ApiErrorPayload | null);
  }

  return json as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: "DELETE" }),
};
