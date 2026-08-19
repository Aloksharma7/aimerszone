<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->ulid('id')->primary();

            // institution | security | operations | assessment | integrations
            $table->string('group', 40)->index();
            $table->string('key', 60);
            $table->json('value')->nullable();
            $table->string('type', 20)->default('string');

            // Public settings are served unauthenticated by /public/settings.
            $table->boolean('is_public')->default(false);

            // Encrypted values (provider secrets) are never returned in reads.
            $table->boolean('is_encrypted')->default(false);
            $table->foreignUlid('updated_by')->nullable();
            $table->timestamps();

            $table->unique(['group', 'key']);
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('actor_id')->nullable()->constrained('users')->nullOnDelete();

            // Kept as text so the entry stays readable after the actor is removed.
            $table->string('actor_label', 160)->nullable();
            $table->string('action', 80)->index();
            $table->string('target_type', 60)->nullable();
            $table->string('target_id', 40)->nullable();
            $table->string('target_label', 190)->nullable();
            $table->string('reason', 500)->nullable();
            $table->json('properties')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 500)->nullable();
            $table->string('request_id', 60)->nullable();
            $table->timestamp('occurred_at')->index();
            $table->timestamps();

            $table->index(['target_type', 'target_id']);
            $table->index(['actor_id', 'occurred_at']);
        });

        Schema::create('integration_events', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('provider', 20)->index();
            $table->string('action', 60);
            $table->string('reference', 120)->nullable();
            $table->string('status', 20)->default('success')->index();
            $table->string('message', 500)->nullable();
            $table->json('payload')->nullable();
            $table->unsignedSmallInteger('duration_ms')->nullable();
            $table->foreignUlid('actor_id')->nullable();
            $table->timestamp('occurred_at')->index();
            $table->timestamps();
            $table->index(['provider', 'occurred_at']);
        });

        Schema::create('idempotency_keys', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('key', 120);
            $table->foreignUlid('user_id')->nullable();
            $table->string('endpoint', 190);

            // Guards against the same key being reused with a different body.
            $table->string('request_hash', 64);
            $table->string('status', 20)->default('processing');
            $table->unsignedSmallInteger('response_code')->nullable();
            $table->longText('response_body')->nullable();
            $table->timestamp('locked_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('expires_at')->index();
            $table->timestamps();

            $table->unique(['key', 'endpoint']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('idempotency_keys');
        Schema::dropIfExists('integration_events');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('settings');
    }
};
