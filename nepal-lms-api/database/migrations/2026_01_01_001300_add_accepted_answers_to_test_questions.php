<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Short-text questions had nowhere to store an answer key, so they could
     * never be scored: the grader returned 0 and then applied the negative
     * mark, punishing a student for writing anything at all.
     *
     * The accepted answers are a list of strings; a response matches if it
     * equals any of them after case-folding and whitespace collapsing.
     */
    public function up(): void
    {
        Schema::table('test_questions', function (Blueprint $table) {
            $table->json('accepted_answers')->nullable()->after('explanation');
        });
    }

    public function down(): void
    {
        Schema::table('test_questions', function (Blueprint $table) {
            $table->dropColumn('accepted_answers');
        });
    }
};
