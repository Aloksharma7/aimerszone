<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Replaces the just-added module-level link with a lesson-level one.
 *
 * A module can hold several lessons ("Meaning, scope and importance",
 * "Micro vs macro economics", ...), each needing its own specific video —
 * module-level linking could only say "this recording is somewhere in this
 * module," not which lesson it actually is. Lesson-level linking gives the
 * module grouping back for free (a lesson already belongs to one), so there
 * is no reason to keep both columns.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recordings', function (Blueprint $table) {
            $table->dropForeign(['syllabus_module_id']);
            $table->dropColumn('syllabus_module_id');
            $table->foreignUlid('syllabus_lesson_id')->nullable()->after('class_session_id')->constrained('syllabus_lessons')->nullOnDelete();
        });

        Schema::table('resources', function (Blueprint $table) {
            $table->dropForeign(['syllabus_module_id']);
            $table->dropColumn('syllabus_module_id');
            $table->foreignUlid('syllabus_lesson_id')->nullable()->after('course_id')->constrained('syllabus_lessons')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('recordings', function (Blueprint $table) {
            $table->dropForeign(['syllabus_lesson_id']);
            $table->dropColumn('syllabus_lesson_id');
            $table->foreignUlid('syllabus_module_id')->nullable()->after('class_session_id')->constrained('syllabus_modules')->nullOnDelete();
        });

        Schema::table('resources', function (Blueprint $table) {
            $table->dropForeign(['syllabus_lesson_id']);
            $table->dropColumn('syllabus_lesson_id');
            $table->foreignUlid('syllabus_module_id')->nullable()->after('course_id')->constrained('syllabus_modules')->nullOnDelete();
        });
    }
};
