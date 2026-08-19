<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recordings', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('batch_id')->constrained('batches')->cascadeOnDelete();
            $table->foreignUlid('class_session_id')->nullable()->constrained('class_sessions')->nullOnDelete();

            $table->string('title', 180);
            $table->string('module_title', 180)->nullable();
            $table->text('description')->nullable();

            // youtube = unlisted upload; upload = private disk; link = allow-listed URL.
            $table->string('source', 20)->default('youtube');
            $table->string('youtube_video_id', 60)->nullable()->index();
            $table->string('storage_path')->nullable();
            $table->string('storage_disk', 20)->nullable();
            $table->text('external_url')->nullable();
            $table->string('thumbnail_url')->nullable();

            $table->unsignedInteger('duration_seconds')->nullable();
            $table->timestamp('recorded_at')->nullable();

            // Null release date keeps a recording hidden from students.
            $table->timestamp('released_at')->nullable()->index();
            $table->string('state', 20)->default('processing');
            $table->string('sync_message', 500)->nullable();
            $table->timestamp('synced_at')->nullable();

            $table->foreignUlid('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['batch_id', 'released_at']);
        });

        Schema::create('recording_progress', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('recording_id')->constrained('recordings')->cascadeOnDelete();
            $table->foreignUlid('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedTinyInteger('progress_percent')->default(0);
            $table->unsignedInteger('last_position_seconds')->default(0);
            $table->timestamp('last_watched_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->unique(['recording_id', 'user_id']);
            $table->index(['user_id', 'last_watched_at']);
        });

        Schema::create('resources', function (Blueprint $table) {
            $table->ulid('id')->primary();

            // Batch-scoped when released to one cohort, course-scoped when shared.
            $table->foreignUlid('batch_id')->nullable()->constrained('batches')->cascadeOnDelete();
            $table->foreignUlid('course_id')->nullable()->constrained('courses')->cascadeOnDelete();

            $table->string('title', 180);
            $table->string('module_title', 180)->nullable();
            $table->string('file_type', 20)->nullable();
            $table->string('mime_type', 120)->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->string('storage_path');
            $table->string('storage_disk', 20)->default('local');
            $table->string('checksum', 64)->nullable();

            $table->timestamp('released_at')->nullable()->index();

            // Free-learning material available without enrollment.
            $table->boolean('is_public')->default(false)->index();

            $table->foreignUlid('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['batch_id', 'released_at']);
        });

        Schema::create('resource_downloads', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('resource_id')->constrained('resources')->cascadeOnDelete();
            $table->foreignUlid('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 500)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->index(['resource_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('resource_downloads');
        Schema::dropIfExists('resources');
        Schema::dropIfExists('recording_progress');
        Schema::dropIfExists('recordings');
    }
};
