<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('enrollments', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUlid('course_id')->constrained('courses')->cascadeOnDelete();
            $table->foreignUlid('batch_id')->constrained('batches')->cascadeOnDelete();

            $table->string('status', 20)->default('pending')->index();
            $table->timestamp('access_start_at')->nullable();
            $table->timestamp('access_end_at')->nullable();

            // How the seat was granted: self service, staff action, or free course.
            $table->string('source', 20)->default('self');
            $table->foreignUlid('approved_payment_id')->nullable();
            $table->foreignUlid('created_by')->nullable();
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancellation_reason', 500)->nullable();

            // Denormalised progress, recalculated by the progress service.
            $table->unsignedTinyInteger('attendance_percent')->default(0);
            $table->unsignedTinyInteger('recording_percent')->default(0);
            $table->unsignedTinyInteger('test_percent')->default(0);
            $table->unsignedTinyInteger('syllabus_percent')->default(0);
            $table->unsignedTinyInteger('overall_percent')->default(0);
            $table->timestamp('progress_calculated_at')->nullable();

            $table->timestamps();

            // A student holds at most one seat per batch.
            $table->unique(['user_id', 'batch_id']);
            $table->index(['status', 'access_end_at']);
        });

        Schema::create('enrollment_requests', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUlid('course_id')->constrained('courses')->cascadeOnDelete();
            $table->foreignUlid('batch_id')->constrained('batches')->cascadeOnDelete();
            $table->string('status', 20)->default('pending')->index();
            $table->string('basis', 30)->default('payment');
            $table->string('note', 500)->nullable();
            $table->foreignUlid('requested_by')->nullable();
            $table->foreignUlid('decided_by')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->string('decision_reason', 500)->nullable();
            $table->timestamps();
            $table->index(['batch_id', 'status']);
        });

        Schema::create('student_support_actions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUlid('enrollment_id')->nullable()->constrained('enrollments')->nullOnDelete();
            $table->string('action', 40);
            $table->string('note', 500)->nullable();
            $table->json('payload')->nullable();
            $table->foreignUlid('performed_by')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_support_actions');
        Schema::dropIfExists('enrollment_requests');
        Schema::dropIfExists('enrollments');
    }
};
