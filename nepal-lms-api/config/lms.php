<?php

/*
 * Deployment-level values only.
 *
 * Anything an administrator is expected to change at runtime lives in the
 * `settings` table and is read through App\Services\SettingsRepository.
 * The defaults below seed that table on first install and act as a fallback
 * if a setting row is ever missing.
 */
return [
    'api_version' => 'v1',

    'signed_url_ttl' => (int) env('LMS_SIGNED_URL_TTL', 300),

    'uploads' => [
        'proof_max_kb' => (int) env('LMS_PROOF_MAX_KB', 5120),
        'proof_mimes' => array_filter(explode(',', (string) env('LMS_PROOF_MIMES', 'jpg,jpeg,png,webp,pdf'))),
        'resource_max_kb' => (int) env('LMS_RESOURCE_MAX_KB', 51200),
        'resource_mimes' => ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'zip', 'png', 'jpg', 'jpeg'],
        'image_max_kb' => (int) env('LMS_IMAGE_MAX_KB', 2048),
        'favicon_max_kb' => (int) env('LMS_FAVICON_MAX_KB', 512),
    ],

    'pagination' => [
        'per_page' => 25,
        'max_per_page' => 100,
    ],

    'idempotency' => [
        'ttl_hours' => 24,

        /*
         * How long an in-flight request holds its lock before a retry may
         * reclaim it. Long enough to cover a slow upload, short enough that a
         * crashed worker does not block the user for the whole TTL.
         */
        'lock_seconds' => 90,
    ],

    /*
     * Seeded defaults for the administrator settings screen.
     * Keys map 1:1 to the payload of GET/PATCH /api/v1/admin/settings.
     */
    'settings' => [
        'institution' => [
            'name' => 'Institution LMS',
            'short_name' => 'IL',
            'primary_phone' => '+977 9800000000',
            'support_email' => 'support@example.com',
            'whatsapp' => '9779800000000',
            'website' => 'https://lms.example.com',
            'address' => 'Kathmandu, Nepal',
            'logo_path' => null,
            'favicon_path' => null,
            'tagline' => 'Live classes, recordings, tests and support in one clear place.',
            'map_url' => 'https://www.google.com/maps/search/?api=1&query=Kathmandu%2C%20Nepal',
            'support_hours' => 'Sunday to Friday, 9:00 AM-6:00 PM (Nepal time).',
        ],

        'security' => [
            'public_registration' => true,
            'email_verification' => false,
            'privileged_mfa' => true,
            'force_password_change' => true,
            'session_timeout_hours' => 8,
            'failed_login_attempts' => 5,
            'lockout_minutes' => 15,
            'password_min_length' => 8,
        ],

        'operations' => [
            'maintenance_notice' => false,
            'maintenance_message' => 'The portal is temporarily unavailable for scheduled maintenance.',
            'automatic_receipts' => true,
            'daily_integration_health_check' => true,
            'join_window_minutes_before' => 15,
            'join_window_minutes_after' => 20,
            'access_warning_days' => 7,
            'receipt_prefix' => 'RCP',
            'student_code_prefix' => 'STU',
            'default_access_days' => 180,
            'attendance_late_minutes' => 10,
        ],

        'assessment' => [
            'default_attempts_allowed' => 1,
            'default_duration_minutes' => 45,
            'default_pass_percent' => 40,
            'autosave_seconds' => 20,
            'allow_late_submission_grace_seconds' => 60,
        ],

        'integrations' => [
            'zoom_enabled' => false,
            'youtube_enabled' => false,
            'zoom_default_duration_minutes' => 90,
            'zoom_auto_recording' => 'cloud',
            'youtube_default_privacy' => 'unlisted',
        ],

        /*
         * Feature switches shown on the administrator control panel.
         *
         * Each one is off until its credentials are present, so enabling a
         * feature that cannot work is impossible rather than merely discouraged.
         */
        'features' => [
            // One active session per student. The strongest anti-sharing
            // control available without a mobile app.
            'single_device_login' => false,

            // Overlay the student's name and mobile on video playback so a
            // leaked recording is traceable back to the account.
            'dynamic_watermark' => true,

            'sms_notifications' => false,
            'esewa_checkout' => false,

            // Convenience toggles for surfaces the institution may not want.
            'student_support_tickets' => true,
            'public_free_courses' => true,
        ],

        /*
         * SMS provider credentials, pasted by the administrator.
         * Secrets are stored encrypted and never returned by a read.
         */
        'sms' => [
            'provider' => 'sparrow',
            'endpoint' => 'https://api.sparrowsms.com/v2/sms/',
            'token' => null,
            'sender_id' => 'Demo',
            'notify_class_starting' => true,
            'notify_payment_decision' => true,
            'notify_enrollment_activated' => true,
            'notify_support_reply' => true,
            'notify_access_expiring' => true,
        ],

        /*
         * eSewa ePay v2. The demo values below are eSewa's public sandbox
         * credentials, so a fresh install can be exercised end to end before
         * the institution has a merchant account.
         */
        'esewa' => [
            'environment' => 'sandbox',
            'merchant_code' => 'EPAYTEST',
            'secret_key' => null,
            'success_path' => '/student/payments/esewa/success',
            'failure_path' => '/student/payments/esewa/failure',
        ],

        'content' => [
            // Watermark opacity as a percentage; low enough to watch through,
            // high enough to survive a screen recording.
            'watermark_opacity' => 18,
            'watermark_interval_seconds' => 12,
        ],
    ],

    /*
     * Permission catalogue. Seeded into the `permissions` table so that
     * administrators can compose roles from the /admin/roles screen.
     * Strings must match the frontend requirePermission() calls.
     */
    'permissions' => [
        'catalogue' => [
            'courses.view' => 'View courses and course details',
            'courses.create' => 'Create courses',
            'courses.update' => 'Edit courses',
            'courses.publish' => 'Publish or unpublish courses',
            'courses.delete' => 'Archive courses',
            'categories.manage' => 'Manage course categories',
            'faqs.manage' => 'Manage public FAQ entries',
            'batches.view' => 'View batches',
            'batches.manage' => 'Create and edit batches',
            'batches.delete' => 'Archive batches',
            'students.view' => 'View student records',
            'students.manage' => 'Create and edit student records',
            'enrollments.view' => 'View enrollments',
            'enrollments.manage' => 'Create, transfer and cancel enrollments',
            'payments.view' => 'View payment submissions',
            'payments.submit' => 'Submit payment evidence on behalf of a student',
            'payments.review' => 'Approve or reject payments',
            'payments.adjust' => 'Create audited ledger adjustments',
            'payments.refund' => 'Record refunds',
            'receipts.view' => 'View and export receipts',
            'sessions.view' => 'View class sessions',
            'sessions.manage' => 'Create, reschedule and start class sessions',
            'sessions.start' => 'Start a scheduled class and obtain the host link',
            'attendance.view' => 'View attendance',
            'attendance.finalize' => 'Finalize attendance registers',
            'recordings.view' => 'View recordings',
            'recordings.manage' => 'Publish and edit recordings',
            'resources.view' => 'View resources',
            'resources.manage' => 'Upload and release resources',
            'tests.view' => 'View assessments',
            'tests.manage' => 'Build, publish and score assessments',
            'announcements.view' => 'View announcements',
            'announcements.manage' => 'Publish announcements',
            'support.view' => 'View support tickets',
            'support.manage' => 'Respond to and resolve support tickets',
            'reports.view' => 'View operational reports',
            'reports.export' => 'Export reports',
            'reports.financial' => 'View institution-wide collections and outstanding reports',
            'users.view' => 'View user accounts',
            'users.manage' => 'Create and edit user accounts',
            'users.delete' => 'Archive user accounts',
            'users.security' => 'Suspend, restore, reset MFA and revoke sessions',
            'roles.manage' => 'Create and edit roles and permissions',
            'settings.manage' => 'Change institution settings',
            'integrations.manage' => 'Connect and disconnect integrations',
            'features.manage' => 'Turn platform features on and off',
            'syllabus.manage' => 'Build course syllabus modules and lessons',
            'audit.view' => 'Read the audit log',
        ],

        /*
         * Default role composition. Administrators may edit these afterwards;
         * the seeder only applies them when a role has no permissions yet.
         */
        'roles' => [
            'student' => [
                // Browsing the catalogue from inside the portal.
                'courses.view', 'batches.view',

                // Their own money: the portal shows only their own records,
                // scoping is enforced per query rather than by permission.
                'payments.view', 'receipts.view',

                'recordings.view', 'resources.view', 'tests.view', 'announcements.view',
                'support.view',
            ],
            'teacher' => [
                'courses.view', 'batches.view', 'students.view', 'sessions.view', 'sessions.manage',
                'sessions.start',
                'attendance.view', 'attendance.finalize', 'recordings.view', 'recordings.manage',
                'resources.view', 'resources.manage', 'tests.view', 'tests.manage',
                'announcements.view', 'announcements.manage', 'reports.view',

                // The batch page offers a student-list export; without this the
                // button renders for teachers and always returns 403.
                'reports.export',
            ],
            // Staff merges the former "enrollment officer" and "accountant"
            // roles into one: onboarding/catalogue work and payment review
            // both belong to the same institution office in practice, and a
            // separate accountant login was one more account to provision
            // and one more portal to explain during onboarding.
            'staff' => [
                'courses.view', 'courses.create', 'courses.update', 'courses.publish',
                'categories.manage', 'faqs.manage', 'syllabus.manage',
                'batches.view', 'students.view', 'students.manage', 'enrollments.view', 'enrollments.manage',
                'payments.view', 'payments.submit', 'payments.review', 'payments.adjust', 'payments.refund',
                'receipts.view', 'support.view', 'support.manage',
                'resources.manage',
                'announcements.view', 'reports.view', 'reports.export', 'audit.view',
            ],
            // Admin runs day-to-day operations but cannot change settings,
            // integrations or roles/permissions, and cannot manage Admin or
            // Super Admin accounts (enforced in UserPolicy) — that stays
            // exclusive to Super Admin.
            'admin' => [
                'courses.view', 'courses.create', 'courses.update', 'courses.publish', 'courses.delete',
                'categories.manage', 'faqs.manage',
                'batches.view', 'batches.manage', 'batches.delete',
                'students.view', 'students.manage',
                'enrollments.view', 'enrollments.manage',
                'payments.view', 'payments.submit', 'payments.review', 'payments.adjust', 'payments.refund',
                'receipts.view',
                'sessions.view', 'sessions.manage', 'sessions.start',
                'attendance.view', 'attendance.finalize',
                'recordings.view', 'recordings.manage',
                'resources.view', 'resources.manage',
                'tests.view', 'tests.manage',
                'announcements.view', 'announcements.manage',
                'support.view', 'support.manage',
                'reports.view', 'reports.export', 'reports.financial',
                'users.view', 'users.manage', 'users.delete', 'users.security',
                'syllabus.manage', 'audit.view',
            ],
            // Full wildcard: the only role that also bypasses individual
            // policy checks (see AuthServiceProvider::boot Gate::before).
            'super_admin' => ['*'],
        ],
    ],
];
