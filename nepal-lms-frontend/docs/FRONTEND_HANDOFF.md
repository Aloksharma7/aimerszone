# Frontend Handoff

## Implementation status

The frontend implementation is complete as an API-ready application. It can run with isolated preview data for visual review, or with Laravel as the only source of truth.

The requested changes are included:

- Student **Explore Courses** remains inside the protected student dashboard shell at `/student/explore`.
- Students have global **Recorded Classes** at `/student/recordings`.
- Students have global **PDFs & Resources** at `/student/resources`.
- Enrollment Officers can create, edit, save drafts and publish courses under `/staff/courses`.
- Public catalogue, student Explore, payments, staff course management and administration share the same course contracts instead of separate page data.

## Important production boundary

The frontend is ready to consume APIs; Laravel still owns all authoritative business behavior. Laravel must implement the OpenAPI contract, policies, database transactions, audit logs, validation, signed URLs, payment decisions, enrollment activation, attendance finalization, test scoring and integration secrets.

Production mode never falls back to preview records. An unavailable or invalid endpoint produces an explicit error instead of displaying fake data.

Public payment instructions read `/api/v1/public/payment-methods`; account identifiers and QR availability are therefore Laravel-managed rather than hard-coded into the page.

## Architecture

### Read path

Server Components call modules under `src/lib/data/`:

- `public.ts`
- `student.ts`
- `teacher.ts`
- `staff.ts`
- `accounting.ts`
- `admin.ts`
- `account.ts`
- `assessment.ts`
- `support.ts`

Those modules call `serverApiFetch()` and map Laravel DTOs into stable UI view models. Components therefore do not need to be redesigned when Laravel is connected.

### Mutation path

Client forms call `browserRequest()` from `src/lib/api/browser-client.ts`. It:

- sends cookie credentials;
- initializes Sanctum CSRF before mutations;
- normalizes network, authentication and validation errors;
- clears client query state and redirects after session expiry;
- supports idempotency keys for sensitive actions.

### Authentication and authorization

1. `src/proxy.ts` performs an early session-cookie presence check on protected route prefixes.
2. Each portal layout calls `/api/v1/auth/me` server-side.
3. The requested portal role is verified before rendering.
4. Required actions such as password change, email verification and two-factor challenge redirect before workspace content appears.
5. Sensitive screens additionally call `requirePermission()`.
6. Laravel policies remain authoritative on every request; hiding a frontend link is never treated as authorization.

## Secure media and documents

The frontend does not embed permanent private URLs. It requests short-lived authorized destinations from Laravel for:

- joining a live class;
- playing a recording;
- downloading a PDF/resource;
- viewing payment evidence.

Only same-origin or allow-listed HTTPS hosts are accepted. Configure `NEXT_PUBLIC_ALLOWED_EXTERNAL_HOSTS` with the exact storage/CDN parent domains used by Laravel signed URLs.

## Assessment safety

- Correct answers exist only in authorized teacher builder payloads.
- Active student-attempt payloads contain questions/options but no correct-answer fields.
- Attempt start, expiry, attempts allowed, scoring and release state come from Laravel.
- Student responses autosave through the attempt endpoint and never use local storage as the authority.
- Submission is idempotent and Laravel decides whether a result can be displayed.

## Production environment

Start from `.env.production.example`. The critical values are:

```env
NEXT_PUBLIC_USE_MOCK_DATA="false"
ALLOW_MOCK_DATA_IN_PRODUCTION="false"
NEXT_PUBLIC_API_BASE_URL=""
API_INTERNAL_URL="http://laravel-api:8000"
SESSION_COOKIE_NAME="your_actual_laravel_session_cookie"
```

Use HTTPS for the public LMS. Configure Sanctum stateful domains, session cookie domain, `SameSite`, secure cookies, trusted proxies and CORS in Laravel for the deployed host.

## Laravel implementation order

1. Sanctum/session authentication and `/api/v1/auth/me`.
2. Public settings, approved payment methods, categories, teachers, FAQs and courses.
3. Account profile/password/session endpoints.
4. Student dashboard, enrollments, classes, recordings and resources.
5. Payment options/submission and accountant review.
6. Staff students, courses, payment submissions and enrollment requests.
7. Teacher batches, classes, attendance, recordings and announcements.
8. Test builder, attempt lifecycle, autosave, submission and released results.
9. Administrator CRUD, reports, settings and integration health.

## Commands

```bash
npm install
npm run api:types
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

Do not deploy until these pass against installed public npm dependencies and a staging Laravel API.
