# Roadmap

Ordered by dependency (each phase needs the last) and by mobile value (see
`docs/FEATURE-AUDIT.md` for the reasoning behind the role order). Nothing
here is committed to a date — it's an order, not a schedule.

## Phase 0 — Scaffolding (this pass)

Done: project created, NativeWind wired to the web app's exact palette,
Expo Router structure for all 4 portals with role guards, Zustand session
store, typed API client with the web app's exact error shape, login screen
UI wired to a login endpoint that doesn't exist on the backend yet,
placeholder dashboards proving the full auth → routing → sign-out round
trip, ESLint/TypeScript both clean, a production web-bundle export
confirmed to build successfully end to end.

## Phase 1 — Real auth (backend + mobile)

**Backend work required first** — this phase cannot complete on the mobile
side alone:

- `POST /api/v1/auth/mobile-login` — validates `identifier` (email or
  mobile) + `password`, issues a Sanctum personal access token via
  `$user->createToken($deviceName)`, returns `{ token, user }` in the same
  envelope shape as the web app's `AuthenticatedUser`.
- `POST /api/v1/auth/logout` (mobile variant, or branch the existing one) —
  revokes `$request->user()->currentAccessToken()`.
- Register the `sanctum` token guard alongside the existing cookie guard on
  the `api` middleware group (Sanctum supports both simultaneously; this
  does not change how the web app authenticates).
- Decide how `required_action` (forced password change, 2FA challenge,
  email verification) is handled for a token session — the web app
  redirects to a page; mobile needs an equivalent screen or an inline flow.

**Mobile work**, once the endpoint exists:

- Point `src/lib/auth/api.ts`'s `loginWithPassword()` at the real path if it
  differs from the placeholder.
- Build the required-action screens (change password, 2FA challenge) —
  currently unhandled; a user who needs one will just fail to reach their
  dashboard.
- Forgot-password flow.
- Biometric unlock (Face ID / fingerprint) as a convenience layer on top of
  the stored token — not a replacement for it.

## Phase 2 — Student portal

