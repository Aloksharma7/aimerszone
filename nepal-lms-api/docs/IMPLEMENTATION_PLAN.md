# Remaining implementation plan

The order follows the frontend's own "Laravel implementation order" in
`docs/FRONTEND_HANDOFF.md`, so each phase makes another portal fully live
rather than half-wiring several at once.

## Phase 2 — Student portal — DONE

Delivered: dashboard, courses, course workspace (classes, recordings,
resources, syllabus, tests, announcements), global recordings and resources,
notifications, payment options, payment submission, receipts, support tickets,
and the full attempt lifecycle.

- `EnrollmentProgressService` — recalculates attendance / recording / test /
  syllabus percentages, weighted 30/20/30/20, refreshed on the triggering event
  rather than on a timer.
- Attempt lifecycle: `launch` → `attempts` → `PATCH responses` (autosave) →
  `submit` → `result`. The deadline is stored at creation, an unfinished attempt
  is resumed rather than replaced on refresh, expiry grades whatever was saved,
  and the release policy is enforced on read.
- Payment submission: extension + MIME + size validation, private disk,
  SHA-256 hash so a re-used screenshot is flagged to the reviewer, and guards
  against paying twice for the same seat.

Still open in this area: `topic_performance` on the result screen returns an
empty array until question tagging exists, and receipt PDFs are only linked
once the accounting phase generates them.

## Phase 3 — Teacher portal and integrations

Batches, classes, class creation, reschedule, start, attendance register and
finalization, attendance import, recordings, announcements, content summary,
and the test builder (the only place correct answers are serialised).

- `ZoomClient` — Server-to-Server OAuth, token cached until expiry, meeting
  create/update/delete, retry with backoff, every call written to
  `integration_events`.
- `YouTubeClient` — OAuth refresh-token flow, video metadata and privacy
  status, playlist membership.
- `lms:sync-zoom-sessions` and `lms:check-integration-health` commands, plus the
  manual fallback path the frontend already has UI for.

## Phase 4 — Enrollment Officer and Accounting

Students CRUD, course create/edit/publish, enrollment requests, payment
submission on behalf of a student, support actions.

Accounting: review queue, proof access, the approve/reject decision, receipts,
adjustments, refunds, collections and outstanding reports.

The approval transaction is the critical piece: lock the payment row, verify it
is still reviewable, activate or create the enrollment, issue the receipt, write
the audit entry — all or nothing, and idempotent under a repeated key.

## Phase 5 — Administration and reporting

Dashboard metrics, finance overview, learning operations, academic /
enrollments / finance reports, integration records and actions, batches and
courses administration, announcements, and CSV exports for every list
(streamed, not built in memory).

## Phase 6 — Hardening

- Feature tests for authorization boundaries: student reading another
  student's enrollment, officer approving their own submission, expired
  enrollment reaching a recording, correct answers in a student payload.
- `php artisan test`, Pint, and a staging run of the frontend's
  `npm run check` against this API.
