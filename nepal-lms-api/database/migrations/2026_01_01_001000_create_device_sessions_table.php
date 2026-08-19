<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        /*
         * Tracks which device a student is signed in on.
         *
         * Account sharing is the single largest revenue leak for a paid course
         * in this market: one student buys, ten watch. Holding the bound device
         * separately from the session row means the binding survives a session
         * being regenerated, and gives the administrator something readable to
         * reset when a student genuinely changes phone.
         */
        Schema::create('device_sessions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('user_id')->constrained('users')->cascadeOnDelete();

            // Stable per browser/app install, stored hashed so the raw
            // fingerprint never sits in the database in a reusable form.
            $table->string('device_hash', 64)->index();

            $table->string('label', 120)->nullable();
            $table->string('platform', 40)->nullable();
            $table->string('browser', 40)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('session_id')->nullable()->index();

            $table->timestamp('last_active_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->string('revoked_reason', 120)->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'device_hash']);
            $table->index(['user_id', 'revoked_at']);
        });

        Schema::table('users', function (Blueprint $table) {
            // How many devices this account may hold at once. Null falls back
            // to the institution default, so a student who genuinely needs two
            // can be granted an exception without changing the global rule.
            $table->unsignedTinyInteger('device_limit')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('device_limit');
        });

        Schema::dropIfExists('device_sessions');
    }
};
