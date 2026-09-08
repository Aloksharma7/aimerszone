<?php

namespace App\Console\Commands;

use App\Models\TestAttempt;
use App\Services\AttemptGrader;
use App\Services\EnrollmentProgressService;
use Illuminate\Console\Command;

/**
 * Closes attempts whose server-side deadline has passed.
 *
 * A student who loses connectivity mid-test still gets whatever they had
 * autosaved graded, and the attempt cannot sit open indefinitely.
 */
class FinalizeExpiredAttempts extends Command
{
    protected $signature = 'lms:finalize-attempts';

    protected $description = 'Auto-submit and grade test attempts that passed their expiry time.';

    public function handle(AttemptGrader $grader, EnrollmentProgressService $progress): int
    {
        $count = 0;

        TestAttempt::query()
            ->inProgress()
            ->where('expires_at', '<', now())
            ->with(['test', 'enrollment'])
            ->chunkById(100, function ($attempts) use ($grader, $progress, &$count) {
                foreach ($attempts as $attempt) {
                    $grader->submit($attempt, autoSubmitted: true);

                    // The explicit "click Submit" path already does this;
                    // running out of time without submitting — arguably the
                    // most common way a timed test ends — otherwise left the
                    // student's dashboard test/overall percentage frozen at
                    // its pre-test value until some unrelated action touched
                    // the same enrollment.
                    if ($attempt->enrollment !== null) {
                        $progress->recalculate($attempt->enrollment);
                    }

                    $count++;
                }
            });

        $this->info("Finalized {$count} expired attempt(s).");

        return self::SUCCESS;
    }
}
