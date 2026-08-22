/**
 * Mirrors nepal-lms-frontend/src/lib/api/contracts.ts and browser-client.ts's
 * NormalizedApiError. Same backend, same error envelope — keeping the shape
 * identical means anyone moving between the two codebases already knows it.
 */

export type ApiResponse<T> = { data: T; meta?: Record<string, unknown> };

export type PaginatedResponse<T> = {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
};

export type ValidationErrors = Record<string, string[]>;

export type ApiErrorPayload = {
  message: string;
  code?: string;
  request_id?: string;
  errors?: ValidationErrors;
};

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
    typeof candidate.message === "string"
  );
}
