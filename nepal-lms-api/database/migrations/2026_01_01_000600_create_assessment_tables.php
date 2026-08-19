<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tests', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('batch_id')->constrained('batches')->cascadeOnDelete();
            $table->foreignUlid('course_id')->constrained('courses')->cascadeOnDelete();

            $table->string('title', 180);
            $table->text('instructions')->nullable();
            $table->string('status', 20)->default('draft')->index();

            $table->timestamp('opens_at')->nullable();
            $table->timestamp('closes_at')->nullable();
            $table->unsignedSmallInteger('duration_minutes')->default(45);
            $table->unsignedSmallInteger('total_marks')->default(0);
            $table->unsignedTinyInteger('attempts_allowed')->default(1);
            $table->unsignedSmallInteger('pass_mark')->default(0);

            $table->boolean('shuffle_questions')->default(false);
            $table->boolean('shuffle_options')->default(false);
            $table->decimal('negative_marking', 4, 2)->default(0);

            // immediate | after_close | manual — the API refuses to return a
            // result until this policy is satisfied.
            $table->string('result_release', 20)->default('after_close');
            $table->timestamp('results_released_at')->nullable();
            $table->boolean('allow_late_submission')->default(false);

            $table->foreignUlid('created_by')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['batch_id', 'status']);
            $table->index(['status', 'opens_at']);
        });

        Schema::create('test_questions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('test_id')->constrained('tests')->cascadeOnDelete();
            $table->unsignedSmallInteger('order')->default(0);
            $table->string('type', 20)->default('single');
            $table->text('prompt');
            $table->decimal('marks', 6, 2)->default(1);
            $table->decimal('negative_marks', 6, 2)->default(0);

            // Never serialised into an active student attempt payload.
            $table->text('explanation')->nullable();

            $table->timestamps();
            $table->index(['test_id', 'order']);
        });

        Schema::create('test_options', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('test_question_id')->constrained('test_questions')->cascadeOnDelete();
            $table->unsignedSmallInteger('order')->default(0);
            $table->text('label');

            // Stripped from every student-facing response.
            $table->boolean('is_correct')->default(false);

            $table->timestamps();
            $table->index(['test_question_id', 'order']);
        });

        Schema::create('test_attempts', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('test_id')->constrained('tests')->cascadeOnDelete();
            $table->foreignUlid('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUlid('enrollment_id')->nullable()->constrained('enrollments')->nullOnDelete();

            $table->unsignedTinyInteger('attempt_number')->default(1);
            $table->string('status', 20)->default('in_progress')->index();

            // Server-authoritative clock. The browser never decides expiry.
            $table->timestamp('started_at');
            $table->timestamp('expires_at');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('graded_at')->nullable();

            $table->decimal('score', 8, 2)->nullable();
            $table->decimal('max_score', 8, 2)->nullable();
            $table->boolean('passed')->nullable();
            $table->boolean('auto_submitted')->default(false);
            $table->json('question_order')->nullable();

            $table->string('submit_idempotency_key', 120)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            $table->unique(['test_id', 'user_id', 'attempt_number']);
            $table->index(['user_id', 'status']);
            $table->index(['status', 'expires_at']);
        });

        Schema::create('test_responses', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('test_attempt_id')->constrained('test_attempts')->cascadeOnDelete();
            $table->foreignUlid('test_question_id')->constrained('test_questions')->cascadeOnDelete();

            $table->json('selected_option_ids')->nullable();
            $table->text('text_answer')->nullable();
            $table->boolean('is_correct')->nullable();
            $table->decimal('awarded_marks', 6, 2)->nullable();
            $table->timestamp('answered_at')->nullable();
            $table->timestamps();

            $table->unique(['test_attempt_id', 'test_question_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('test_responses');
        Schema::dropIfExists('test_attempts');
        Schema::dropIfExists('test_options');
        Schema::dropIfExists('test_questions');
        Schema::dropIfExists('tests');
    }
};
