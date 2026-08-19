# Frontend Route Map

Total App Router page routes: **108**.

All `/student`, `/teacher`, `/staff`, `/accounting`, and `/admin` routes are protected by the session/role layout and the proxy cookie gate.

## Public

- `/`
- `/about`
- `/batches/[batchPublicId]`
- `/contact`
- `/courses`
- `/courses/[courseSlug]`
- `/faq`
- `/free-learning`
- `/payment-instructions`
- `/privacy`
- `/recording-policy`
- `/refund-policy`
- `/results`
- `/services`
- `/teachers`
- `/teachers/[teacherSlug]`
- `/terms`

## Authentication

- `/change-password`
- `/forgot-password`
- `/login`
- `/register`
- `/reset-password`
- `/two-factor-challenge`
- `/verify-email`

## Student

- `/student/attempts/[attemptId]`
- `/student/courses`
- `/student/courses/[enrollmentId]`
- `/student/courses/[enrollmentId]/announcements`
- `/student/courses/[enrollmentId]/live`
- `/student/courses/[enrollmentId]/recordings`
- `/student/courses/[enrollmentId]/recordings/[recordingId]`
- `/student/courses/[enrollmentId]/resources`
- `/student/courses/[enrollmentId]/syllabus`
- `/student/courses/[enrollmentId]/tests`
- `/student/dashboard`
- `/student/explore`
- `/student/explore/[courseSlug]`
- `/student/notifications`
- `/student/payments`
- `/student/payments/[paymentId]`
- `/student/payments/new`
- `/student/profile`
- `/student/receipts/[receiptId]`
- `/student/recordings`
- `/student/recordings/[recordingId]`
- `/student/resources`
- `/student/support`
- `/student/tests`
- `/student/tests/[testId]`

## Teacher

- `/teacher/announcements`
- `/teacher/attendance`
- `/teacher/batches`
- `/teacher/batches/[batchId]`
- `/teacher/batches/[batchId]/recordings`
- `/teacher/batches/[batchId]/tests`
- `/teacher/classes`
- `/teacher/classes/new`
- `/teacher/classes/[sessionId]`
- `/teacher/classes/[sessionId]/attendance`
- `/teacher/content`
- `/teacher/dashboard`
- `/teacher/profile`
- `/teacher/tests/[testId]`
- `/teacher/tests/new`

## Enrollment Officer

- `/staff/courses`
- `/staff/courses/[courseId]`
- `/staff/courses/new`
- `/staff/dashboard`
- `/staff/enrollment-requests/new`
- `/staff/enrollments`
- `/staff/payment-submissions`
- `/staff/payment-submissions/[paymentId]`
- `/staff/payment-submissions/new`
- `/staff/students`
- `/staff/students/[studentId]`
- `/staff/students/new`
- `/staff/support-actions`

## Accounting

- `/accounting/adjustments`
- `/accounting/adjustments/new`
- `/accounting/dashboard`
- `/accounting/payments`
- `/accounting/payments/[paymentId]`
- `/accounting/receipts`
- `/accounting/refunds`
- `/accounting/reports/collections`
- `/accounting/reports/outstanding`

## Administration

- `/admin/announcements`
- `/admin/audit-logs`
- `/admin/batches`
- `/admin/batches/[batchId]`
- `/admin/batches/new`
- `/admin/courses`
- `/admin/courses/[courseId]`
- `/admin/courses/new`
- `/admin/dashboard`
- `/admin/finance`
- `/admin/integrations/youtube`
- `/admin/integrations/zoom`
- `/admin/learning-operations`
- `/admin/reports/academic`
- `/admin/reports/enrollments`
- `/admin/reports/finance`
- `/admin/roles`
- `/admin/settings`
- `/admin/users`
- `/admin/users/[userId]`

## System

- `/offline`
- `/unauthorized`
