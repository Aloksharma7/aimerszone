<?php

use App\Http\Controllers\Api\V1\Account;
use App\Http\Controllers\Api\V1\Accounting;
use App\Http\Controllers\Api\V1\Admin;
use App\Http\Controllers\Api\V1\Auth;
use App\Http\Controllers\Api\V1\PublicSite;
use App\Http\Controllers\Api\V1\Staff;
use App\Http\Controllers\Api\V1\Student;
use App\Http\Controllers\Api\V1\Support;
use App\Http\Controllers\Api\V1\Teacher;
use App\Http\Controllers\Api\V1\Webhooks;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API v1
|--------------------------------------------------------------------------
|
| Mirrors contract/openapi.yaml. Authentication is Sanctum stateful cookies:
| the browser primes /sanctum/csrf-cookie, then every mutation carries the
| XSRF header. No bearer tokens are issued to the browser.
|
| Middleware layering, outermost first:
|   auth        -> a session exists
|   account.usable -> the account is neither suspended nor locked
|   role        -> coarse portal gate
|   permission  -> fine-grained capability, mirroring the frontend guards
|   idempotent  -> replay protection for sensitive writes
|
| Policies still run inside the controllers: a role check is never treated as
| sufficient authorization for a specific record.
|
*/

Route::prefix('v1')->group(function () {

    /* ------------------------------------------------------------------
     | Authentication
     | ------------------------------------------------------------------ */
    Route::prefix('auth')->group(function () {
        Route::post('register', Auth\RegisterController::class)->middleware('throttle:auth');
        Route::post('login', [Auth\LoginController::class, 'store'])->middleware('throttle:auth');
        Route::post('two-factor-challenge', Auth\TwoFactorChallengeController::class)->middleware('throttle:auth');
        Route::post('forgot-password', [Auth\PasswordResetController::class, 'forgot'])->middleware('throttle:password-reset');
        Route::post('reset-password', [Auth\PasswordResetController::class, 'reset'])->middleware('throttle:password-reset');

        // Mobile app only — issues a Sanctum personal-access token instead of
        // a session cookie. See nepal-lms-mobile/docs/ARCHITECTURE.md.
        Route::post('mobile-login', [Auth\MobileLoginController::class, 'store'])->middleware('throttle:auth');

        Route::middleware('auth')->group(function () {
            Route::get('me', Auth\MeController::class);
            Route::post('logout', [Auth\LoginController::class, 'destroy']);
            Route::post('mobile-logout', [Auth\MobileLoginController::class, 'destroy']);
            Route::post('change-password', Auth\ChangePasswordController::class);
            Route::post('email/verification-notification', [Auth\EmailVerificationController::class, 'send'])
                ->middleware('throttle:6,1');
        });
    });

    /* ------------------------------------------------------------------
     | Public site — no authentication
     | ------------------------------------------------------------------ */
    Route::prefix('public')->group(function () {
        Route::get('settings', PublicSite\SettingsController::class);
        Route::get('payment-methods', PublicSite\PaymentMethodController::class);
        Route::get('categories', [PublicSite\CatalogueController::class, 'categories']);
        Route::get('courses', [PublicSite\CatalogueController::class, 'courses']);
        Route::get('courses/{slug}', [PublicSite\CatalogueController::class, 'course']);
        Route::get('teachers', [PublicSite\DirectoryController::class, 'teachers']);
        Route::get('faqs', [PublicSite\DirectoryController::class, 'faqs']);
        Route::post('support-requests', PublicSite\SupportRequestController::class)->middleware('throttle:public-forms');
    });

    /* ------------------------------------------------------------------
     | Webhooks — verified by provider-specific signature, not Sanctum
     | ------------------------------------------------------------------ */
    Route::prefix('webhooks')->group(function () {
        Route::post('zoom', [Webhooks\ZoomWebhookController::class, 'handle']);
    });

    /* ------------------------------------------------------------------
     | Account — any signed-in user
     | ------------------------------------------------------------------ */
    Route::prefix('account')->middleware(['auth', 'account.usable'])->group(function () {
        Route::get('profile', [Account\ProfileController::class, 'show']);
        Route::patch('profile', [Account\ProfileController::class, 'update']);
        Route::put('password', [Account\PasswordController::class, 'update']);
        Route::post('sessions/revoke-others', [Account\SessionController::class, 'revokeOthers']);
        Route::post('two-factor/setup', [Account\TwoFactorController::class, 'setup']);
        Route::post('device-tokens', [Account\DeviceTokenController::class, 'store']);
        Route::delete('device-tokens', [Account\DeviceTokenController::class, 'destroy']);
    });

    /* ------------------------------------------------------------------
     | Student portal
     | ------------------------------------------------------------------ */
    Route::prefix('student')->middleware(['auth', 'account.usable', 'role:student'])->group(function () {
        Route::get('dashboard', Student\DashboardController::class);

        Route::get('courses', [Student\CourseController::class, 'index']);
        Route::get('courses/{enrollmentId}', [Student\CourseController::class, 'show']);
        Route::get('courses/{enrollmentId}/classes', [Student\CourseController::class, 'classes']);
        Route::get('courses/{enrollmentId}/recordings', [Student\CourseController::class, 'recordings']);
        Route::get('courses/{enrollmentId}/resources', [Student\CourseController::class, 'resources']);
        Route::get('courses/{enrollmentId}/syllabus', [Student\CourseController::class, 'syllabus']);
        Route::get('courses/{enrollmentId}/tests', [Student\CourseController::class, 'tests']);

        // Syllabus progress could be read but never written: nothing anywhere
        // created a lesson_completions row, so it sat at 0% permanently.
        Route::post('courses/{enrollmentId}/lessons/{lessonId}/complete', [Student\CourseController::class, 'completeLesson']);

        // Attendance was recorded by teachers and shown to students only as a
        // single percentage, with no way to see which classes were missed.
        Route::get('courses/{enrollmentId}/attendance', [Student\CourseController::class, 'attendance']);
        Route::get('courses/{enrollmentId}/announcements', [Student\CourseController::class, 'announcements']);

        Route::post('classes/{sessionId}/join', [Student\ClassSessionController::class, 'join'])
            ->middleware('throttle:30,1');

        Route::get('recordings', [Student\RecordingController::class, 'index']);
        Route::get('recordings/{recording}', [Student\RecordingController::class, 'show']);
        Route::post('recordings/{recording}/playback', [Student\RecordingController::class, 'playback']);
        Route::patch('recordings/{recording}/progress', [Student\RecordingController::class, 'progress'])
            ->middleware('throttle:30,1');

        Route::get('resources', [Student\ResourceController::class, 'index']);
        Route::post('resources/{resource}/download', [Student\ResourceController::class, 'download']);

        Route::get('tests', [Student\TestController::class, 'index']);
        Route::get('tests/{test}/launch', [Student\TestController::class, 'launch']);
        Route::post('tests/{test}/attempts', [Student\AttemptController::class, 'store'])
            ->middleware(['idempotent', 'throttle:attempts']);
        Route::patch('attempts/{attempt}/responses', [Student\AttemptController::class, 'saveResponses'])
            ->middleware('throttle:attempts');
        Route::post('attempts/{attempt}/submit', [Student\AttemptController::class, 'submit'])
            ->middleware(['idempotent', 'throttle:attempts']);
        Route::get('attempts/{attempt}/result', [Student\AttemptController::class, 'result']);

        Route::get('notifications', [Student\NotificationController::class, 'index']);
        Route::get('announcements', [Student\NotificationController::class, 'announcements']);
        Route::post('announcements/{announcement}/read', [Student\NotificationController::class, 'markRead']);

        // Free courses have no payment step, so activation lives here.
        Route::post('enroll-free', [Student\CourseController::class, 'enrollFree'])
            ->middleware(['idempotent', 'throttle:20,1']);

        Route::get('payments', [Student\PaymentController::class, 'index']);
        Route::get('payment-options', [Student\PaymentController::class, 'options']);
        Route::post('payments', [Student\PaymentController::class, 'store'])
            ->middleware(['idempotent', 'throttle:uploads']);
        Route::post('payments/{payment}/proof', [Student\PaymentController::class, 'proof'])
            ->middleware('idempotent');

        // eSewa checkout: redirect out, verified signature back.
        Route::post('payments/esewa/checkout', [Student\EsewaController::class, 'checkout'])
            ->middleware(['idempotent', 'throttle:20,1']);
        Route::post('payments/esewa/callback', [Student\EsewaController::class, 'callback'])
            ->middleware('throttle:30,1');

        Route::get('receipts', [Student\ReceiptController::class, 'index']);
        Route::get('receipts/{receiptId}', [Student\ReceiptController::class, 'show']);
        Route::post('receipts/{receiptId}/download', [Student\ReceiptController::class, 'download']);

        Route::get('support', [Student\SupportController::class, 'overview']);
        Route::post('support-tickets', [Student\SupportController::class, 'store'])
            ->middleware('throttle:public-forms');
    });

    /* ------------------------------------------------------------------
     | Teacher portal
     | ------------------------------------------------------------------ */
    Route::prefix('teacher')->middleware(['auth', 'account.usable', 'role:teacher'])->group(function () {
        Route::get('dashboard', Teacher\DashboardController::class);
        Route::get('notifications', [Teacher\NotificationController::class, 'index']);

        // Literal segments before wildcards: "new-context" must not be read
        // as a test id, and "export" must not be read as a batch id.
        Route::get('tests/new-context', [Teacher\TestController::class, 'newContext']);

        Route::get('batches', [Teacher\BatchController::class, 'index']);
        Route::get('batches/{batchId}', [Teacher\BatchController::class, 'show']);
        Route::get('batches/{batchId}/students/export', [Teacher\BatchController::class, 'exportStudents'])
            ->middleware('permission:reports.export');
        Route::get('batches/{batchId}/recordings', [Teacher\RecordingController::class, 'index']);
        Route::post('batches/{batchId}/recordings', [Teacher\RecordingController::class, 'store'])
            ->middleware(['permission:recordings.manage', 'idempotent']);
        Route::patch('batches/{batchId}/recordings/{recording}', [Teacher\RecordingController::class, 'update'])
            ->middleware(['permission:recordings.manage', 'idempotent']);
        Route::delete('batches/{batchId}/recordings/{recording}', [Teacher\RecordingController::class, 'destroy'])
            ->middleware('permission:recordings.manage');
        Route::post('batches/{batchId}/recordings/{recording}/resync', [Teacher\RecordingController::class, 'resync'])
            ->middleware(['permission:recordings.manage', 'idempotent']);
        Route::get('batches/{batchId}/tests', [Teacher\TestController::class, 'forBatch']);
        Route::get('batches/{batchId}/syllabus-modules', [Teacher\SyllabusModuleController::class, 'index']);

        // Notes and PDFs. Students could always download; nothing could upload.
        Route::get('batches/{batchId}/resources', [Teacher\ResourceController::class, 'index'])
            ->middleware('permission:resources.view');
        Route::post('batches/{batchId}/resources', [Teacher\ResourceController::class, 'store'])
            ->middleware(['permission:resources.manage', 'idempotent', 'throttle:uploads']);
        Route::patch('batches/{batchId}/resources/{resource}', [Teacher\ResourceController::class, 'update'])
            ->middleware(['permission:resources.manage', 'idempotent']);
        Route::delete('batches/{batchId}/resources/{resource}', [Teacher\ResourceController::class, 'destroy'])
            ->middleware('permission:resources.manage');

        Route::get('classes', [Teacher\ClassSessionController::class, 'index']);
        Route::post('classes', [Teacher\ClassSessionController::class, 'store'])
            ->middleware(['permission:sessions.manage', 'idempotent']);
        // Registered before the {sessionId} routes so "recurring" is not
        // captured as a session id.
        Route::post('classes/recurring', [Teacher\ClassSessionController::class, 'storeRecurring'])
            ->middleware(['permission:sessions.manage', 'idempotent']);

        Route::get('classes/{sessionId}', [Teacher\ClassSessionController::class, 'show']);
        Route::post('classes/{sessionId}/cancel', [Teacher\ClassSessionController::class, 'cancel'])
            ->middleware(['permission:sessions.manage', 'idempotent']);
        Route::patch('classes/{sessionId}', [Teacher\ClassSessionController::class, 'update'])
            ->middleware(['permission:sessions.manage', 'idempotent']);
        Route::post('classes/{sessionId}/start', [Teacher\ClassSessionController::class, 'start'])
            ->middleware(['permission:sessions.start', 'idempotent']);
        Route::post('classes/{sessionId}/sync', [Teacher\ClassSessionController::class, 'sync'])
            ->middleware(['permission:sessions.manage', 'throttle:20,1']);
        Route::post('classes/{sessionId}/fallback', [Teacher\ClassSessionController::class, 'fallback'])
            ->middleware(['permission:sessions.manage', 'idempotent']);

        Route::get('attendance', [Teacher\AttendanceController::class, 'index']);
        Route::get('classes/{sessionId}/attendance', [Teacher\AttendanceController::class, 'show']);
        // save()/import() are actually gated by ClassSessionPolicy::manage(),
        // which checks sessions.manage — not attendance.view ("View
        // attendance"), which is what these previously named here. Every
        // role that has one today has the other, so this changed nothing
        // observable; it only matters for a future custom role that holds
        // just one of the two, which the old label would have blocked (or
        // let through) inconsistently with what the policy actually decides.
        Route::put('classes/{sessionId}/attendance', [Teacher\AttendanceController::class, 'save'])
            ->middleware(['permission:sessions.manage', 'idempotent']);
        Route::post('classes/{sessionId}/attendance/finalize', [Teacher\AttendanceController::class, 'finalize'])
            ->middleware(['permission:attendance.finalize', 'idempotent']);
        Route::post('classes/{sessionId}/attendance/import', [Teacher\AttendanceController::class, 'import'])
            ->middleware(['permission:sessions.manage', 'idempotent', 'throttle:10,1']);
        Route::post('classes/{sessionId}/attendance/reopen', [Teacher\AttendanceController::class, 'reopen'])
            ->middleware(['permission:attendance.reopen', 'idempotent']);

        Route::get('tests', [Teacher\TestController::class, 'index']);
        Route::post('tests', [Teacher\TestController::class, 'store'])
            ->middleware(['permission:tests.manage', 'idempotent']);
        Route::get('tests/{test}/builder', [Teacher\TestController::class, 'builder'])
            ->middleware('permission:tests.manage');
        Route::get('tests/{test}/results', [Teacher\TestController::class, 'results'])
            ->middleware('permission:tests.manage');
        Route::patch('tests/{test}', [Teacher\TestController::class, 'update'])
            ->middleware(['permission:tests.manage', 'idempotent']);
        Route::post('tests/{test}/publish', [Teacher\TestController::class, 'publish'])
            ->middleware(['permission:tests.manage', 'idempotent']);
        Route::post('tests/{test}/release-results', [Teacher\TestController::class, 'releaseResults'])
            ->middleware(['permission:tests.manage', 'idempotent']);

        Route::get('announcements', [Teacher\AnnouncementController::class, 'index']);
        Route::post('announcements', [Teacher\AnnouncementController::class, 'store'])
            ->middleware(['permission:announcements.manage', 'idempotent']);

        Route::get('content-summary', Teacher\ContentSummaryController::class);
    });

    /* ------------------------------------------------------------------
     | Enrollment officer (staff) portal
     | ------------------------------------------------------------------ */
    Route::prefix('staff')->middleware(['auth', 'account.usable', 'role:staff'])->group(function () {
        Route::get('notifications', [Staff\NotificationController::class, 'index']);

        // Literal segments first so "export" is never read as a record id.
        Route::get('students/export', [Staff\StudentController::class, 'export'])->middleware('permission:reports.export');
        Route::get('enrollments/export', [Staff\EnrollmentController::class, 'export'])->middleware('permission:reports.export');

        Route::get('students', [Staff\StudentController::class, 'index'])->middleware('permission:students.view');
        Route::get('students/{student}', [Staff\StudentController::class, 'show'])->middleware('permission:students.view');
        Route::post('students', [Staff\StudentController::class, 'store'])->middleware(['permission:students.manage', 'idempotent']);
        Route::post('students/{student}/support-actions', [Staff\StudentController::class, 'supportAction'])
            ->middleware(['permission:students.manage', 'idempotent']);

        Route::get('enrollments', [Staff\EnrollmentController::class, 'index'])->middleware('permission:enrollments.view');

        Route::get('courses', [Staff\CourseController::class, 'index'])->middleware('permission:courses.view');
        Route::get('courses/{course}', [Staff\CourseController::class, 'show'])->middleware('permission:courses.view');
        Route::post('courses', [Staff\CourseController::class, 'store'])->middleware(['permission:courses.create', 'idempotent']);
        Route::patch('courses/{course}', [Staff\CourseController::class, 'update'])->middleware(['permission:courses.update', 'idempotent']);
        Route::post('courses/{course}/thumbnail', [Staff\CourseController::class, 'uploadThumbnail'])
            ->middleware(['permission:courses.update', 'idempotent', 'throttle:uploads']);
        Route::delete('courses/{course}/thumbnail', [Staff\CourseController::class, 'deleteThumbnail'])
            ->middleware('permission:courses.update');

        // Same controllers as the admin routes below — categories.manage and
        // syllabus.manage have no admin-specific logic in either one, they are
        // permission-gated the same way everything else here is. Staff already
        // creates and publishes courses; without these, a course needing a new
        // category or its syllabus content had to wait on an admin for either.
        Route::get('categories', [Admin\CategoryController::class, 'index'])->middleware('permission:courses.view');
        Route::post('categories', [Admin\CategoryController::class, 'store'])
            ->middleware(['permission:categories.manage', 'idempotent']);
        Route::patch('categories/{category}', [Admin\CategoryController::class, 'update'])
            ->middleware(['permission:categories.manage', 'idempotent']);
        Route::delete('categories/{category}', [Admin\CategoryController::class, 'destroy'])
            ->middleware('permission:categories.manage');

        Route::get('courses/{course}/syllabus', [Admin\SyllabusController::class, 'show'])
            ->middleware('permission:courses.view');
        Route::put('courses/{course}/syllabus', [Admin\SyllabusController::class, 'update'])
            ->middleware(['permission:syllabus.manage', 'idempotent']);

        Route::get('payment-submissions', [Staff\PaymentSubmissionController::class, 'index'])->middleware('permission:payments.view');
        Route::get('payment-submissions/{payment}', [Staff\PaymentSubmissionController::class, 'show'])->middleware('permission:payments.view');
        Route::post('payment-submissions', [Staff\PaymentSubmissionController::class, 'store'])
            ->middleware(['permission:payments.submit', 'idempotent', 'throttle:uploads']);
        Route::post('payment-submissions/{payment}/proof', [Staff\PaymentSubmissionController::class, 'proof'])
            ->middleware('permission:payments.view');
        Route::post('payment-submissions/{payment}/notify', [Staff\PaymentSubmissionController::class, 'notify'])
            ->middleware(['permission:payments.view', 'idempotent']);
    });

    /* ------------------------------------------------------------------
     | Accounting portal
     | ------------------------------------------------------------------ */
    Route::prefix('accounting')->middleware(['auth', 'account.usable', 'role:staff'])->group(function () {
        Route::get('payments/export', [Accounting\PaymentController::class, 'export'])->middleware('permission:reports.export');
        Route::get('receipts/export', [Accounting\LedgerController::class, 'exportReceipts'])->middleware('permission:reports.export');

        // Institution-wide collections and outstanding figures, not the
        // day-to-day payment queue — kept behind their own admin-only
        // permission rather than the general reports.export staff already
        // has for their own operational exports (students, enrollments).
        Route::get('reports/collections/export', [Accounting\ReportController::class, 'exportCollections'])->middleware('permission:reports.financial');
        Route::get('reports/outstanding/export', [Accounting\ReportController::class, 'exportOutstanding'])->middleware('permission:reports.financial');

        Route::get('dashboard', Accounting\DashboardController::class)->middleware('permission:payments.view');

        Route::get('payments', [Accounting\PaymentController::class, 'index'])->middleware('permission:payments.view');
        Route::get('payments/{payment}', [Accounting\PaymentController::class, 'show'])->middleware('permission:payments.view');
        Route::post('payments/{payment}/proof', [Accounting\PaymentController::class, 'proof'])->middleware('permission:payments.view');

        // The one endpoint that turns money into access.
        Route::post('payments/{payment}/decision', [Accounting\PaymentController::class, 'decide'])
            ->middleware(['permission:payments.review', 'idempotent']);

        Route::get('receipts', [Accounting\LedgerController::class, 'receipts'])->middleware('permission:receipts.view');

        Route::get('adjustments', [Accounting\LedgerController::class, 'adjustments'])->middleware('permission:payments.view');
        Route::post('adjustments', [Accounting\LedgerController::class, 'storeAdjustment'])
            ->middleware(['permission:payments.adjust', 'idempotent']);

        Route::get('refunds', [Accounting\LedgerController::class, 'refunds'])->middleware('permission:payments.view');
        Route::post('refunds', [Accounting\LedgerController::class, 'storeRefund'])
            ->middleware(['permission:payments.refund', 'idempotent']);

        // Without this a refund stays at "requested" forever and never reaches
        // the collections report, which counts only processed refunds.
        Route::post('refunds/{refund}/complete', [Accounting\LedgerController::class, 'completeRefund'])
            ->middleware(['permission:payments.refund', 'idempotent']);

        Route::get('reports/collections', [Accounting\ReportController::class, 'collections'])->middleware('permission:reports.financial');
        Route::get('reports/outstanding', [Accounting\ReportController::class, 'outstanding'])->middleware('permission:reports.financial');
    });

    /* ------------------------------------------------------------------
     | Administration
     | ------------------------------------------------------------------ */
    /*
     * Support inbox.
     *
     * Its own group rather than inside admin: the enrolment office answers
     * most tickets, and administrators reach it through the same permission
     * because Gate::before lets them past every role gate anyway.
     */
    Route::prefix('support')->middleware(['auth', 'account.usable'])->group(function () {
        Route::get('assignees', [Support\TicketController::class, 'assignees'])->middleware('permission:support.manage');
        Route::get('tickets', [Support\TicketController::class, 'index'])->middleware('permission:support.view');
        Route::get('tickets/{ticket}', [Support\TicketController::class, 'show']);
        Route::post('tickets/{ticket}/messages', [Support\TicketController::class, 'reply'])->middleware('idempotent');
        Route::patch('tickets/{ticket}', [Support\TicketController::class, 'update'])
            ->middleware(['permission:support.manage', 'idempotent']);
    });

    Route::prefix('admin')->middleware(['auth', 'account.usable', 'role:admin'])->group(function () {
        Route::get('notifications', [Admin\NotificationController::class, 'index'])->middleware('permission:reports.view');

        /*
         * Registered first on purpose: "/users/export" must be matched before
         * "/users/{user}", or the literal segment is captured as an id.
         */
        Route::middleware('permission:reports.export')->group(function () {
            Route::get('users/export', [Admin\ExportController::class, 'users']);
            Route::get('courses/export', [Admin\ExportController::class, 'courses']);
            Route::get('batches/export', [Admin\ExportController::class, 'batches']);
            Route::get('announcements/export', [Admin\ExportController::class, 'announcements']);
            Route::get('audit-logs/export', [Admin\ExportController::class, 'auditLogs']);
            Route::get('reports/{report}/export', [Admin\ExportController::class, 'report']);
        });

        Route::get('settings', [Admin\SettingsController::class, 'show'])->middleware('permission:settings.manage');
        Route::patch('settings', [Admin\SettingsController::class, 'update'])
            ->middleware(['permission:settings.manage', 'idempotent']);

        Route::post('payment-methods/{paymentMethod}/qr', [Admin\SettingsController::class, 'uploadPaymentMethodQr'])
            ->middleware('permission:settings.manage');
        Route::delete('payment-methods/{paymentMethod}/qr', [Admin\SettingsController::class, 'deletePaymentMethodQr'])
            ->middleware('permission:settings.manage');

        Route::post('settings/institution/logo', [Admin\SettingsController::class, 'uploadInstitutionLogo'])
            ->middleware(['permission:settings.manage', 'idempotent', 'throttle:uploads']);
        Route::delete('settings/institution/logo', [Admin\SettingsController::class, 'deleteInstitutionLogo'])
            ->middleware(['permission:settings.manage', 'idempotent']);
        Route::post('settings/institution/favicon', [Admin\SettingsController::class, 'uploadInstitutionFavicon'])
            ->middleware(['permission:settings.manage', 'idempotent', 'throttle:uploads']);
        Route::delete('settings/institution/favicon', [Admin\SettingsController::class, 'deleteInstitutionFavicon'])
            ->middleware(['permission:settings.manage', 'idempotent']);

        Route::get('roles', [Admin\RoleController::class, 'index'])->middleware('permission:roles.manage');
        Route::get('permissions', [Admin\RoleController::class, 'permissions'])->middleware('permission:roles.manage');
        Route::post('roles', [Admin\RoleController::class, 'store'])->middleware(['permission:roles.manage', 'idempotent']);
        Route::patch('roles/{role}', [Admin\RoleController::class, 'update'])->middleware(['permission:roles.manage', 'idempotent']);
        Route::delete('roles/{role}', [Admin\RoleController::class, 'destroy'])->middleware('permission:roles.manage');

        /*
         * Categories: the course form requires one, and there was no write path
         * anywhere, so a fresh install could never create a course.
         */
        Route::get('categories', [Admin\CategoryController::class, 'index'])->middleware('permission:courses.view');
        Route::post('categories', [Admin\CategoryController::class, 'store'])
            ->middleware(['permission:categories.manage', 'idempotent']);
        Route::patch('categories/{category}', [Admin\CategoryController::class, 'update'])
            ->middleware(['permission:categories.manage', 'idempotent']);
        Route::delete('categories/{category}', [Admin\CategoryController::class, 'destroy'])
            ->middleware('permission:categories.manage');

        /*
         * FAQs: readable on the public site and student support page, but the
         * only way one ever existed was a one-time demo seeder — no write
         * path anywhere.
         */
        Route::get('faqs', [Admin\FaqController::class, 'index'])->middleware('permission:faqs.manage');
        Route::post('faqs', [Admin\FaqController::class, 'store'])
            ->middleware(['permission:faqs.manage', 'idempotent']);
        Route::patch('faqs/{faq}', [Admin\FaqController::class, 'update'])
            ->middleware(['permission:faqs.manage', 'idempotent']);
        Route::delete('faqs/{faq}', [Admin\FaqController::class, 'destroy'])
            ->middleware('permission:faqs.manage');

        // Syllabus: modules and lessons had no write path at all.
        Route::get('courses/{course}/syllabus', [Admin\SyllabusController::class, 'show'])
            ->middleware('permission:courses.view');
        Route::put('courses/{course}/syllabus', [Admin\SyllabusController::class, 'update'])
            ->middleware(['permission:syllabus.manage', 'idempotent']);

        Route::get('users', [Admin\UserController::class, 'index'])->middleware('permission:users.view');

        // Without this the institution cannot be staffed: students arrive via
        // the enrollment office, but teachers and accountants had no path.
        Route::post('users', [Admin\UserController::class, 'store'])
            ->middleware(['permission:users.manage', 'idempotent']);
        Route::get('users/{user}', [Admin\UserController::class, 'show'])->middleware('permission:users.view');
        Route::patch('users/{user}', [Admin\UserController::class, 'update'])->middleware(['permission:users.manage', 'idempotent']);
        Route::delete('users/{user}', [Admin\UserController::class, 'destroy'])
            ->middleware('permission:users.delete');

        Route::post('users/{user}/actions/{action}', [Admin\UserController::class, 'action'])
            ->middleware(['permission:users.security', 'idempotent']);

        // Device bindings, so the office can reset a student who changed phone.
        Route::get('users/{user}/devices', [Admin\UserController::class, 'devices'])
            ->middleware('permission:users.view');
        Route::post('users/{user}/devices/reset', [Admin\UserController::class, 'resetDevices'])
            ->middleware(['permission:users.security', 'idempotent']);

        Route::get('audit-logs', [Admin\AuditLogController::class, 'index'])->middleware('permission:audit.view');

        // Landing page: aggregate counts, attention signals, service health.
        Route::get('dashboard', Admin\DashboardController::class)->middleware('permission:reports.view');

        Route::get('courses', [Admin\CourseController::class, 'index'])->middleware('permission:courses.view');
        Route::get('courses/{course}', [Admin\CourseController::class, 'show'])->middleware('permission:courses.view');
        Route::post('courses', [Admin\CourseController::class, 'store'])->middleware(['permission:courses.create', 'idempotent']);
        Route::patch('courses/{course}', [Admin\CourseController::class, 'update'])->middleware(['permission:courses.update', 'idempotent']);
        Route::post('courses/{course}/thumbnail', [Admin\CourseController::class, 'uploadThumbnail'])
            ->middleware(['permission:courses.update', 'idempotent', 'throttle:uploads']);
        Route::delete('courses/{course}/thumbnail', [Admin\CourseController::class, 'deleteThumbnail'])
            ->middleware('permission:courses.update');
        Route::delete('courses/{course}', [Admin\CourseController::class, 'destroy'])->middleware('permission:courses.delete');
        Route::post('courses/{course}/restore', [Admin\CourseController::class, 'restore'])->middleware('permission:courses.delete');
        Route::delete('courses/{course}/permanent', [Admin\CourseController::class, 'forceDestroy'])->middleware('permission:courses.delete');

        Route::get('batches', [Admin\BatchController::class, 'index'])->middleware('permission:batches.view');
        Route::get('batches/{batch}', [Admin\BatchController::class, 'show'])->middleware('permission:batches.view');
        Route::post('batches', [Admin\BatchController::class, 'store'])->middleware(['permission:batches.manage', 'idempotent']);
        Route::patch('batches/{batch}', [Admin\BatchController::class, 'update'])->middleware(['permission:batches.manage', 'idempotent']);
        Route::delete('batches/{batch}', [Admin\BatchController::class, 'destroy'])->middleware('permission:batches.delete');
        Route::post('batches/{batch}/restore', [Admin\BatchController::class, 'restore'])->middleware('permission:batches.delete');
        Route::delete('batches/{batch}/permanent', [Admin\BatchController::class, 'forceDestroy'])->middleware('permission:batches.delete');

        Route::get('teachers', [Admin\TeacherController::class, 'index'])->middleware('permission:users.view');
        Route::put('teachers/{user}/profile', [Admin\TeacherController::class, 'upsert'])->middleware(['permission:users.manage', 'idempotent']);

        Route::get('announcements', [Admin\AnnouncementController::class, 'index'])->middleware('permission:announcements.view');
        Route::post('announcements', [Admin\AnnouncementController::class, 'store'])->middleware(['permission:announcements.manage', 'idempotent']);
        Route::patch('announcements/{announcement}', [Admin\AnnouncementController::class, 'update'])->middleware(['permission:announcements.manage', 'idempotent']);

        Route::get('finance-overview', Admin\FinanceOverviewController::class)->middleware('permission:payments.view');

        Route::middleware('permission:reports.view')->group(function () {
            Route::get('reports/academic', [Admin\ReportController::class, 'academic']);
            Route::get('reports/enrollments', [Admin\ReportController::class, 'enrollments']);
            Route::get('reports/finance', [Admin\ReportController::class, 'finance']);
        });

        Route::middleware('permission:integrations.manage')->group(function () {
            Route::get('integrations/{provider}/status', [Admin\IntegrationController::class, 'status']);
            Route::get('integrations/{provider}/records', [Admin\IntegrationController::class, 'records']);
            Route::get('integrations/{provider}/events', [Admin\IntegrationController::class, 'events']);
            Route::post('integrations/{provider}/{action}', [Admin\IntegrationController::class, 'action'])
                ->middleware('idempotent');
        });
    });
});