**Done:** Dashboard (real data — next class with live join, active courses,
upcoming tests, announcements, continue-watching, payment-review banner),
My Courses (list, real data), Payments (list with infinite scroll and status
tracking), Course workspace (`courses/[enrollmentId]/` — overview with
progress breakdown and batch details, syllabus with a working lesson-complete
toggle, class schedule with live join, recordings that open a fresh signed
playback URL per tap, resources with signed per-tap downloads, tests, and
announcements), Receipts (`receipts/` — list with infinite scroll, detail
view, signed PDF download; an approved `PaymentCard` now links straight to
its receipt), Notifications (bell icon on the Dashboard header with an unread
dot, tap an item to mark it read — kept off the tab bar since 5 tabs is
already the practical limit). Shared pieces added along the way:
`api-dtos.ts`/`adapters.ts`/`format.ts` (mirrors the web app's own split),
`CourseCard`/`ProgressBar`/`StatusBadge`/`PaymentCard`/`ReceiptCard`/
`AnnouncementCard` components, `resolveAssetUrl()` for turning the backend's
origin-relative thumbnail/media paths into a URL the app can actually load.

**Known deferred gap:** recordings and resources currently hand off to the
device's own player/browser via `Linking.openURL()` rather than an in-app
player. A real embedded player needs to render the anti-piracy watermark
overlay (`watermark` in the playback response) — that's real, dedicated work,
not something to bolt on inline, so it's left as an explicit follow-up rather
than a silently-skipped requirement.

Also done: Profile & Security (`profile/` — edit name/email/mobile, change
password, two-factor setup with manual-key entry and an "open in
authenticator app" deep link since no QR-rendering library is installed,
active sessions with a password-confirmed "sign out everywhere else"), and
Support (`support/` — contact info, FAQs, ticket list, new-ticket form with
the same 6 issue-type categories as the web app). No ticket-thread detail
screen: the backend has no student-scoped endpoint for it — see below.

**A real backend bug was found and fixed along the way:** `PUT
/account/password` and `POST /account/two-factor/setup` both called
`$request->session()->...` unconditionally, which throws "Session store not
set on request" for any bearer-token (mobile) request — completely broken,
un-tested, and never exercised until this pass. Fixed: `TwoFactorController`
now stores the pending secret in cache instead of the session (works
identically for web and mobile); a new `AuthenticationRevoker` service
handles "sign out everywhere else" for both web sessions and Sanctum tokens
uniformly, used by both `PasswordController` and `SessionController`. Covered
by 4 new tests in `AccountSecurityTest.php`; full suite at 130/130.

**Found but explicitly NOT fixed (flagged for a product decision, out of
mobile's scope):** the web app's `/student/support/[ticketId]` page calls
`GET /api/v1/support/tickets/{id}`, which is gated by `permission:support.view`
— a permission real students don't have. That page 403s for an actual
student today. Same bug class as the earlier Enrollment Requests removal:
a feature that looks built but was never reachable by its intended user.

**Added after live testing — full parity was the explicit ask, not the
"lighter than web" version this had drifted into:**

- **Course catalogue + enrollment** (`courses/explore/`) — browse published
  courses (search, infinite scroll), a detail screen with batch selection,
  free-batch enrollment in one tap (`POST /student/enroll-free`), and for a
  paid batch a real payment submission screen (`courses/explore/[slug]/pay`)
  reusing the same `ProofCapture` camera/gallery component built for staff,
  plus the new `DateTimeField` for "when did you pay?". This was the
  fundamental gap: previously a new student could not join a course from the
  app at all.
- **Test-taking** (`tests/[testId]/`) — a launch/instructions screen
  (`GET .../tests/{id}/launch`), the actual runner (`attempt.tsx`: question
  navigation, single/multiple/true-false/short-text input types, flagging,
  a live countdown computed against the server's clock — not the phone's —
  periodic autosave every 20s, auto-submit at zero), and a result screen
  handling both released and pending-grade states. Previously the test list
  existed but there was no way to actually take a test from mobile at all.

**Remaining:**

- Push notifications (device token registration) — Phase 6; the fetch-based
  feed built here stays as the always-available fallback.
- eSewa online checkout, cross-course Recordings/Resources library pages
  (the equivalent content is reachable per-course already), a dedicated
  payment-detail screen (the list already shows full status/reason).

## Design pass (this session)

Applied across every Phase 2 screen, informed by a quick pass on current
(2026) mobile UI guidance — sources noted in-chat, not duplicated here:

- Every card gained a soft shadow + lighter border (`shadow-sm` +
  `border-slate-100`, was a flat `border-slate-200` with no elevation).
- `Skeleton`/`CardSkeleton`/`ListSkeleton` (`src/components/skeleton.tsx`,
  Reanimated-driven) replaced bare spinners on every first-load list screen —
  perceived as faster than a spinner at the same real wait time.
- Icon-only buttons bumped from 40×40 to the 44×44pt minimum touch target.
- A real, previously-shipped bug: the login screen's `justify-center`
  content container broke `KeyboardAwareScrollView`'s scroll-to-focused-input
  math — stuck on the first field, overshot on the second. Fixed by
  anchoring the form to the top instead of centering it; the same fix is
  applied to every form built afterward.
- `FormField` (`src/components/form-field.tsx`) is now the one way every
  screen renders a labeled text input, replacing five-plus copies of the
  same Controller/TextInput/error-text boilerplate.
- **Deliberately not done:** dark mode (would touch every screen for a
  first-cut app with no user-visible demand yet) and haptics
  (`expo-haptics` isn't in the currently-installed dev build; adding it
  without a new EAS build would crash on first use rather than degrade
  gracefully). Both are easy, low-risk additions once there's a reason to
  cut a new build anyway.

## Phase 3 — Teacher portal

**Done:** Dashboard (real data — metrics, next-session hero card with a
working Start action, follow-ups the teacher owes, today's classes, batch
summaries), Batches (list + detail with roster and progress/attendance
counts), Classes (full list with infinite scroll and Start), Attendance
(session list with awaiting/finalized metrics, per-student marking across
all 5 statuses, Save draft / Finalize), Announcements (list + new-announcement
form with a batch picker). Profile & Security reused wholesale from the
student portal via the `src/components/account/` extraction — see below.
5 tabs: Dashboard, Batches, Classes, Attendance, Profile; Announcements
reached from a header icon on Dashboard rather than a 6th tab.

**Refactor that paid for itself immediately:** pulled the 4 profile
sub-screens (edit, password, two-factor, sessions) out of
`(student)/profile/` into `src/components/account/*-screen.tsx` — they were
already 100% portal-agnostic (`router.back()`, no hardcoded paths), so this
was a pure move, zero logic changes. Both `(student)/profile/` and
`(teacher)/profile/` are now one-line re-exports pointed at the same
components. Security-sensitive code (password change, 2FA) now has exactly
one copy instead of drifting across every portal it gets added to.

**Scheduling added after live testing** (`classes/new`, `classes/recurring`
— batch picker, topic, date/time via the new `DateTimeField` component,
duration, and for recurring: end date, daily/weekly frequency, day-of-week
picker). This reverses the "authoring stays desktop" call above for
scheduling specifically, per direct feedback. Needed installing
`@react-native-community/datetimepicker` — a genuine new native module, so
**a fresh EAS build is required before this screen works** (unlike
everything else in this phase, which was pure JS).

**Deliberately deferred, not silently dropped:**

- Zoom participant-report import (`POST .../attendance/import`) as a
  pre-fill shortcut — manual marking already fully covers the required
  workflow; import is a convenience layer on top, not a blocker.
- Content authoring (recordings/resources/tests) stays out of mobile per
  the original feature audit — a desktop task, revisit only if real usage
  data says otherwise.

## Phase 4 — Staff portal

**Done:** Dashboard (composed client-side from the students + pending-payments
lists, same approach as the web app, since there is no single
`Staff\DashboardController`; metric tile, quick actions, recent students,
awaiting-review payments), Students (search with debounce + infinite scroll,
detail, new-student form with link-vs-temporary-password choice), the
**enroll flow** (`students/enroll` — course → batch → payment-method chip
pickers, amount auto-fills from the batch price but stays editable for
waivers, camera-or-gallery payment-evidence capture via the new
`ProofCapture` component wrapping `expo-image-picker`, which was already
installed so this needed no new native dependency), Payment Review
(`payments/` — status-filtered queue, detail with the duplicate/mismatch
check banner, Approve with a native confirm dialog, Reject/Flag with a
required reason). Profile & Security reused via the same
`src/components/account/` extraction as Teacher.

**Course creation added after live testing** (`(staff)/courses/new` — title,
category, descriptions, free/paid + price, a publish toggle gated on the
`courses.publish` permission, optional camera/gallery thumbnail upload
after creation). Reverses the original "authoring stays desktop" call for
this one screen specifically, per direct feedback — category/syllabus
editing stay out for now, unasked-for.

**Support ticket management added after live testing** (`(staff)/support/` —
reached from a Dashboard quick action, not a 5th tab): a queue screen with
the same open/pending/resolved/closed metrics the web queue shows plus
search and status filters, and a thread/detail screen (`[ticketId]`) with
the full message history, a reply composer (with an internal-note toggle
that's hidden entirely for a viewer without `support.manage`, matching the
backend's own filtering — an internal note never even reaches a non-staff
`can_manage: false` response), and status/priority/assignee controls as
chip pickers. This is the one Staff route that's also reachable by Admin in
the web app (`Support\TicketController` is gated by permission, not role) —
mobile only wires it into the Staff portal for now since that's the gap the
user flagged; Admin gets its own pass in Phase 5 rather than assuming this
screen just works there unverified.

**Adjustments and refunds added after live testing** (`(staff)/adjustments/`,
`(staff)/refunds/` — both reached from Dashboard quick actions): list
screens with the same metrics tiles the web queues show (pending refunds,
completed this month, refunded amount / policy exceptions), and `new`
screens built around a shared `PaymentPicker` component (debounced
search-by-name-or-mobile over `GET /accounting/payments?q=`, mirroring the
web app's own picker so staff never hand-type a `PAY-...` id for an
irreversible financial action). Adjustments capture type (Credit/Debit/
Reversal/Refund — the backend normalizes these into its own
Discount/Waiver/Correction/Penalty vocabulary server-side, same as web),
amount, an authorization reference, and a reason. Refunds capture amount,
optional method/reference, and a reason; completing a pending refund
("Mark as paid") is an inline expand-in-place form rather than
`Alert.prompt`, which is iOS-only in React Native and would have silently
done nothing on Android.

**Payment submissions history + Receipts added after live testing**
(`(staff)/submissions/` and `(staff)/receipts`, both reached from Dashboard
quick actions): a "My submissions" screen — infinite-scroll list of every
payment staff have captured on a student's behalf, status-filtered, reusing
the existing `PaymentQueueItem`/`PaymentQueueCard` types and component
(the `Staff\PaymentSubmissionController::payload()` shape is field-for-field
identical to the accounting queue's) — and a detail screen that
deliberately stays read-mostly: proof viewer and "Resend status
notification" only, no approve/reject/refund actions, mirroring the web
app's own "Approval boundary" note that corrections belong in the audited
Payment Review or Adjustments workflow, not here. Receipts is a flat list
with the same today/month/adjusted metrics the web receipts page shows,
reading the same `GET /accounting/receipts` endpoint (renamed the mobile
`LedgerReceipt`/`ApiLedgerReceipt` types to avoid colliding with the
already-existing student-facing `Receipt` type, which has a different
shape for a different endpoint).

**Deliberately deferred:**

- Backdating a payment's date on the enroll form — it always submits "now"
  (accurate for the actual use case: staff capturing a payment in person at
  the moment it happens).
- Category/syllabus authoring stays desktop-only for now.
- A generic "new payment submission" entry point with an inline student
  search — enrollment currently starts either from creating a new student
  or from an existing student's detail page, both of which are real,
  complete paths; a third redundant entry point didn't seem worth it yet.

Everything else explicitly flagged during live testing in this phase
(course creation, support tickets, adjustments, refunds, payment history,
receipts) has been built.

## Phase 5 — Admin portal

**Done:** Dashboard (key metrics, monthly collections, and the same
`AdminAttentionService` feed the web notification bell uses — payments
pending, unfinalized attendance, Zoom sync warnings, draft batches), Users
(search with debounce + infinite scroll, detail with metrics, enrollments,
and recent audit activity). Profile & Security reused via the shared
`src/components/account/` components — two-factor is more relevant here
than anywhere else, since `privileged_mfa` targets admin/super_admin by
default.

**User management actions added** (`(admin)/users/new`, and the detail
screen extended in place): account creation with the same role picker and
reset-link-vs-temporary-password choice as web (`POST /admin/users`,
temporary password shown once with `<Text selectable>` for long-press copy
— no new native dependency needed for that), an in-place profile/role
editor (`PATCH /admin/users/{id}`), the account-controls panel (password
reset, revoke sessions, MFA reset, suspend/reactivate — all through
`POST /admin/users/{id}/actions/{action}`, each mirroring web's
reason-required and confirm-before-destructive rules), the recent-activity
feed (the backend already returned this in `show()`; the old detail screen
just wasn't rendering it), and an archive control (`DELETE /admin/users/{id}`,
soft-delete, blocked server-side for self-archival, the last Super Admin, or
active enrollments — the mobile screen surfaces whatever the server's
error message says rather than a generic failure, since that message is
the only thing that tells the admin what to do next).

**Categories added** (`(admin)/categories`, flat screen reached from a
Dashboard quick action — no separate new/edit routes, mirroring the web
app's own single-page list-plus-inline-form layout): full CRUD against
`Admin\CategoryController` (create, edit, delete blocked server-side and
shown disabled in the row when `course_count > 0`, matching web exactly).

**Courses added** (`(admin)/courses/`): list with search + published/draft
filter, a shared `AdminCourseFormFields`/`useAdminCourseForm` pair in
`src/components/admin/admin-course-form.tsx` (title→auto-slug while
untouched, slug locked once editing — matching web's own UI-level lock even
though the backend technically still accepts a slug change on `PATCH`,
course code, category picker, short/full description, access type +
price + original price, features chips), `new.tsx` (Save as draft / Save
and publish, then an optional post-create thumbnail step — same two-step
pattern as Staff's course creation, since `POST .../thumbnail` needs an
existing course id), and `[courseId]` (same fields pre-filled, thumbnail
replace/remove, a Published switch, and an archive control that surfaces
the server's own conflict message — "N students with active access" /
"still has open batches" — rather than a generic failure). Generalized
`ProofCapture` with an optional `label` prop so the same camera/gallery
picker built for payment evidence could be reused here without a
misleading "Payment evidence" caption on a course-thumbnail picker.

**Batches added** (`(admin)/batches/`): list with search + status filter,
capacity progress bar per row, and a shared `AdminBatchFormFields`/
`useAdminBatchForm` pair (title, course picker, teacher multi-select
checklist — reading `GET /admin/teachers`, and deliberately not the public
teacher-profile endpoint, since an unpublished teacher account still needs
to be assignable — capacity, optional start/end/access-until dates via
`DateTimeField` with an explicit "Set date"/"Clear" affordance since these
are nullable on the backend unlike every other `DateTimeField` use so far,
price, a free-text schedule summary, and operational status). Deliberately
did **not** build `schedule_days`/`class_start_time`/`class_end_time` even
though the backend validates them — read `BatchEditor` on web first and it
only ever sends `schedule_summary`, so those fields are backend-accepted
but web-app-unused; matching web's actual behavior here, not its full
validation surface, is the correct bar for parity. `create/update` both
route through the one form; archive mirrors Courses' pattern exactly
(same conflict-message-surfaced-as-is approach).

**Explicitly out of scope for this slice, tracked separately:** the
Faculty Directory (`Admin\TeacherController::upsert` — headline, subjects,
bio, public visibility for a teacher's profile page) is a distinct feature
from batch-teacher assignment; the batch form only needed the teacher list
for its picker, not profile editing.

**Classes added, by direct reuse rather than reimplementation** —
`(admin)/classes/`, mirroring exactly how the web app does this
(`admin/classes/page.tsx` is a one-line `export { default } from
"@/app/teacher/classes/page"`). This works because `EnsureRole` middleware
(`role:teacher`) has an explicit `$user->isAdmin()` bypass, and
`AccessGuard::taughtBatchIds()` special-cases admin/super_admin to return
every batch id instead of scoping to what the caller actually teaches — so
hitting the teacher classes endpoints as admin genuinely shows every class
across the institution, not an empty screen. Extracted the list screen's
content into `src/components/classes/classes-list-screen.tsx` (parameterized
`newHref`/`recurringHref` props, since the old inline version hardcoded
`/(teacher)/classes/...` navigation — the thing the web app's own comment on
`admin/classes/page.tsx` says was explicitly fixed there:
*"the admin menu used to link straight at /teacher/classes... an
administrator stays an administrator throughout"*); `(teacher)/classes/index.tsx`
and `(admin)/classes/index.tsx` are now both thin wrappers passing their own
prefix. `new.tsx` and `recurring.tsx` needed no such extraction — they were
already portal-agnostic (`router.back()` only, same as the account
screens) — so `(admin)/classes/{new,recurring}.tsx` are plain one-line
re-exports of the teacher versions, same pattern as web.

**Announcements added** (`(admin)/announcements`, flat screen with a
composer above a history list, same single-page shape as Categories) —
**built against the real `Admin\AnnouncementController::store()` contract
rather than the web app's own `AnnouncementComposer` component**, which
sends mismatched field names (`audience_type`/`audience_id`/`channel:
in_app`/`scheduled_at`/`status: draft|published`) that don't match what the
backend actually validates (`audience`/`course_id`|`batch_id`|`role_key`/
`channel: portal|email|sms|whatsapp`/`publish_at`, no client-supplied
`status` at all — it's derived server-side from whether `publish_at` is in
the future). Copying the web form here would have shipped a mobile feature
that 422s on every submit. Composer: title, optional summary, body,
audience chips (All/Course/Batch/Role) with a conditional target picker,
channel chips, an optional schedule-for-later toggle (off = publish
immediately, on = `DateTimeField` date + time combined into `publish_at`,
matching the `classes/new` combine-date-and-time pattern), a link field,
and a pin toggle. No "Save as draft" button, because `store()` has no path
to create one — `AnnouncementStatus::Draft` exists as an enum case but is
only ever reachable by editing an existing announcement's status
afterward, not at creation.

**Audit Log added** (`(admin)/audit-log`, read-only infinite-scroll list) —
search plus the same four grouping filters as web
(`identity_access`/`payments`/`learning_operations`/`settings`, matched
against `AuditLogController::ACTION_GROUPS`' actual prefix lists rather
than reinvented). **FAQs added** (`(admin)/faqs`, same single-page
composer-plus-list shape as Categories) — question, answer, category,
published toggle; unlike Categories' delete, `FaqController::destroy()` has
no in-use guard at all, so removal is a plain confirm, not a
conditionally-disabled button.

**Integrations added** (`(admin)/integrations`, a Zoom/YouTube provider
switcher over one screen): connection status with missing-env-var list,
Connect (disabled until credentials exist server-side — connecting never
"succeeds" against missing config)/Disconnect/Health-check actions, recent
records rendered generically (each provider's record shape is a flat
key-value object — Zoom's `ClassSession` rows, YouTube's `Recording`
rows — so the row renderer iterates `Object.entries()` rather than needing
a provider-specific component), and recent integration events.

**Roles added** (`(admin)/roles/`): list, create, and edit, with a shared
`AdminRoleFormFields`/`useAdminRoleForm` pair rendering permission
checkboxes grouped by the backend's own `group` field (no mobile-side
grouping logic invented). The `super_admin` role gets a dedicated read-only
branch in `[roleId].tsx` — matching `RoleController::update()`'s own
refusal ("the super admin role always holds every permission and cannot be
edited") — showing user count only, no form, no delete. Any other
protected role hides the delete control entirely; a non-protected role's
delete surfaces the server's real "reassign the users holding this role
first" conflict rather than swallowing it.

**Platform Settings added** (`(admin)/settings`, one large scrollable
screen — the biggest single screen built this session): institution
branding (name/short name/tagline/contact fields + logo and favicon
upload/remove via `ProofCapture`), payment methods (each editable inline —
name, account details, active toggle, QR image upload/remove per method),
security policy (public registration, email verification, privileged MFA,
force password change, session timeout, failed-login threshold, lockout
minutes), operations toggles, feature flags (each rendered with the
backend's own `ready`/`missing` status — a flag can show "on" while also
showing "waiting on: Merchant code, Secret key" rather than lying about
whether it actually works), SMS provider config, eSewa merchant config,
and content watermark settings. SMS token and eSewa secret key are
write-only fields matching the backend exactly: the field shows "leave
blank to keep the stored one" once `token_configured`/`secret_key_configured`
is true, and an empty submission is never sent as the literal value (kept
`undefined` so the backend's own "blank means unchanged" rule holds).
One local `Values` state object covers every section; a single "Save
settings" PATCH sends everything at once, same as the web app's
`SettingsManager`.

**Reports added** (`(admin)/reports`, replacing the old "coming soon"
placeholder): three tabs matching `Admin\ReportController` exactly —
Academic (every batch's current standing: attendance/test/syllabus/
recording averages plus a per-batch follow-up count), Enrollments
(monthly, defaults to the last 6 months server-side), Finance (daily,
defaults to the last 30 days server-side, gross/refunds/adjustments/net).
No filter UI in this first pass — the backend's own defaults are
reasonable and the row counts are small enough that plain cards render
everything at once; date-range filtering can follow if it's actually
asked for. No adapters were needed for these three report types: the
backend already returns camelCase keys (`testAverage`, `followUp`), unlike
every other admin endpoint's snake_case, so the `Api*ReportRow` DTOs are
used directly as the screen's data type rather than round-tripped through
a same-shaped domain type for no reason.

**Admin portal is now feature-complete against the web app**, matching the
full-parity mandate. Every item from the original "everything, same order
as web" plan is built and verified: Dashboard, Users (browse + full
account-lifecycle actions), Categories, Courses, Batches, Classes,
Announcements, Audit Log, FAQs, Integrations, Roles, Platform Settings,
Reports.

## Phase 6 — Polish

**Done — push notifications**, full stack:

- Backend: `device_tokens` table (`user_id`, globally-unique `expo_push_token`,
  `platform`), `DeviceTokenController` (`POST`/`DELETE
  /api/v1/account/device-tokens`, role-agnostic like the rest of `Account`),
  and `PushNotificationClient` — mirrors `SmsClient`'s exact contract (never
  throws, logs every attempt to `IntegrationEvent`, needs no admin-configured
  credentials since Expo's push endpoint is free). Wired into
  `NotificationDispatcher` as a channel *independent* of SMS (`wantsPush()`,
  not gated on `SmsClient::isReady()`) for the three events named in the
  original plan: `paymentApproved`, `paymentRejected`, `classStarted`. A
  `DeviceNotRegistered` response from Expo prunes the stale token
  automatically. Covered by 5 new tests in `PushNotificationTest.php`
  (`Http::fake()`, no real network calls) — full suite now 135/135.
- Mobile: `src/lib/push/register-device.ts` registers the device's Expo push
  token on sign-in and on every cold start once already authenticated
  (harmless no-op re-registration via the backend's `updateOrCreate`), and
  unregisters on sign-out — the unregister path deliberately never triggers
  a fresh permission prompt. Foreground notification display and tap-to-
  navigate (payment notifications → Payments, class-started → Dashboard)
  wired in the root `_layout.tsx`. `expo-notifications` was already
  installed from scaffolding, so no new dev build is required — only the
  `expo-notifications` config plugin was newly added to `app.json` for
  proper Android notification-channel/icon styling, which *does* need a
  fresh build to take visual effect (core send/receive should already work
  on the currently-installed build; this could not be verified on a real
  device from here).
- Not done: `enrollmentActivated`, `accessEndingSoon`, `supportReplied` stay
  SMS-only — outside the three events the plan named. The teacher-facing
  "students notified" count after starting a class still reflects SMS
  recipients only, not push.

**Done — performance audit:**

- FlashList vs. FlatList reviewed screen-by-screen. Found and fixed one real
  miss: `(teacher)/classes.tsx` (an infinite-scroll, all-time, cross-batch
  class history — exactly the kind of list the standard calls out) was
  using `FlatList`; switched to `FlashList`. Everything else checked out —
  screens using `FlatList` are all genuinely bounded (one batch's roster,
  one user's enrollments, a student's own course list), not undersized
  versions of a growing list.
- `expo-image` usage audited: every network image (course thumbnails,
  avatars, recording thumbnails) already sets both `contentFit` and a
  `placeholder` blurhash; local camera/gallery captures in `ProofCapture`
  correctly skip the blurhash since there's no network fetch to mask.
- Not done: a React DevTools Profiler sweep for unnecessary re-renders —
  this needs a live device/simulator session to actually measure, which
  isn't possible from here; per the coding standards doc's own rule
  ("don't optimize without measuring first"), speculative memoization
  wasn't added without that measurement.

**Not done — offline handling.** Roadmap already called this "unlikely to
be worth it for most screens here"; nothing changed that judgment.

**Not done — app store assets and submission.** Needs the institution's
real logo/icon/splash art (still the Expo placeholder), a confirmed real
bundle identifier (`com.aimerszone.mobile` is a placeholder), and privacy
manifest / data-safety form content — all business inputs, not something
to generate. EAS Build + Submit configuration is mechanical once those
exist.

## Live-testing round 2 — auth, navigation, a real backend bug

**A genuine backend bug, found and fixed:** `Account\ProfileController::sessions()`
called `$request->session()->getId()` unconditionally to mark which listed
session is "current." A token-authenticated (mobile) request has no session
store at all, so this threw "Session store not set on request" and crashed
the entire profile endpoint — for every mobile user, on every portal,
every time. `AccountSecurityTest.php`'s own docblock already flagged this
exact failure mode as previously fixed for password-change/2FA/revoke-others;
this was the same bug in a sibling method (`sessions()`, the list-builder)
that the earlier pass missed. Fixed with `$request->hasSession() && ...`,
and a new regression test (`test_a_token_authenticated_request_can_view_the_profile_with_a_session_listed`)
that forces `session.driver` to `database` and seeds a real row — the test
environment's default `SESSION_DRIVER=array` skips this code path entirely,
so a naive test would have passed regardless of whether the bug was fixed.
Verified the test actually catches the regression by reverting the fix and
watching it fail with the exact reported error, then restored it. Full
suite: 136 passed.

**Student self-registration added** (`(auth)/register.tsx`) — the web app
has had one since early in the project (`RegisterForm`, `POST
/api/v1/auth/register`); mobile never got a matching screen. One backend
wrinkle: `RegisterController` only ever establishes a web cookie session
(`auth()->login()`), never issues a Sanctum token, so it's useless to a
native app on its own. No backend change needed — `registerStudent()` in
`src/lib/auth/api.ts` calls `register` to create the account, then
immediately calls the existing `mobile-login` endpoint with the same
credentials to get a real token, the same two-step trick working entirely
from calls that already existed independently.

**Forgot-password added** (`(auth)/forgot-password.tsx`) — thin wrapper
around the existing `POST /api/v1/auth/forgot-password`, which already
handles identifier-or-email resolution and always returns the same message
regardless of whether the address matched (so this screen has nothing to
guess at). Reset itself completes via the emailed link, not an in-app
screen — same as web already does.

**Login screen redesigned** — was two bare fields and a button with no
branding, no forgot-password link, and no way to reach registration
(confirmed by reading the file: this was a real, not perceived, gap). Added
the app icon, a "Forgot password?" link next to the password field, and a
"Create an account" link at the bottom.

**Added a lightweight side-menu ("SideDrawer"), deliberately not a real
React Navigation Drawer navigator.** A live-testing complaint asked for
"a side menu for extra things, like other apps" — but retrofitting
`@react-navigation/drawer` properly means nesting every existing tab
screen one folder deeper (`(portal)/(tabs)/dashboard` instead of
`(portal)/dashboard`), which would change dozens of already-working,
already-referenced route paths (push-notification tap targets,
`preferredPortalHome()`, every cross-link) across all 4 portals for a
feature that's purely additive. Installed `@react-navigation/drawer` to
confirm the tradeoff, then removed it in favor of `src/components/side-drawer.tsx`:
a Zustand-backed (`src/lib/ui/drawer-store.ts`) modal overlay that pushes to
the exact same existing routes any other button already does — zero risk
to existing navigation. A hamburger icon (`DrawerMenuButton`) was added to
each portal's Home/Dashboard screen header. Per-portal contents:
- **Student**: Payments, Receipts, Support (all otherwise reachable only
  as bottom tabs or from Profile — now also one tap from Home).
- **Teacher**: Announcements (the one thing not already a tab).
- **Staff**: New course, Support tickets, Adjustments, Refunds, My
  submissions, Receipts — everything this session added that isn't a tab.
- **Admin**: every non-tab screen (Courses, Batches, Classes, Categories,
  Announcements, Audit log, FAQs, Integrations, Roles, Platform settings) —
  the same list as the Dashboard's own "Manage" section, now reachable
  from anywhere, not just Home.

Extracted `preferredPortalRole()` out of `preferredPortalHome()` in
`src/lib/auth/roles.ts` (previously the role lookup and the `/dashboard`
suffix were fused into one function) so the drawer could pick the right
item list without duplicating the role-priority logic.

**Explicitly deferred, not silently dropped:** a real drawer *navigator*
(if the overlay approach ever feels insufficient), audit of every other
`as never` route-string cast in the codebase for the same silent-typo risk
`profile-overview-screen.tsx` already carried (none found broken this pass,
but the pattern itself is worth a dedicated look), and a full pixel-level
visual-consistency pass across every icon-button (this pass fixed the
student/teacher dashboard bell/megaphone buttons specifically — missing
`shadow-sm` — because they were the ones named in feedback, not a scan of
every button in the app).
