<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('announcements', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('title', 180);
            $table->string('summary', 500)->nullable();
            $table->longText('body')->nullable();

            // all | course | batch | role
            $table->string('audience', 20)->default('all')->index();
            $table->foreignUlid('course_id')->nullable()->constrained('courses')->cascadeOnDelete();
            $table->foreignUlid('batch_id')->nullable()->constrained('batches')->cascadeOnDelete();
            $table->string('role_key', 40)->nullable();

            $table->string('channel', 20)->default('portal');
            $table->string('status', 20)->default('draft')->index();
            $table->timestamp('publish_at')->nullable();
            $table->timestamp('published_at')->nullable()->index();
            $table->boolean('pinned')->default(false);
            $table->string('link', 255)->nullable();

            $table->foreignUlid('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'published_at']);
        });

        Schema::create('announcement_reads', function (Blueprint $table) {
            $table->foreignUlid('announcement_id')->constrained('announcements')->cascadeOnDelete();
            $table->foreignUlid('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('read_at')->nullable();
            $table->primary(['announcement_id', 'user_id']);
            $table->index('user_id');
        });

        Schema::create('support_tickets', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('reference', 30)->unique();

            // Null for the public contact form.
            $table->foreignUlid('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name', 120);
            $table->string('email', 190)->nullable();
            $table->string('mobile', 20)->nullable();

            $table->string('subject', 180);
            $table->string('category', 40)->default('general');
            $table->longText('message');
            $table->string('status', 20)->default('open')->index();
            $table->string('priority', 20)->default('normal');
            $table->string('source', 20)->default('public');

            $table->foreignUlid('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->string('resolution_note', 500)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
        });

        Schema::create('support_ticket_messages', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('support_ticket_id')->constrained('support_tickets')->cascadeOnDelete();
            $table->foreignUlid('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->longText('body');

            // Internal notes are never returned to the student.
            $table->boolean('is_internal')->default(false);
            $table->timestamps();
            $table->index(['support_ticket_id', 'created_at']);
        });

        Schema::create('faqs', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('question', 255);
            $table->longText('answer');
            $table->string('category', 40)->default('general')->index();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_published')->default(true)->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('faqs');
        Schema::dropIfExists('support_ticket_messages');
        Schema::dropIfExists('support_tickets');
        Schema::dropIfExists('announcement_reads');
        Schema::dropIfExists('announcements');
    }
};
