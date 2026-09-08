<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recordings', function (Blueprint $table) {
            // The player had no way to tell a vertically-recorded video from
            // a normal Zoom capture, so every recording was forced into the
            // same 16:9 box regardless of its actual shape. Set by the
            // teacher at upload time — there is no reliable way to detect a
            // YouTube-hosted video's real aspect ratio from the embedding
            // page's own JavaScript (the iframe is cross-origin).
            $table->string('orientation', 20)->default('landscape')->after('thumbnail_url');
        });
    }

    public function down(): void
    {
        Schema::table('recordings', function (Blueprint $table) {
            $table->dropColumn('orientation');
        });
    }
};
