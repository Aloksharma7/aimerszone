<?php

use App\Console\Commands\AutoImportZoomAttendance;
use App\Console\Commands\CheckIntegrationHealth;
use App\Console\Commands\CleanupStaleRecordingDownloads;
use App\Console\Commands\ExpireEnrollments;
use App\Console\Commands\ExpireLiveClasses;
use App\Console\Commands\FinalizeExpiredAttempts;
use App\Console\Commands\NotifyUpcomingClasses;
use App\Console\Commands\RecheckProcessingRecordings;
use App\Console\Commands\SyncZoomSessions;
use App\Console\Commands\WarnExpiringEnrollments;
use Illuminate\Support\Facades\Schedule;

/*
 * Requires one cron entry on the server:
 *   * * * * * cd /path/to/api && php artisan schedule:run >> /dev/null 2>&1
 */

// Attempts must close on time even if the student's browser never came back.
Schedule::command(FinalizeExpiredAttempts::class)->everyMinute()->withoutOverlapping();

// 5-minute-before reminder — the +5 mark must be caught within a tight
// window, so this runs every minute rather than on a coarser cadence.
Schedule::command(NotifyUpcomingClasses::class)->everyMinute()->withoutOverlapping();

// Gives a failed meeting another chance well before students try to join.
// Requires the system cron entry `* * * * * php artisan schedule:run` on the
// VPS — see deploy/README.md — or this (and everyMinute() above) never fires.
Schedule::command(SyncZoomSessions::class)->everyFifteenMinutes()->withoutOverlapping();

// Nothing else ever moves a class out of "Live" on a timeline a student can
// see — only the teacher manually finalizing attendance does, which can be
// hours later or never. Runs on the same cadence as the sync above.
Schedule::command(ExpireLiveClasses::class)->everyFifteenMinutes()->withoutOverlapping();

// Replaces the teacher's manual "Import" click — same Zoom processing delay
// as the sync above, so it runs on the same cadence.
Schedule::command(AutoImportZoomAttendance::class)->everyFifteenMinutes()->withoutOverlapping();

// Warns before ExpireEnrollments runs, not after — a student whose access
// simply stopped working had no way to tell that from the platform breaking.
Schedule::command(WarnExpiringEnrollments::class)->dailyAt('08:00');

Schedule::command(ExpireEnrollments::class)->dailyAt('00:30');
Schedule::command(CheckIntegrationHealth::class)->dailyAt('01:00');

// Promotes an auto-uploaded recording out of "processing" once YouTube
// finishes encoding it — otherwise nothing would ever flip it to available.
Schedule::command(RecheckProcessingRecordings::class)->everyFifteenMinutes()->withoutOverlapping();

// Safety net only: ProcessZoomRecording already deletes its own temp file
// the moment an upload succeeds. This catches whatever a crashed or
// abandoned job leaves behind.
Schedule::command(CleanupStaleRecordingDownloads::class)->dailyAt('02:00');
