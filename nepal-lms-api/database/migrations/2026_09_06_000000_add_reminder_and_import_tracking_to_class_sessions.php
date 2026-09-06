<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Both columns exist purely to make a scheduled job idempotent: without
     * them, a job that runs every minute (reminders) or every 15 minutes
     * (attendance import) would re-notify students or re-import the same
     * Zoom report on every run instead of exactly once per session.
     */
    public function up(): void
    {
        Schema::table('class_sessions', function (Blueprint $table) {
            $table->timestamp('reminder_sent_at')->nullable()->after('attendance_finalized_by');
            $table->timestamp('attendance_imported_at')->nullable()->after('reminder_sent_at');
        });
    }

    public function down(): void
    {
        Schema::table('class_sessions', function (Blueprint $table) {
            $table->dropColumn(['reminder_sent_at', 'attendance_imported_at']);
        });
    }
};
