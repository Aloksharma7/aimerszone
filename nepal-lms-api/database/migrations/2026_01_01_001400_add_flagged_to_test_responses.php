<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The runner has a "flag for review" control and the autosave payload
     * already carried flagged_question_ids, but there was nowhere to put them:
     * the API accepted the field and dropped it, so a flag vanished on reload.
     */
    public function up(): void
    {
        Schema::table('test_responses', function (Blueprint $table) {
            $table->boolean('flagged')->default(false)->after('answered_at');
        });
    }

    public function down(): void
    {
        Schema::table('test_responses', function (Blueprint $table) {
            $table->dropColumn('flagged');
        });
    }
};
