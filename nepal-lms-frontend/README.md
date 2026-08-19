# Nepal LMS Frontend

Production-oriented Next.js frontend for a Laravel API learning-management system.

## Current implementation

- Professional public website and course catalogue.
- Auth flows for login, registration, password recovery, required password change, email verification and two-factor challenge.
- Student workspace with Explore inside the protected dashboard shell, enrolled courses, live classes, global recordings, PDFs/resources, tests, payments, notifications, profile security and support.
- Teacher workspace with assigned batches/classes, class creation, schedule navigation, Zoom synchronization, rescheduling, fallback configuration, attendance, recordings, announcements, content overview and a Laravel-ready test builder.
- Enrollment Officer workspace with student onboarding, course creation/editing/publishing, enrollment requests and payment-proof submission.
- Accountant workspace with payment review, protected proof access, authoritative decisions, receipts, audited adjustment creation, refunds and reports.
- Administrator workspace with courses, batches, users, roles, announcements, audit logs, reports, integrations and settings.
- **108 App Router page routes** and **150 operations across 131 OpenAPI paths**.

## Data architecture

Pages do not import preview records directly. Every read passes through a typed server data module in `src/lib/data/`; every browser mutation passes through `src/lib/api/browser-client.ts`.

- Preview mode: data services return isolated examples from `src/data/`.
- Production mode: the same services call Laravel and do not silently fall back to example records.
- DTO-to-view-model adapters keep Laravel response shapes separate from the visual components.
- The frontend contract is in `contract/openapi.yaml`; the implementation guide is in `docs/API_INTEGRATION_CONTRACTS.md`.

## Production safety already included

- Server-side session and role verification through `/api/v1/auth/me`.
- Per-portal authorization layouts and permission checks for sensitive pages.
- Early protected-route cookie gate through `src/proxy.ts`.
- Sanctum cookie authentication, CSRF initialization and no browser token storage.
- CSP nonce, HSTS, no-sniff, frame denial, referrer policy, permissions policy and no-store/noindex headers for portal routes.
- Safe internal redirects and allow-listed HTTPS destinations for Zoom, recordings and protected downloads.
- Idempotency keys for important mutations.
- Production guard that rejects mock data unless an explicit controlled-demo override is set.
- Server-authoritative test timing, autosave, submission and result release contracts.

## Run locally

```bash
cp .env.example .env.local
npm install
npm run api:types
npm run dev
```

Open `http://localhost:3000`.

## Switch from preview to Laravel

Set these values in `.env.local` or the deployment environment:

```env
NEXT_PUBLIC_USE_MOCK_DATA="false"
ALLOW_MOCK_DATA_IN_PRODUCTION="false"
API_INTERNAL_URL="http://127.0.0.1:8000"
NEXT_PUBLIC_API_BASE_URL=""
SESSION_COOKIE_NAME="laravel_session"
```

Keeping `NEXT_PUBLIC_API_BASE_URL` empty uses the included same-origin rewrites and is the recommended Sanctum setup. Add the parent domains of Laravel-signed storage, Zoom or video destinations to `NEXT_PUBLIC_ALLOWED_EXTERNAL_HOSTS`.

## Required validation before deployment

```bash
npm run api:types
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

Read `docs/FRONTEND_HANDOFF.md`, `docs/API_INTEGRATION_CONTRACTS.md`, `docs/ROUTE_MAP.md`, `docs/PRODUCTION_CHECKLIST.md`, and `docs/QA_REPORT.md` before connecting Laravel or deploying.

## Content approval before launch

The code paths are production-oriented, but the institution must approve its final legal policies, support contacts, payment accounts, course catalogue, teacher profiles and branding before launch. Public payment methods are read from `/api/v1/public/payment-methods`; they are not hard-coded into pages.

