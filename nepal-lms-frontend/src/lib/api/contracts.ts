export type ApiMeta = {
  request_id?: string;
  generated_at?: string;
};

export type ApiResponse<T> = {
  data: T;
  meta?: ApiMeta;
};

export type PaginatedResponse<T> = {
  data: T[];
  links: {
    first?: string | null;
    last?: string | null;
    prev?: string | null;
    previous?: string | null;
    next?: string | null;
  };
  meta: ApiMeta & {
    current_page: number;
    from?: number | null;
    last_page: number;
    path?: string;
    per_page: number;
    to?: number | null;
    total: number;
  };
};

export type AuthenticatedUser = {
  user: {
    id: string;
    name: string;
    mobile?: string | null;
    email?: string | null;
    student_code?: string | null;
    avatar_url?: string | null;
    status: "active" | "suspended";
  };
  roles: string[];
  permissions: string[];
  required_action?: "verify_email" | "change_password" | "two_factor_challenge" | null;
  portal_home: string;
};

export type ValidationErrors = Record<string, string[]>;

export type ApiErrorPayload = {
  message?: string;
  code?: string;
  errors?: ValidationErrors;
  request_id?: string;
  meta?: { request_id?: string };
};
