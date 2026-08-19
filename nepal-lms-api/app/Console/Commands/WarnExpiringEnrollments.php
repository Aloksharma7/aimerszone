<?php

namespace App\Console\Commands;

use App\Enums\EnrollmentStatus;
use App\Models\Enrollment;
use App\Services\NotificationDispatcher;
use App\Services\SettingsRepository;
use Illuminate\Console\Command;

/**
 * Tells students their access is about to end, before it does.
 *
 * ExpireEnrollments flipped seats to "expired" silently at 00:30, so the first
 * a student knew of it was a course that had stopped opening. For a paid
 * course that is indistinguishable from the platform having taken their money
 * and removed the content.
 *
 * Sends once per configured threshold, tracked on the enrolment so a daily run
 * does not repeat the same warning.
 */
class WarnExpiringEnrollments extends Command
{
    protected $signature = 'lms:warn-expiring-enrollments';

    protected $description = 'Notify students whose course access ends soon.';

    public function handle(NotificationDispatcher $notifications, SettingsRepository $settings): int
    {
        $days = (int) $settings->int('operations.access_warning_days', 7);

        if ($days < 1) {
            $this->info('Access warnings are switched off.');

            return self::SUCCESS;
        }

        $sent = 0;

        Enrollment::query()
            ->where('status', EnrollmentStatus::Active->value)
            ->whereNotNull('access_end_at')
            ->whereBetween('access_end_at', [now(), now()->addDays($days)])

            // One warning per enrolment. Without this the daily schedule would
            // send the same message every day of the final week.
            ->whereNull('expiry_warned_at')
            ->with(['user', 'course'])
            ->chunkById(200, function ($enrollments) use (&$sent, $notifications) {
                foreach ($enrollments as $enrollment) {
                    $notifications->accessEndingSoon($enrollment);
                    $enrollment->forceFill(['expiry_warned_at' => now()])->save();
                    $sent++;
                }
            });

        $this->info("Warned {$sent} student(s) about ending access.");

        return self::SUCCESS;
    }
}
