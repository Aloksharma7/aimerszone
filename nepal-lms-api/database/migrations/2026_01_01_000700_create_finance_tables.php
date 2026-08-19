<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_methods', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('key', 40)->unique();
            $table->string('name', 80);
            $table->string('account_name', 120)->nullable();

            // Wallet number or bank account shown on /payment-instructions.
            $table->string('account_identifier', 120)->nullable();
            $table->string('bank_name', 120)->nullable();
            $table->string('branch', 120)->nullable();
            $table->string('qr_image_path')->nullable();
            $table->text('instructions')->nullable();

            $table->boolean('is_active')->default(true)->index();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUlid('course_id')->constrained('courses')->cascadeOnDelete();
            $table->foreignUlid('batch_id')->constrained('batches')->cascadeOnDelete();
            $table->foreignUlid('enrollment_id')->nullable()->constrained('enrollments')->nullOnDelete();
            $table->foreignUlid('payment_method_id')->nullable()->constrained('payment_methods')->nullOnDelete();

            $table->string('status', 20)->default('submitted')->index();

            // Expected amount is captured at submission time so that a later
            // price change cannot alter the accountant's view of the evidence.
            $table->unsignedInteger('expected_amount_npr');
            $table->unsignedInteger('submitted_amount_npr');

            $table->string('payer_name', 120)->nullable();
            $table->string('transaction_reference', 120)->nullable()->index();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->string('note', 500)->nullable();

            // Evidence is stored on a private disk; only signed routes serve it.
            $table->string('proof_path')->nullable();
            $table->string('proof_disk', 20)->nullable();
            $table->string('proof_mime', 120)->nullable();
            $table->unsignedBigInteger('proof_size')->nullable();
            $table->string('proof_hash', 64)->nullable()->index();

            $table->foreignUlid('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('review_note', 500)->nullable();
            $table->string('rejection_reason', 500)->nullable();
            $table->string('risk_label', 40)->nullable();

            $table->foreignUlid('submitted_by')->nullable();
            $table->string('idempotency_key', 120)->nullable();
            $table->timestamps();

            $table->index(['status', 'submitted_at']);
            $table->index(['user_id', 'status']);
        });

        Schema::create('receipts', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('payment_id')->unique()->constrained('payments')->cascadeOnDelete();
            $table->string('number', 40)->unique();
            $table->timestamp('issued_at');
            $table->unsignedInteger('amount_npr');

            // Immutable copy of the student, course and batch at issue time.
            $table->json('snapshot');
            $table->string('pdf_path')->nullable();
            $table->foreignUlid('issued_by')->nullable();
            $table->timestamps();
            $table->index('issued_at');
        });

        Schema::create('refunds', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('payment_id')->constrained('payments')->cascadeOnDelete();
            $table->foreignUlid('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedInteger('amount_npr');
            $table->string('status', 20)->default('requested')->index();
            $table->string('reason', 500);
            $table->string('method', 40)->nullable();
            $table->string('reference', 120)->nullable();
            $table->foreignUlid('requested_by')->nullable();
            $table->foreignUlid('approved_by')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('ledger_adjustments', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUlid('enrollment_id')->nullable()->constrained('enrollments')->nullOnDelete();
            $table->foreignUlid('payment_id')->nullable()->constrained('payments')->nullOnDelete();

            // discount | waiver | correction | penalty
            $table->string('type', 20)->index();

            // Signed value: a credit to the student is negative.
            $table->integer('amount_npr');
            $table->string('reason', 500);
            $table->string('reference', 120)->nullable();
            $table->timestamp('effective_at')->nullable();
            $table->foreignUlid('created_by')->nullable();
            $table->foreignUlid('approved_by')->nullable();
            $table->timestamps();
            $table->index(['type', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ledger_adjustments');
        Schema::dropIfExists('refunds');
        Schema::dropIfExists('receipts');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('payment_methods');
    }
};
