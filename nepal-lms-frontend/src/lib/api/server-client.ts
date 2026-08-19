import "server-only";

import { cookies, headers as requestHeaders } from "next/headers";
import type { ApiErrorPayload } from "@/lib/api/contracts";

export class ServerApiError extends Error {
  status: number;
  code: string;
  requestId?: string;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown, code = "request_failed", requestId?: string) {
    super(message);
    this.name = "ServerApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.payload = payload;
  }
}

type NextRequestInit = RequestInit & {
  next?: { revalidate?: number | false; tags?: string[] };
};

const apiBase = (process.env.API_INTERNAL_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const publicAppUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

export async function serverApiFetch<T>(path: string, init: NextRequestInit = {}): Promise<T> {
  const [cookieStore, incomingHeaders] = await Promise.all([cookies(), requestHeaders()]);
  const headers = new Headers(init.headers);
  const cookieHeader = cookieStore.toString();
  const requestId = incomingHeaders.get("x-request-id") || crypto.randomUUID();

  headers.set("Accept", "application/json");
  headers.set("Origin", publicAppUrl);
  headers.set("Referer", `${publicAppUrl}/`);
  headers.set("X-Requested-With", "XMLHttpRequest");
  headers.set("X-Request-Id", requestId);
  if (cookieHeader) headers.set("Cookie", cookieHeader);

  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new ServerApiError("The server attempted to call an untrusted API destination.", 500, undefined, "invalid_api_path", requestId);
  }

  const url = `${apiBase}${path}`;
  const requestInit: NextRequestInit = { ...init, headers };
  if (init.cache === undefined && init.next === undefined) requestInit.cache = "no-store";
  const response = await fetch(url, requestInit);

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get("content-type") || "";
  const payload: unknown = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const apiError = typeof payload === "object" && payload !== null ? (payload as ApiErrorPayload) : undefined;
    const message = apiError?.message || (typeof payload === "string" && payload) || `Request failed with status ${response.status}`;
    const responseRequestId = apiError?.request_id || apiError?.meta?.request_id || response.headers.get("x-request-id") || requestId;
    throw new ServerApiError(message, response.status, payload, apiError?.code || "request_failed", responseRequestId);
  }

  return payload as T;
}

export function isServerApiError(error: unknown): error is ServerApiError {
  return error instanceof ServerApiError;
}
