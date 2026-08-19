<?php

namespace App\Jobs;

use App\Models\ClassSession;
use App\Services\Integrations\ClassMeetingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Creates Zoom meetings for a batch of newly scheduled classes.
 *
 * Scheduling a term produces up to a hundred sessions, and provisioning them
 * inline meant that many Zoom calls inside one HTTP request — comfortably past
 * PHP's execution limit, so the teacher saw a gateway timeout and could not tell
 * whether the classes had been created.
 *
 * The sessions are saved first and provisioned here. A class without a meeting
 * yet is not broken: it shows as pending sync, the scheduled sync command picks
 * it up, and the teacher can publish a manual fallback link at any point.
 *
 * @param array<int, string> $sessionIds
 */
class ProvisionClassMeetings implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public int $timeout = 600;

    public function __construct(public array $sessionIds) {}

    public function handle(ClassMeetingService $meetings): void
    {
        if (! $meetings->enabled()) {
            return;
        }

        ClassSession::query()
            ->whereIn('id', $this->sessionIds)
            ->orderBy('starts_at')
            ->chunkById(20, function ($sessions) use ($meetings) {
                foreach ($sessions as $session) {
                    // provision() swallows provider failures and marks the
                    // session for manual fallback, so one bad meeting never
                    // stops the rest of the term being created.
                    $meetings->provision($session);
                }
            });
    }
}
