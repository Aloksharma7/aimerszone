# Verifying this build

Nothing in this repository has been executed: it was written in an environment
without PHP or Composer. It is statically consistent — every `App\` reference
resolves to a defined class, every route target exists, and all files parse-
balance — but the first real run is where genuine typos surface. This checklist
is the fastest route from "downloaded" to "known good".

## 1. Install and migrate

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
```

`migrate --seed` creates roles, permissions, settings, payment methods and the
first administrator, and prints the administrator password once.

If a migration fails, that is the highest-value bug to report back — the schema
is the foundation everything else assumes.

## 2. Optional: sample institution

```bash
php artisan db:seed --class=Database\\Seeders\\DemoContentSeeder
```

Creates a course, a batch with a teacher, past and upcoming classes, recordings,
FAQs, and five accounts (all password `Demo12345`, all forced to change it):

| Account | Role |
|---|---|
| `teacher@example.test` | Teacher with an assigned batch |
| `officer@example.test` | Enrollment officer |
| `accountant@example.test` | Accountant with a payment waiting |
| `student@example.test` | Student with an active enrollment |
| `applicant@example.test` | Student whose payment is under review |

This is never run by `DatabaseSeeder`, so a production install cannot pick up
demo students by accident.

## 3. Run the test suite

```bash
php artisan test
```

The suite runs on in-memory SQLite, so no MySQL server is required. It covers
the boundaries most likely to leak:

- **Student isolation** — one student reading another's workspace or receipt,
  an expired enrollment reaching a recording, an unreleased recording, a
  suspended account.
- **Assessment integrity** — correct answers absent from student payloads,
  refresh resuming rather than consuming an attempt, an expired attempt still
  graded from what was autosaved, results withheld until the release policy is
  met, the builder closed to students.
- **Payment approval** — approval creating exactly one enrollment and one
  receipt, self-approval blocked, double approval refused, rejection requiring a
  reason, refunds capped at the amount actually paid.
- **Portal boundaries** — a matrix of ten role/endpoint combinations, plus a
  teacher reaching only their own batches and an administrator unable to demote
  themselves.
- **Configuration** — a settings change reaching the public endpoint,
  maintenance mode pausing writes while leaving reads open, idempotency keys
  replaying rather than repeating.

## 4. Formatting

```bash
./vendor/bin/pint
```

## 5. Connect the frontend

Set the environment values in the README, start both servers, then walk:

1. `/` and `/courses` — public catalogue renders
2. `/login` — sign in as the administrator; expect the forced password change
3. `/admin/settings` — change the institution name, confirm it appears publicly
4. `/accounting/payments` — open the pending payment and approve it
5. `/student/dashboard` — sign in as the student, confirm the course appears

If step 4 produces an active enrollment and a receipt, the core money-to-access
path works end to end.

## Review pass — findings and fixes

A full static review was run over the codebase after Phase 5. Four defects were
found and fixed; they are listed here because each one is the kind that survives
a casual read.

1. **`\DB::` would not resolve (fatal).** `config/app.php` had no `aliases`
   key, and Laravel 11+ only registers the root-namespace facade aliases listed
   there. Two files used `\DB::table(...)`, so the **student dashboard** and
   **password reset** would both have thrown *Class "DB" not found*. Fixed by
   importing the facade properly in both files, and by registering
   `Facade::defaultAliases()` so a future bare `DB::` cannot fatal.

2. **`email_verified_at` was not fillable (install blocker + silent bug).** It
   was written through mass assignment in three places. `AdministratorSeeder`
   meant `migrate --seed` would throw on a first install. Worse,
   `Account/ProfileController::update` would fail *silently* in production, so
   changing an email address kept the old verified status — a user could move to
   an unverified address and still read as verified. The attribute is
   deliberately left out of `$fillable` (a request body must never mark an
   address verified) and the three writers now use `forceFill`. A regression
   test covers the profile path.

3. **`MediaController` used the wrong Storage API for inline files**, plus a
   dead ternary (`$download && $inline ? $path : $path`). `download()` sets an
   attachment disposition that the inline header then fought with. Inline
   responses now use `Storage::response()`.

4. **The web middleware group was applied twice** to the signed media routes:
   `media.php` listed `'web'` even though it is required from `routes/web.php`,
   which already applies it. That would run `StartSession` and `EncryptCookies`
   twice per request.

Twelve unused imports were also removed.

### Second pass

A further review, targeting schema and contract round-trips rather than syntax,
found four more issues:

5. **The attendance register rejected "Review" (422).** The teacher's attendance
   screen offers Present / Late / Absent / Excused / **Review**, but
   `AttendanceStatus` had no `Review` case, so `Rule::in(...)` rejected it — and
   because the register is saved as one payload, a single row marked Review
   failed the **entire** save with a bare validation error. `Review` is now a
   real status meaning "not decided yet": it never counts as attended, and
   finalizing is refused while any row still carries it, since freezing an
   undecided register would feed a misleading attendance percentage into student
   progress.

6. **Refunds could be requested but never completed.** A refund was created with
   status `requested`, and nothing anywhere set `processed` — while both finance
   reports sum only processed refunds. Recorded refunds were therefore invisible
   in every report. Added `POST /accounting/refunds/{refund}/complete`, with the
   same separation of duties as payments: whoever requested the refund cannot
   record the payout.

7. **Enrollment exception requests were a dead end.** Staff could raise a
   scholarship or transfer request, but no endpoint could ever decide one, so a
   free seat could not actually be granted. Added
   `GET /admin/enrollment-requests` and
   `POST /admin/enrollment-requests/{enrollmentRequest}/decision`. Approval
   records the basis on the seat (`free` for a scholarship or exception, `staff`
   for a transfer), and the requesting officer cannot approve their own request.

8. **The enrollment report counted sources nothing wrote.** Its `free` and
   `transfers` columns queried `source` values that no code path produced, so
   both were permanently zero. Fixed as a consequence of (7) — the approval path
   now writes them.

Also verified clean in this pass: all 103 eager-load column selects resolve to
real columns; every relation named in `with()` / `load()` / `whereHas()` exists;
450 direct column references check out against the migrations; model-to-table
mapping is correct for all 37 models.

Verified clean in the same pass: every `authorize()` call maps to an existing
policy method; all 156 route parameters match their controller signatures; every
query scope used is defined; no `update()` call passes a non-fillable key;
migrations are portable across MySQL and SQLite; the raw aggregate fragments are
valid under `ONLY_FULL_GROUP_BY`.

## Known gaps

- Receipt PDFs are not generated yet; the receipt record and its immutable
  snapshot exist, and the download route is wired, but no PDF is written.
- `topic_performance` on the attempt result returns an empty array until
  questions carry topic tags.
- Zoom attendance import needs `report:read:admin` and a paid Zoom plan. On a
  free plan it returns an empty report with an explanatory message rather than
  failing.
- Email delivery uses the `log` mailer by default. Configure SMTP before relying
  on password reset links reaching students.
