<?php

namespace App\Console\Commands;

use App\Enums\ClassSessionStatus;
use App\Models\ClassSession;
use App\Services\Integrations\ClassMeetingService;
use Illuminate\Console\Command;

/**
 * Keeps upcoming sessions aligned with Zoom.
 *
 * Runs shortly ahead of class time so a meeting that failed to provision at
 * creation gets another chance well before students try to join, rather than
 * failing silently until someone reports it.
 */
class SyncZoomSessions extends Command
{
    protected $signature = 'lms:sync-zoom-sessions {--hours=48 : How far ahead to look}';

    protected $description = 'Provision or re-sync Zoom meetings for upcoming class sessions.';

    public function handle(ClassMeetingService $meetings): int
    {
        if (! $meetings->enabled()) {
            $this->warn('Zoom is not connected; nothing to sync.');

            return self::SUCCESS;
        }

        $synced = 0;
        $failed = 0;

        ClassSession::query()
            ->whereIn('status', [ClassSessionStatus::Scheduled->value, ClassSessionStatus::Live->value])
            ->whereBetween('starts_at', [now()->subHour(), now()->addHours((int) $this->option('hours'))])
            ->where(fn ($query) => $query
                ->whereNull('zoom_meeting_id')
                ->orWhere('zoom_sync_status', '!=', 'synced')
                ->orWhere('zoom_synced_at', '<', now()->subHours(6)))
            ->chunkById(50, function ($sessions) use ($meetings, &$synced, &$failed) {
                foreach ($sessions as $session) {
                    $result = $meetings->sync($session);

                    $result->zoom_sync_status === 'synced' ? $synced++ : $failed++;
                }
            });

        $this->info("Synced {$synced} session(s); {$failed} still need attention.");

        return self::SUCCESS;
    }
}
