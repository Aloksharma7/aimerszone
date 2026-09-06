<?php

use App\Console\Commands\CheckIntegrationHealth;
use App\Console\Commands\ExpireEnrollments;
use App\Console\Commands\FinalizeExpiredAttempts;
use App\Console\Commands\SyncZoomSessions;
use App\Console\Commands\WarnExpiringEnrollments;
use Illuminate\Support\Facades\Schedule;

/*
 * Requires one cron entry on the server:
 *   * * * * * cd /path/to/api && php artisan schedule:run >> /dev/null 2>&1
 */

// Attempts must close on time even if the student's browser never came back.
Schedule::command(FinalizeExpiredAttempts::class)->everyMinute()->withoutOverlapping();

// Gives a failed meeting another chance well before students try to join.
// Requires the system cron entry `* * * * * php artisan schedule:run` on the
// VPS — see deploy/README.md — or this (and everyMinute() above) never fires.
Schedule::command(SyncZoomSessions::class)->everyFifteenMinutes()->withoutOverlapping();

// Warns before ExpireEnrollments runs, not after — a student whose access
// simply stopped working had no way to tell that from the platform breaking.
Schedule::command(WarnExpiringEnrollments::class)->dailyAt('08:00');

Schedule::command(ExpireEnrollments::class)->dailyAt('00:30');
Schedule::command(CheckIntegrationHealth::class)->dailyAt('01:00');
