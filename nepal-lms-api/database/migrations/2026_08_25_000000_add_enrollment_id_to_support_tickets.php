<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The student ticket form always had a "related course" selector, but
 * nothing on the table could store which enrollment it meant — the field
 * was collected and silently discarded, so staff triaging a ticket never
 * knew which course a student was even asking about.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('support_tickets', function (Blueprint $table) {
            $table->foreignUlid('enrollment_id')->nullable()->after('user_id')->constrained('enrollments')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('support_tickets', function (Blueprint $table) {
            $table->dropForeign(['enrollment_id']);
            $table->dropColumn('enrollment_id');
        });
    }
};
