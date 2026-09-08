<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Enums\PaymentStatus;
use App\Exceptions\DomainException;
use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\FeatureGate;
use App\Services\Integrations\EsewaClient;
use App\Services\PaymentDecisionService;
use App\Services\PaymentSubmissionService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * eSewa checkout for a batch seat.
 *
 * The manual screenshot flow still exists and remains the fallback; this is the
 * path that removes a human from the loop when the institution has a merchant
 * account. A gateway payment that verifies is approved automatically through
 * the same PaymentDecisionService the accountant uses, so enrollment, receipt
 * and audit trail are produced identically either way.
 */
class EsewaController extends Controller
{
    public function __construct(
        protected EsewaClient $esewa,
        protected FeatureGate $features,
        protected PaymentDecisionService $decisions,
        protected PaymentSubmissionService $submissions,
        protected AuditLogger $audit,
    ) {}

    /** Creates the pending payment and returns the form to post to eSewa. */
    public function checkout(Request $request): JsonResponse
    {
        $this->assertEnabled();

        $data = $request->validate(['batch_id' => ['required', 'string']]);

        $student = $request->user();

        // Locked and re-checked against the full, shared enrollability
        // rules (not just "already enrolled") for the duration of the
        // check-and-create — previously unlocked and eSewa-specific, so a
        // student with a manual payment already pending review, or a batch
        // that had since filled up, could still start (and independently
        // complete) a second, gateway-verified payment for the same seat.
        $payment = DB::transaction(function () use ($data, $student) {
            $batch = Batch::with('course')->whereKey($data['batch_id'])->lockForUpdate()->firstOrFail();

            $this->submissions->assertEnrollable($student, $batch);

            $expected = (int) ($batch->price_npr ?: $batch->course?->price_npr ?? 0);

            if ($expected <= 0) {
                throw DomainException::unprocessable('This batch has no price set.', 'no_price');
            }

            $method = PaymentMethod::where('key', 'esewa')->firstOrFail();

            // Reuse a pending gateway attempt rather than stacking rows each
            // time the student reopens the checkout page. assertEnrollable()
            // only rejects a Submitted/UnderReview payment, so re-finding
            // this same Draft row here is never blocked by its own presence.
            return Payment::firstOrCreate(
                [
                    'user_id' => $student->getKey(),
                    'batch_id' => $batch->getKey(),
                    'status' => PaymentStatus::Draft->value,
                ],
                [
                    'course_id' => $batch->course_id,
                    'payment_method_id' => $method->getKey(),
                    'expected_amount_npr' => $expected,
                    'submitted_amount_npr' => $expected,
                    'payer_name' => $student->name,
                    'submitted_by' => $student->getKey(),
                    'note' => 'eSewa checkout',
                ],
            );
        });

        return ApiResponse::item($this->esewa->checkout($payment));
    }

    /**
     * Handles the signed return from eSewa.
     *
     * Nothing here trusts the browser: the payload is verified against our own
     * secret, and the amount is re-checked against the price we recorded, so a
     * tampered redirect cannot buy a seat cheaply or for free.
     */
    public function callback(Request $request): JsonResponse
    {
        $this->assertEnabled();

        $data = $request->validate(['data' => ['required', 'string', 'max:4000']]);

        $verified = $this->esewa->verifyReturn($data['data']);

        if ($verified === null) {
            throw DomainException::unprocessable(
                'This payment could not be verified with eSewa. If money left your account, contact the office with your transaction code.',
                'esewa_verification_failed',
            );
        }

        if ($verified['status'] !== 'COMPLETE') {
            return ApiResponse::item(['status' => 'incomplete', 'message' => 'eSewa reported the payment as '.$verified['status'].'.']);
        }

        $payment = $this->resolvePayment($request->user(), $verified['transaction_uuid']);

        if ($payment->status === PaymentStatus::Approved) {
            // eSewa can redirect twice; the second arrival is not an error.
            return ApiResponse::item(['status' => 'approved', 'payment_id' => $payment->id]);
        }

        if ((int) round((float) $verified['total_amount']) < $payment->expected_amount_npr) {
            throw DomainException::conflict(
                'The amount eSewa reported is less than the batch price. The office will review this manually.',
                'esewa_amount_mismatch',
            );
        }

        DB::transaction(function () use ($payment, $verified) {
            $payment->forceFill([
                'status' => PaymentStatus::Submitted->value,
                'transaction_reference' => $verified['transaction_code'] ?? $verified['transaction_uuid'],
                'submitted_amount_npr' => (int) round((float) $verified['total_amount']),
                'paid_at' => now(),
                'submitted_at' => now(),
                'note' => 'Verified eSewa payment',
            ])->save();
        });

        // Approved by the system rather than a person, so the reviewer is the
        // student's own record; separation of duties does not apply to a
        // cryptographically verified gateway payment.
        $approved = $this->decisions->approveVerifiedGatewayPayment($payment->fresh(), 'eSewa signature verified');

        $this->audit->log('payment.esewa_verified', $approved, $request->user(), properties: [
            'transaction_code' => $verified['transaction_code'],
        ]);

        return ApiResponse::item(['status' => 'approved', 'payment_id' => $approved->id]);
    }

    protected function resolvePayment(User $student, string $transactionUuid): Payment
    {
        $suffix = str_replace('PMT-', '', $transactionUuid);

        // LIKE rather than RIGHT(): the latter is MySQL-only and the test
        // suite runs on SQLite.
        $payment = Payment::query()
            ->where('user_id', $student->getKey())
            ->where('id', 'like', '%'.$suffix)
            ->latest()
            ->first();

        if ($payment === null) {
            throw DomainException::unprocessable('That transaction does not match any payment on your account.', 'payment_not_found');
        }

        return $payment;
    }

    protected function assertEnabled(): void
    {
        if (! $this->features->esewa()) {
            throw DomainException::conflict(
                'Online payment is not enabled. Upload your payment screenshot instead.',
                'esewa_disabled',
            );
        }
    }
}
