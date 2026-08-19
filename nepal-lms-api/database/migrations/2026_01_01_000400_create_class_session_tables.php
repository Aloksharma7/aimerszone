<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('class_sessions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('batch_id')->constrained('batches')->cascadeOnDelete();
            $table->foreignUlid('teacher_id')->nullable()->constrained('users')->nullOnDelete();

            $table->string('topic', 180);
            $table->text('description')->nullable();
            $table->string('status', 20)->default('scheduled')->index();

            $table->timestamp('starts_at')->index();
            $table->timestamp('ends_at');
            $table->timestamp('actual_started_at')->nullable();
            $table->timestamp('actual_ended_at')->nullable();

            // Overrides the global join window when set by the teacher.
            $table->unsignedSmallInteger('join_opens_minutes_before')->nullable();

            $table->string('provider', 20)->default('zoom');
            $table->string('zoom_meeting_id', 40)->nullable()->index();
            $table->text('zoom_join_url')->nullable();

            // Host URL is never exposed to students; teachers receive it through
            // the authorized start endpoint only.
            $table->text('zoom_start_url')->nullable();
            $table->string('zoom_passcode', 40)->nullable();
            $table->string('zoom_sync_status', 20)->default('pending');
            $table->string('zoom_sync_message', 500)->nullable();
            $table->timestamp('zoom_synced_at')->nullable();

            // Manual fallback used when the provider is unavailable.
            $table->text('fallback_join_url')->nullable();
            $table->string('fallback_note', 500)->nullable();
            $table->boolean('fallback_active')->default(false);

            $table->timestamp('rescheduled_from')->nullable();
            $table->string('reschedule_reason', 500)->nullable();
            $table->string('cancellation_reason', 500)->nullable();

            $table->timestamp('attendance_finalized_at')->nullable();
            $table->foreignUlid('attendance_finalized_by')->nullable();

            $table->foreignUlid('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['batch_id', 'starts_at']);
            $table->index(['teacher_id', 'starts_at']);
        });

        Schema::create('attendances', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('class_session_id')->constrained('class_sessions')->cascadeOnDelete();
            $table->foreignUlid('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUlid('enrollment_id')->nullable()->constrained('enrollments')->nullOnDelete();

            $table->string('status', 20)->default('absent');
            $table->string('note', 300)->nullable();
            $table->unsignedSmallInteger('minutes_attended')->default(0);

            // Set when the student opened an authorized join link.
            $table->timestamp('joined_at')->nullable();
            $table->string('source', 20)->default('manual');

            $table->foreignUlid('marked_by')->nullable();
            $table->timestamp('marked_at')->nullable();
            $table->timestamps();

            $table->unique(['class_session_id', 'user_id']);
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendances');
        Schema::dropIfExists('class_sessions');
    }
};
