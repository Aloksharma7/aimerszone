<?php

namespace App\Console\Commands;

use App\Enums\ClassSessionStatus;
use App\Models\ClassSession;
use App\Services\SettingsRepository;
use Illuminate\Console\Command;

/**
 * Moves a class out of "Live" once its join window has genuinely closed.
 *
 * Starting a class only ever moves status forward to Live. The only other
 * thing that ever moves it to Completed is the teacher manually finalizing
 * attendance, which can happen hours later or never. Until then the student
 * portal has no way to tell "in progress" from "long over" and keeps
 * showing a pulsing "Live now" badge for a class that already ended.
 */
class ExpireLiveClasses extends Command
{
    protected $signature = 'lms:expire-live-classes';

    protected $description = 'Mark Live class sessions as Completed once their join window has closed.';

    public function handle(SettingsRepository $settings): int
    {
        $after = $settings->int('operations.join_window_minutes_after', 20);
        $cutoff = now()->subMinutes($after);
        $count = 0;

        ClassSession::query()
            ->where('status', ClassSessionStatus::Live->value)
            ->where('ends_at', '<', $cutoff)
            ->chunkById(100, function ($sessions) use (&$count) {
                foreach ($sessions as $session) {
                    $session->forceFill([
                        'status' => ClassSessionStatus::Completed->value,
                        'actual_ended_at' => $session->actual_ended_at ?? now(),
                    ])->save();

                    $count++;
                }
            });

        $this->info("Expired {$count} stale live class(es).");

        return self::SUCCESS;
    }
}
