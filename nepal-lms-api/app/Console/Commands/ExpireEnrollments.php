<?php

namespace App\Console\Commands;

use App\Enums\EnrollmentStatus;
use App\Models\Enrollment;
use App\Services\AuditLogger;
use Illuminate\Console\Command;

/**
 * Moves seats past their access window to "expired".
 *
 * Access is already denied in real time by Enrollment::scopeAccessible() —
 * every real content-serving path goes through that, not grantsAccess()
 * (which only one self-enrollment guard calls) — this only keeps the stored
 * status honest for reporting and dashboards.
 */
class ExpireEnrollments extends Command
{
    protected $signature = 'lms:expire-enrollments';

    protected $description = 'Mark active enrollments whose access window has closed as expired.';

    public function handle(AuditLogger $audit): int
    {
        $expired = 0;

        Enrollment::query()
            ->where('status', EnrollmentStatus::Active->value)
            ->whereNotNull('access_end_at')
            ->where('access_end_at', '<', now())
            ->chunkById(200, function ($enrollments) use (&$expired, $audit) {
                foreach ($enrollments as $enrollment) {
                    $enrollment->forceFill(['status' => EnrollmentStatus::Expired->value])->save();
                    $audit->log('enrollment.expired', $enrollment, null, 'Access window closed');
                    $expired++;
                }
            });

        $this->info("Expired {$expired} enrollment(s).");

        return self::SUCCESS;
    }
}
