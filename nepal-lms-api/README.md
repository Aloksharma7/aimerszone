# Nepal LMS — Laravel API

Backend for the Next.js frontend in `nepal-lms-production-ready-frontend-v2`.
Implements `contract/openapi.yaml` (v1.2.0): Sanctum stateful-cookie auth, the
`{data, meta}` / `{data, links, meta}` / `{message, code, errors, request_id}`
envelopes, and administrator-owned runtime configuration.

- **PHP** 8.2+ · **Laravel** 12 · **MySQL** 8 / MariaDB 10.6+
- **Auth**: Sanctum SPA cookies, no bearer tokens in the browser
- **Sessions**: database driver (required — the account security screen lists
  and revokes them)
- **Integrations**: Zoom Server-to-Server OAuth, YouTube Data API v3

---

## Install

```bash
composer install
cp .env.example .env
php artisan key:generate

# create the schema, roles, permissions, settings and the first administrator
php artisan migrate --seed

php artisan storage:link
php artisan serve            # http://127.0.0.1:8000
```

The seeder prints the administrator email and a generated password once. Set
`ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env` beforehand to choose your own. The
account is flagged `must_change_password`, so the frontend will redirect to
`/change-password` on first sign-in — that is the `required_action` contract
working as designed.

Add one cron entry so scheduled work runs:

```
* * * * * cd /path/to/api && php artisan schedule:run >> /dev/null 2>&1
```

## Connect the frontend

In the Next.js project's `.env.local`:

```env
NEXT_PUBLIC_USE_MOCK_DATA="false"
ALLOW_MOCK_DATA_IN_PRODUCTION="false"
API_INTERNAL_URL="http://127.0.0.1:8000"
NEXT_PUBLIC_API_BASE_URL=""
SESSION_COOKIE_NAME="lms_session"
```

Leaving `NEXT_PUBLIC_API_BASE_URL` empty keeps browser requests same-origin
through the rewrites already in `next.config.ts`, which is what makes Sanctum's
cookie authentication work without cross-site cookie problems. `SESSION_COOKIE_NAME`
must match `SESSION_COOKIE` in the Laravel `.env` — the frontend proxy gate
checks for that cookie by name before letting a protected route render.

Matching Laravel values for local development:

```env
SESSION_COOKIE=lms_session
SESSION_DOMAIN=localhost
SANCTUM_STATEFUL_DOMAINS=localhost:3000,127.0.0.1:3000
CORS_ALLOWED_ORIGINS=http://localhost:3000
FRONTEND_URL=http://localhost:3000
```

The mock code in `src/data/` and the `isMockDataEnabled()` branches stay in the
repository; with the flag off they are unreachable, and the production guard in
`config.ts` throws if anyone re-enables them in a production build.

---

## Architecture

```
app/
  Enums/         status vocabularies shared with the frontend DTOs
  Http/
    Controllers/Api/V1/{Auth,Account,PublicSite,Student,Teacher,Staff,Accounting,Admin}
    Middleware/  request id, response meta, role, permission, idempotency, maintenance
    Resources/   DTO shaping — field names match src/lib/data/api-dtos.ts exactly
  Models/        37 Eloquent models, ULID primary keys
  Policies/      per-record authorization, invoked from controllers
  Services/      SettingsRepository, AuditLogger, AccessGuard, MediaLinkService,
                 AttemptGrader, TwoFactorService, UserDirectory
  Support/       ApiResponse envelope, exception → machine-code mapping
```

### Response envelope

Built in one place (`App\Support\ApiResponse`). `meta.request_id` and
`meta.generated_at` are appended by middleware, so no controller has to
remember them. The frontend's `serverApiFetch` reuses the `X-Request-Id` header
it sends, so a single page render is traceable end to end.

### Authorization

Four layers, and the outer ones are never treated as sufficient:

1. `auth` — a session exists
2. `account.usable` — not suspended, not locked
3. `role:` — coarse portal gate
4. `permission:` — capability, mirroring the frontend's `requirePermission()`
5. **Policies** — the record itself, via `AccessGuard`

`AccessGuard` is the single answer to "may this user reach this batch's
content": an active in-window enrollment for students, a batch assignment for
teachers, an explicit permission for staff.

### Administrator-controlled configuration

Every runtime value lives in the `settings` table and is read through
`SettingsRepository` (cached, with `config/lms.php` as seed defaults and
fallback). Institution identity, security thresholds, lockout policy,
registration switch, maintenance mode, receipt prefixes, join windows and
assessment defaults are all editable from `/admin/settings` — no redeploy, and
every save writes an audit entry naming the changed keys.

Payment account numbers and QR images are rows in `payment_methods`, which is
why `/payment-instructions` no longer hard-codes anything.

### The approval transaction

`PaymentDecisionService::approve()` is the only path by which money becomes
access, and it does four things that all happen or none of them: move the
payment to approved, activate (or create) the enrollment, issue a receipt with
an immutable snapshot, and write the audit entry. The payment row is locked for
the duration, so two accountants clicking approve at the same moment cannot both
grant a seat or double-issue a receipt.

The receipt snapshot is the point: it stays truthful even if the course is
renamed, the price changes, or the student account is later removed.

Corrections never edit an approved payment. An adjustment or refund is a new
signed ledger row referencing the original, so the money trail is append-only.

### Security decisions worth knowing

- **Media is never a permanent URL.** Live joins, recordings, downloads and
  payment evidence return `{url, expires_at}` from a temporary signed route
  that **re-runs the policy when opened** — a link copied before access was
  revoked stops working.
