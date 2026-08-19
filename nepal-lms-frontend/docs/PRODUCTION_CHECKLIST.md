# Production Release Checklist

## 1. Environment

Copy `.env.production.example` into the deployment secret/configuration system. Do not commit a real environment file.

Required safety values:

```env
NODE_ENV="production"
NEXT_PUBLIC_USE_MOCK_DATA="false"
ALLOW_MOCK_DATA_IN_PRODUCTION="false"
NEXT_PUBLIC_API_BASE_URL=""
API_INTERNAL_URL="http://laravel-api:8000"
SESSION_COOKIE_NAME="the_real_laravel_session_cookie"
```

Set `NEXT_PUBLIC_APP_URL` to the exact HTTPS LMS origin. Add only required Zoom, YouTube and storage/CDN parent domains to `NEXT_PUBLIC_ALLOWED_EXTERNAL_HOSTS`.

## 2. Laravel session configuration

- Use Sanctum stateful cookie authentication.
- Configure the exact frontend host in Sanctum stateful domains.
- Use `Secure` cookies in production.
- Choose the correct cookie domain for the deployment topology.
- Use an appropriate `SameSite` value and HTTPS everywhere.
- Configure trusted proxies so Laravel detects HTTPS correctly.
- Return `401`, `403`, `419`, `422`, `429` and conflict responses according to the OpenAPI contract.
- Make `/api/v1/auth/me` the authoritative identity, role, permission and required-action endpoint.

## 3. API implementation

Implement and validate `contract/openapi.yaml`. Keep identifiers untrusted and authorize every record through Laravel policies.

Laravel remains authoritative for:

- course visibility and publishing;
- enrollment eligibility and activation;
- payment evidence, decisions, refunds and adjustments;
- teacher batch/session ownership;
- attendance imports and finalization;
- test timing, attempts, scoring and result release;
- signed/private recording, PDF and proof destinations;
- audit history and integration secrets.

## 4. Frontend verification

Run:

```bash
npm install
npm run verify:source
npm run api:types
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

Generate and commit `package-lock.json` after the first approved install. Change CI/deployment installation to `npm ci` after the lockfile exists.

## 5. Institution content approval

- Publish approved support contacts, payment methods, legal policies, course content, teacher profiles and branding.
- Verify that `/api/v1/public/payment-methods` returns only currently approved public methods.
- Do not expose provider secrets, internal account metadata or permanent private QR/storage URLs.

## 6. Staging acceptance

Test at least one account for each role:

- student;
- teacher;
- Enrollment Officer;
- accountant;
- administrator.

Verify denied access by intentionally opening routes from the wrong role. Test expired sessions, suspended users, required password change, email verification and two-factor challenge.

Complete end-to-end staging scenarios:

1. Staff creates and publishes a course.
2. The course appears on the public catalogue and student Explore page according to publishing rules.
3. A student submits payment proof.
4. An accountant safely views and decides the payment.
5. Laravel activates the correct enrollment transactionally.
6. A teacher starts a class and finalizes attendance.
7. A recording and PDF become available only to eligible students.
8. A teacher publishes a test; a student starts, autosaves and submits it; Laravel releases the result according to policy.

## 7. Security review

- Confirm CSP in the deployed browser console and remove unused external hosts.
- Confirm protected pages return `Cache-Control: private, no-store` and `X-Robots-Tag: noindex`.
- Confirm no browser token is stored in web storage.
- Confirm all uploaded payment evidence is private, MIME-validated, size-limited and malware-scanned.
- Confirm signed URLs are short-lived and scoped.
- Confirm rate limits on login, password recovery, public support, registration, test autosave and sensitive mutations.
- Confirm idempotency is enforced server-side, not merely accepted as a header.
- Confirm authorization failures do not reveal whether another user's record exists.
- Confirm secrets for Zoom, YouTube, mail and storage never enter `NEXT_PUBLIC_*` variables.

## 8. Observability and recovery

- Send frontend/server errors to the selected monitoring platform without including passwords, test answers or payment proof URLs.
- Preserve and log `X-Request-Id` across Next.js, Laravel, queues and integrations.
- Configure uptime checks and alerting.
- Back up the Laravel database and private storage.
- Test restoration, rollback and key rotation before launch.
