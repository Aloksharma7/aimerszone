<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lets a teacher attach a recording or resource to a specific syllabus
 * module, so a student's course-level recordings/resources tabs can be
 * organized the same way the syllabus tab already is, instead of the flat
 * "everything in this course" list they show today (which is only useful as
 * the global, cross-course library — the tabs inside a course were showing
 * an identical, merely-filtered copy of it).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recordings', function (Blueprint $table) {
            $table->foreignUlid('syllabus_module_id')->nullable()->after('class_session_id')->constrained('syllabus_modules')->nullOnDelete();
        });

        Schema::table('resources', function (Blueprint $table) {
            $table->foreignUlid('syllabus_module_id')->nullable()->after('course_id')->constrained('syllabus_modules')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('recordings', function (Blueprint $table) {
            $table->dropForeign(['syllabus_module_id']);
            $table->dropColumn('syllabus_module_id');
        });

        Schema::table('resources', function (Blueprint $table) {
            $table->dropForeign(['syllabus_module_id']);
            $table->dropColumn('syllabus_module_id');
        });
    }
};