- **Zoom host URLs never reach a student payload** (`$hidden` on the model,
  plus separate teacher-only endpoints).
- **Correct answers** live only in teacher builder responses. Student attempt
  payloads are assembled without `is_correct` or `explanation`.
- **Test timing is server-authoritative**: `started_at` / `expires_at` are
  stored at attempt creation, and a scheduled command closes overdue attempts
  so a closed browser still gets graded.
- **Idempotency**: sensitive mutations replay the stored response for a
  repeated `Idempotency-Key`, and reject the same key with a different body.
- **Login enumeration**: unknown identifier and wrong password return the same
  message; failed attempts lock the account using admin-configured thresholds.
- **Accounts are suspended, never deleted** — they are referenced by payments,
  attendance and audit history.
- **Separation of duties**: the officer who submitted payment evidence cannot
  approve it.

---

## Build status

| Area | State |
|---|---|
| Foundation, envelope, errors, middleware, idempotency | Complete |
| Database schema — 40 tables | Complete |
| Models, enums, policies, access guard | Complete |
| Auth: register, login, logout, me, 2FA, reset, change password, verify | Complete |
| Account: profile, password, sessions, 2FA enrollment | Complete |
| Public: settings, payment methods, categories, courses, teachers, FAQs, contact | Complete |
| Admin: settings, roles, permissions, users, account actions, audit log | Complete |
| **Admin: dashboard, courses, batches, teachers, announcements, finance overview, learning operations, reports, integrations, CSV exports** | **Complete** |
| Assessment grading engine | Complete |
| **Student portal** — dashboard, workspace, classes, recordings, resources, syllabus, tests, attempts, notifications, payments, receipts, support | **Complete** |
| **Teacher portal** — dashboard, batches, classes, start/sync/fallback, attendance register + Zoom import, recordings, announcements, test builder, content summary | **Complete** |
| **Zoom (Server-to-Server OAuth) and YouTube Data API v3 clients** | **Complete** |
| **Staff portal** — students, onboarding, support actions, enrollments, exception requests, catalogue editing, payment submission on behalf | **Complete** |
| **Accounting portal** — review queue, evidence access, approve/reject/flag, receipts, adjustments, refunds, collections and outstanding reports | **Complete** |
| **Hardening** — 37 tests across authorization, assessment integrity, payment approval, portal boundaries and configuration; Pint config; CI workflow | **Complete** |
| Zoom / YouTube API clients | Next phase |

See `docs/IMPLEMENTATION_PLAN.md` for what lands in each remaining phase.

## Integrations

Both providers are optional: with them switched off the platform still works,
and teachers publish a manual join link and a YouTube id by hand.

**Zoom** — Server-to-Server OAuth. Create the app in the Zoom Marketplace and
set `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` and
`ZOOM_HOST_EMAIL`. Required scopes: `meeting:write:admin`, `meeting:read:admin`
and, for attendance import, `report:read:admin` (paid plans only — on a free
plan the import returns an empty report and says so rather than failing).

**YouTube** — Data API v3 with an OAuth refresh token for the account owning the
channel. Set `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`.
The LMS never uploads video; it verifies an id, reads duration and processing
state, and **refuses to release a video that is set to public**, since a public
video is reachable by anyone with the link.

Connect each provider from `/admin/integrations`. Connecting refuses to enable a
provider whose credentials are missing, so failures surface there rather than at
class time. Access tokens are cached for 50 minutes and dropped immediately on a
401/403, and every provider call is written to `integration_events`.

**The failure rule throughout: a provider outage never blocks teaching.** If Zoom
cannot be reached the class is still created, marked for fallback, and the
teacher publishes a manual https link that students receive instead.

## Testing

```bash
php artisan test          # in-memory SQLite, no MySQL server needed
./vendor/bin/pint         # formatting
```

The suite targets the boundaries most likely to leak rather than chasing line
coverage: student isolation, assessment integrity, the payment approval
transaction, cross-portal access, and administrator configuration. See
`docs/VERIFICATION.md` for the full checklist and the known gaps.

Optional sample institution, never run automatically:

```bash
php artisan db:seed --class=Database\\Seeders\\DemoContentSeeder
```

## Before production

Read `docs/PRODUCTION.md`. Two things there are easy to miss and both fail
silently:

- **A queue worker is required.** Password reset emails and post-attendance
  progress recalculation are queued. With no worker, reset links are never sent
  and progress figures quietly stop updating.
- **Back up `storage/app/private` alongside the database.** Payment evidence
  lives on disk, not in the database. A restore without it leaves every approved
  payment with no supporting document.

## Notes for whoever runs this first

- `composer install` and `php artisan migrate --seed` have **not** been executed
  here — this sandbox has no PHP or Composer. The code was written against the
  Laravel 12 API and checked structurally (every `App\` reference resolves to a
  defined class; all 180 files parse-balance), but the first run on a real
  machine is where genuine typos will surface. Budget a short shakedown pass.
- Strict Eloquent mode is **opt-in** via `LMS_STRICT_MODELS=true`. It is worth
  turning on in local development to catch N+1 access, but it throws rather than
  warns, so it stays off by default until the query paths have been exercised.
- `DemoContentSeeder` gives you a working institution to click through
  immediately; see `docs/VERIFICATION.md`.
- `docs/FRONTEND_GUEST_GUARD.md` contains the one frontend fix this backend
  cannot make on its own: `/login` currently renders even when already signed in.
