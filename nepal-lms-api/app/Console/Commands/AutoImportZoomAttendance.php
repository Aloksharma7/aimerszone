<?php

namespace App\Console\Commands;

use App\Enums\ClassSessionStatus;
use App\Models\ClassSession;
use App\Services\AttendanceImportService;
use Illuminate\Console\Command;

/**
 * Removes the "click Import" step from the teacher's attendance workflow.
 *
 * Runs on the same cadence as SyncZoomSessions since both depend on Zoom's
 * own processing delay. A session stops being retried once it falls outside
 * the 48-hour window below — Zoom's report is not going to show up after
 * that, and the teacher's manual Import button still works at any time if
 * one is needed later.
 */
class AutoImportZoomAttendance extends Command
{
    protected $signature = 'lms:auto-import-attendance';

    protected $description = 'Automatically pull the Zoom participant report once a class has ended.';

    public function handle(AttendanceImportService $importer): int
    {
        $imported = 0;
        $waiting = 0;
        $skipped = 0;

        ClassSession::query()
            ->where('provider', 'zoom')
            ->where('status', '!=', ClassSessionStatus::Cancelled->value)
            ->whereNotNull('zoom_meeting_id')
            ->whereNull('attendance_imported_at')
            ->whereNull('attendance_finalized_at')
            ->whereBetween('ends_at', [now()->subHours(48), now()->subMinutes(10)])
            ->chunkById(50, function ($sessions) use ($importer, &$imported, &$waiting, &$skipped) {
                foreach ($sessions as $session) {
                    $result = $importer->importFromZoom($session);

                    if ($result['status'] === 'no_report_yet') {
                        // Try again next run — still within the 48-hour window.
                        $waiting++;

                        continue;
                    }

                    $session->forceFill(['attendance_imported_at' => now()])->save();

                    $result['status'] === 'ok' ? $imported++ : $skipped++;
                }
            });

        $this->info("Auto-imported {$imported} session(s); {$waiting} still waiting on Zoom; {$skipped} could not be imported.");

        return self::SUCCESS;
    }
}
