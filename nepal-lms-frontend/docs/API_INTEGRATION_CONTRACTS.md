# Laravel API Integration Contracts

## Source of truth

`contract/openapi.yaml` is the machine-readable frontend contract. It currently contains **131 paths and 150 operations** covering authentication, public catalogue, account security, student, teacher, Enrollment Officer, accounting and administration workflows.

Run:

```bash
npm run api:types
```

This generates `src/lib/api/schema.d.ts`. The view-model mapping code remains in `src/lib/data/` so API field naming can stay snake_case while components use stable camelCase objects.

## Common success envelopes

Single resource:

```json
{
  "data": {},
  "meta": {
    "request_id": "uuid",
    "generated_at": "ISO-8601"
  }
}
```

Collection or pagination:

```json
{
  "data": [],
  "links": {
    "first": null,
    "last": null,
    "prev": null,
    "next": null
  },
  "meta": {
    "current_page": 1,
    "last_page": 1,
    "per_page": 25,
    "total": 0,
    "request_id": "uuid"
  }
}
```

Error:

```json
{
  "message": "Human-readable message",
  "code": "stable_machine_code",
  "errors": {
    "field": ["Validation message"]
  },
  "request_id": "uuid"
}
```

## Browser authentication

- Use Laravel Sanctum stateful cookie authentication.
- Mutations begin with `/sanctum/csrf-cookie`.
- Do not return bearer tokens to browser storage.
- `/api/v1/auth/me` returns safe identity, roles, permissions, required action and preferred portal home.
- Return `401` for unauthenticated, `403` for unauthorized, `419` for expired CSRF/session, `422` for validation, `409` for state conflict and `429` for rate limits.

## Authorization expectations

Every identifier is untrusted. Laravel must scope records to the authenticated user and policy before returning data or performing a mutation.

Examples:

- A student may request only enrolled course resources and eligible tests.
- A teacher may access only assigned batches and sessions.
- Enrollment Officers can manage courses and submit evidence but cannot approve payments.
- Accountants can review payments but cannot silently change academic content.
- Administrator actions remain audited and still use policies rather than role-name checks alone.

## Short-lived action responses

Live class, recording, download and proof-view endpoints return a short-lived destination only after authorization:

```json
{
  "data": {
    "url": "https://allowed.example/signed-path",
    "expires_at": "ISO-8601"
  }
}
```

Laravel must prevent caching and avoid returning Zoom host URLs, storage keys or provider credentials.

## Assessments

Teacher builder responses may include correct-answer data because they are teacher-policy protected. Student launch/attempt responses must not contain correct indicators, scoring keys or explanations before the configured release state.

The attempt lifecycle is:

1. `GET /api/v1/student/tests/{testId}/launch`
2. `POST /api/v1/student/tests/{testId}/attempts`
3. `PATCH /api/v1/student/attempts/{attemptId}/responses`
4. `POST /api/v1/student/attempts/{attemptId}/submit`
5. `GET /api/v1/student/attempts/{attemptId}/result`

Laravel is authoritative for the start time, expiry, attempts allowed, late submission policy, score, pass state and result release.

## Payments

Payment proof is untrusted input. Laravel must validate MIME type, extension, size, malware status and storage visibility. Approval/rejection must be transactional and idempotent, write an audit event, and activate enrollment only after a valid authorized approval.

## Frontend replacement rule

Do not edit visual pages to connect Laravel. Implement the documented endpoints and match their DTOs, or update the corresponding mapper in `src/lib/data/`. Preview data is isolated behind `isMockDataEnabled()` and must remain disabled in production.
