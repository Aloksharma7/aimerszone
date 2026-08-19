<?php

namespace App\Console\Commands;

use App\Models\TestAttempt;
use App\Services\AttemptGrader;
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

    public function handle(AttemptGrader $grader): int
    {
        $count = 0;

        TestAttempt::query()
            ->inProgress()
            ->where('expires_at', '<', now())
            ->with('test')
            ->chunkById(100, function ($attempts) use ($grader, &$count) {
                foreach ($attempts as $attempt) {
                    $grader->submit($attempt, autoSubmitted: true);
                    $count++;
                }
            });

        $this->info("Finalized {$count} expired attempt(s).");

        return self::SUCCESS;
    }
}
