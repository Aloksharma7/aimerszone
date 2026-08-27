<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A public YouTube video is allowed to save (previously blocked outright)
     * but is flagged here so the teacher list can keep warning about it —
     * `sync_message` alone isn't enough since it's only surfaced while a
     * recording is still `processing`, and a public video usually verifies
     * as `available` immediately.
     */
    public function up(): void
    {
        Schema::table('recordings', function (Blueprint $table) {
            $table->boolean('is_youtube_public')->default(false)->after('sync_message');
        });
    }

    public function down(): void
    {
        Schema::table('recordings', function (Blueprint $table) {
            $table->dropColumn('is_youtube_public');
        });
    }
};
