<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name', 120);
            $table->string('slug', 140)->unique();
            $table->string('description', 500)->nullable();
            $table->string('icon', 40)->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('teacher_profiles', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->string('slug', 140)->unique();
            $table->string('headline', 120)->nullable();
            $table->json('subjects')->nullable();
            $table->string('experience_summary', 255)->nullable();
            $table->text('bio')->nullable();
            $table->string('avatar_path')->nullable();

            // Only public profiles appear on /teachers and /teachers/{slug}.
            $table->boolean('is_public')->default(true)->index();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('courses', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('category_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->string('slug', 160)->unique();
            $table->string('code', 32)->unique();
            $table->string('title', 180);
            $table->string('short_title', 120)->nullable();
            $table->string('short_description', 500)->nullable();
            $table->longText('description')->nullable();
            $table->string('thumbnail_path')->nullable();

            $table->string('access_type', 10)->default('paid');
            $table->unsignedInteger('price_npr')->default(0);
            $table->unsignedInteger('original_price_npr')->nullable();

            // Live / Recordings / Tests / Notes badges shown on course cards.
            $table->json('features')->nullable();

            $table->boolean('published')->default(false)->index();
            $table->timestamp('published_at')->nullable();
            $table->string('status', 20)->default('draft')->index();

            $table->foreignUlid('owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUlid('created_by')->nullable();
            $table->foreignUlid('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['published', 'status']);
        });

        Schema::create('syllabus_modules', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('course_id')->constrained('courses')->cascadeOnDelete();
            $table->string('title', 180);
            $table->string('summary', 500)->nullable();
            $table->unsignedSmallInteger('order')->default(0);
            $table->timestamps();
            $table->index(['course_id', 'order']);
        });

        Schema::create('syllabus_lessons', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('syllabus_module_id')->constrained('syllabus_modules')->cascadeOnDelete();
            $table->string('title', 180);
            $table->string('type', 30)->default('Lesson');
            $table->unsignedSmallInteger('order')->default(0);
            $table->timestamps();
            $table->index(['syllabus_module_id', 'order']);
        });

        Schema::create('lesson_completions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('syllabus_lesson_id')->constrained('syllabus_lessons')->cascadeOnDelete();
            $table->foreignUlid('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUlid('enrollment_id')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->unique(['syllabus_lesson_id', 'user_id']);
        });

        Schema::create('batches', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('course_id')->constrained('courses')->cascadeOnDelete();
            $table->string('title', 160);
            $table->string('code', 40)->unique();
            $table->string('public_id', 60)->unique();

            $table->string('status', 20)->default('draft')->index();
            $table->timestamp('start_at')->nullable();
            $table->timestamp('end_at')->nullable();

            // Content access continues after teaching ends.
            $table->timestamp('access_until')->nullable();

            $table->string('schedule_summary', 180)->nullable();
            $table->json('schedule_days')->nullable();
            $table->time('class_start_time')->nullable();
            $table->time('class_end_time')->nullable();

            $table->unsignedInteger('price_npr')->default(0);
            $table->unsignedSmallInteger('capacity')->nullable();

            // Recurring Zoom meeting reused by every session of the batch.
            $table->string('zoom_meeting_id', 40)->nullable();
            $table->string('zoom_join_url')->nullable();
            $table->string('zoom_passcode', 40)->nullable();
            $table->string('youtube_playlist_id', 60)->nullable();

            $table->foreignUlid('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['course_id', 'status']);
            $table->index(['status', 'start_at']);
        });

        Schema::create('batch_teacher', function (Blueprint $table) {
            $table->foreignUlid('batch_id')->constrained('batches')->cascadeOnDelete();
            $table->foreignUlid('user_id')->constrained('users')->cascadeOnDelete();
            $table->boolean('is_lead')->default(false);
            $table->primary(['batch_id', 'user_id']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('batch_teacher');
        Schema::dropIfExists('batches');
        Schema::dropIfExists('lesson_completions');
        Schema::dropIfExists('syllabus_lessons');
        Schema::dropIfExists('syllabus_modules');
        Schema::dropIfExists('courses');
        Schema::dropIfExists('teacher_profiles');
        Schema::dropIfExists('categories');
    }
};
