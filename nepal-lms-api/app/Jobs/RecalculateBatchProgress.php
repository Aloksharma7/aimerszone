<?php

namespace App\Jobs;

use App\Models\Enrollment;
use App\Services\EnrollmentProgressService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Recalculates progress for every active seat in a batch.
 *
 * Finalizing attendance used to do this inline. Each student costs several
 * aggregate queries, so a 400-student batch meant well over a thousand queries
 * in a single request and a teacher watching a spinner. It is the same work,
 * moved off the request.
 */
class RecalculateBatchProgress implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 300;

    public function __construct(public string $batchId) {}

    /** One job per batch in flight is enough. */
    public function uniqueId(): string
    {
        return $this->batchId;
    }

    public function handle(EnrollmentProgressService $progress): void
    {
        Enrollment::query()
            ->where('batch_id', $this->batchId)
            ->accessible()
            ->chunkById(100, function ($enrollments) use ($progress) {
                foreach ($enrollments as $enrollment) {
                    $progress->recalculate($enrollment);
                }
            });
    }
}
