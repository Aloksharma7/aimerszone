<?php

namespace App\Console\Commands;

use App\Enums\ClassSessionStatus;
use App\Models\ClassSession;
use App\Services\NotificationDispatcher;
use Illuminate\Console\Command;

/**
 * The 5-minute-before reminder.
 *
 * Runs every minute, so the +5-minute mark is always caught inside a tight
 * window rather than possibly landing between two 15-minute sweeps.
 */
class NotifyUpcomingClasses extends Command
{
    protected $signature = 'lms:notify-upcoming-classes';

    protected $description = 'Remind enrolled students 5 minutes before a scheduled class starts.';

    public function handle(NotificationDispatcher $notifications): int
    {
        $windowStart = now()->addMinutes(4);
        $windowEnd = now()->addMinutes(5);
        $notified = 0;

        ClassSession::query()
            ->where('status', ClassSessionStatus::Scheduled->value)
            ->whereNull('reminder_sent_at')
            ->whereBetween('starts_at', [$windowStart, $windowEnd])
            ->chunkById(100, function ($sessions) use ($notifications, &$notified) {
                foreach ($sessions as $session) {
                    $notifications->classStartingSoon($session);
                    $session->forceFill(['reminder_sent_at' => now()])->save();
                    $notified++;
                }
            });

        $this->info("Reminded students for {$notified} upcoming session(s).");

        return self::SUCCESS;
    }
}
