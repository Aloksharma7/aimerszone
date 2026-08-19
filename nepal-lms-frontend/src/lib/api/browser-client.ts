"use client";

import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { getDeviceId } from "@/lib/api/device-id";
import type { ApiErrorPayload, ValidationErrors } from "@/lib/api/contracts";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export const browserApi = axios.create({
  baseURL,
  withCredentials: true,
  withXSRFToken: true,
  timeout: 30_000,
  headers: {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

let csrfRequest: Promise<void> | null = null;
let csrfReady = false;

function resetCsrfState(): void {
  csrfReady = false;
  csrfRequest = null;
}

export function ensureCsrfCookie(force = false): Promise<void> {
  if (force) resetCsrfState();
  if (csrfReady) return Promise.resolve();
  if (csrfRequest) return csrfRequest;

  const request = browserApi
    .get("/sanctum/csrf-cookie")
    .then(() => {
      csrfReady = true;
    })
    .finally(() => {
      csrfRequest = null;
    });
  csrfRequest = request;
  return request;
}

export type NormalizedApiError = {
  status: number;
  code: string;
  message: string;
  requestId?: string;
  validation?: ValidationErrors;
  retryable: boolean;
};

export function isNormalizedApiError(error: unknown): error is NormalizedApiError {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as Partial<NormalizedApiError>;
  return (
    typeof candidate.status === "number" &&
    typeof candidate.code === "string" &&
    typeof candidate.message === "string" &&
    typeof candidate.retryable === "boolean"
  );
}

export function normalizeApiError(error: unknown): NormalizedApiError {
  if (isNormalizedApiError(error)) return error;

  if (!axios.isAxiosError(error)) {
    return {
      status: 0,
      code: "network_error",
      message: error instanceof Error ? error.message : "An unexpected error occurred.",
      retryable: true,
    };
  }

  const axiosError = error as AxiosError<ApiErrorPayload>;
  const status = axiosError.response?.status ?? 0;
  const payload = axiosError.response?.data;
  return {
    status,
    code: payload?.code || (status === 401 ? "unauthenticated" : status === 403 ? "forbidden" : "request_failed"),
    message: payload?.message || axiosError.message || "The request could not be completed.",
    requestId: payload?.request_id || payload?.meta?.request_id || axiosError.response?.headers?.["x-request-id"],
    validation: payload?.errors,
    retryable: status === 0 || status === 408 || status === 419 || status === 429 || status >= 500,
  };
}

browserApi.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const normalized = normalizeApiError(error);
    const axiosError = axios.isAxiosError(error) ? error : null;
    const url = axiosError?.config?.url || "";
    const isAuthAttempt = url.includes("/auth/login") || url.includes("/auth/two-factor-challenge");
    if (!isAuthAttempt && (normalized.status === 401 || normalized.code === "session_expired")) {
      window.dispatchEvent(new CustomEvent("lms:unauthenticated", { detail: normalized }));
    }
    return Promise.reject(normalized);
  },
);

export function createIdempotencyKey(prefix = "web"): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function assertTrustedApiPath(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    (!value.startsWith("/api/") && !value.startsWith("/sanctum/"))
  ) {
    throw {
      status: 0,
      code: "invalid_api_path",
      message: "The frontend attempted to call an untrusted API destination.",
      retryable: false,
    } satisfies NormalizedApiError;
  }
}

export async function browserRequest<T>(config: AxiosRequestConfig): Promise<T> {
  assertTrustedApiPath(config.url);

  /*
   * File uploads get a longer clock.
   *
   * The default 30s is right for a JSON call but aborts a large PDF on a slow
   * mobile connection mid-transfer, which surfaces as a generic failure the
   * user cannot act on. FormData is the reliable signal that bytes are moving.
   */
  if (typeof FormData !== "undefined" && config.data instanceof FormData && config.timeout === undefined) {
    config.timeout = 180_000;
  }

  // Identifies this browser so the API can enforce single-device login.
  const deviceId = getDeviceId();
  if (deviceId) {
    config.headers = { ...(config.headers || {}), "X-Device-Id": deviceId };
  }

  const method = (config.method || "GET").toUpperCase();
  const mutation = !["GET", "HEAD", "OPTIONS"].includes(method);
  if (mutation) await ensureCsrfCookie();

  try {
    const response = await browserApi.request<T>(config);
    return response.data;
  } catch (error) {
    const normalized = normalizeApiError(error);
    if (mutation && normalized.status === 419) {
      await ensureCsrfCookie(true);
      try {
        const response = await browserApi.request<T>(config);
        return response.data;
      } catch (retryError) {
        throw normalizeApiError(retryError);
      }
    }
    throw normalized;
  }
}
