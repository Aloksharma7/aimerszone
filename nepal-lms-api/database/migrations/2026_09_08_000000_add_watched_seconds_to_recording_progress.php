<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recording_progress', function (Blueprint $table) {
            // Corroborates progress_percent, which is only ever a furthest-
            // seeked position: without this, scrubbing straight to the end
            // and letting it play for a moment reported the same 100% as
            // actually watching the whole thing.
            $table->unsignedInteger('watched_seconds')->default(0)->after('last_position_seconds');
        });
    }

    public function down(): void
    {
        Schema::table('recording_progress', function (Blueprint $table) {
            $table->dropColumn('watched_seconds');
        });
    }
};
