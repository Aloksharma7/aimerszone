<?php

namespace App\Services;

use App\Enums\EnrollmentStatus;
use App\Enums\PaymentStatus;
use App\Exceptions\DomainException;
use App\Models\Enrollment;
use App\Models\Payment;
use App\Models\Receipt;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The approval transaction — the single point where money becomes access.
 *
 * Approving does four things that must all happen or none of them:
 *   1. move the payment to approved,
 *   2. activate (or create) the enrollment,
 *   3. issue a receipt with an immutable snapshot,
 *   4. write the audit entry.
 *
 * The payment row is locked for the duration, so two accountants clicking
 * approve at the same moment cannot both grant a seat or double-issue a receipt.
 */
class PaymentDecisionService
{
    public function __construct(
        protected AuditLogger $audit,
        protected SettingsRepository $settings,
        protected NotificationDispatcher $notifications,
        protected ReceiptPdfService $receiptPdf,
        protected DashboardCache $dashboardCache,
    ) {}

    public function approve(Payment $payment, User $reviewer, ?string $note = null): Payment
    {
        return DB::transaction(function () use ($payment, $reviewer, $note) {
            $locked = $this->lock($payment, $reviewer);

            $enrollment = $this->activateEnrollment($locked, $reviewer);

            $locked->forceFill([
                'status' => PaymentStatus::Approved->value,
                'enrollment_id' => $enrollment->getKey(),
                'reviewed_by' => $reviewer->getKey(),
                'reviewed_at' => now(),
                'review_note' => $note,
                'rejection_reason' => null,
            ])->save();

            if ($this->settings->bool('operations.automatic_receipts', true)) {
                $this->issueReceipt($locked, $reviewer);
            }

            $this->audit->log('payment.approved', $locked, $reviewer, $note, [
                'amount' => $locked->submitted_amount_npr,
                'expected' => $locked->expected_amount_npr,
                'enrollment_id' => $enrollment->getKey(),
            ]);

            // Queued until the transaction commits: a student must never be
            // told about an approval that then rolls back, and the dashboards
            // must not go cold for a decision that never actually happened.
            DB::afterCommit(function () use ($locked) {
                $this->notifications->paymentApproved($locked->fresh()->load(['user', 'course']));
                $this->dashboardCache->forgetPaymentRelated();
            });

            return $locked->fresh();
        });
    }

    /**
     * Approves a payment the gateway has already proved.
     *
     * Separation of duties exists to stop one person both submitting and
     * approving evidence they could have fabricated. A cryptographically
     * verified eSewa return is not that: nobody submitted a screenshot, and the
     * signature cannot be forged without our secret. The seat, receipt and
     * audit entry are produced by exactly the same code as a manual approval;
     * only the reviewer differs, and the audit entry records that it was the
     * gateway rather than a person.
     */
    public function approveVerifiedGatewayPayment(Payment $payment, string $note): Payment
    {
        return DB::transaction(function () use ($payment, $note) {
            $locked = Payment::whereKey($payment->getKey())->lockForUpdate()->firstOrFail();

            if ($locked->status === PaymentStatus::Approved) {
                return $locked;
            }

            if (! $locked->isReviewable()) {
                throw DomainException::conflict(
                    'This payment was already '.$locked->status->value.'.',
                    'payment_not_reviewable',
                );
            }

            // The relation is non-null by schema, but firstOrFail() makes the
            // failure explicit rather than a type error deep in the call.
            $student = $locked->user()->firstOrFail();

            $enrollment = $this->activateEnrollment($locked, $student);

            $locked->forceFill([
                'status' => PaymentStatus::Approved->value,
                'enrollment_id' => $enrollment->getKey(),
                'reviewed_at' => now(),
                'review_note' => $note,
                'risk_label' => null,
            ])->save();

            if ($this->settings->bool('operations.automatic_receipts', true)) {
                $this->issueReceipt($locked, $student);
            }

            $this->audit->log('payment.approved_by_gateway', $locked, null, $note, [
                'amount' => $locked->submitted_amount_npr,
                'enrollment_id' => $enrollment->getKey(),
            ]);

            // Only paymentApproved: it already says the seat is active, and
            // firing enrollmentActivated too meant a student paying by
            // gateway got two SMS for one event where a manual approval
            // (approve(), above) sends one.
            DB::afterCommit(function () use ($locked) {
                $this->notifications->paymentApproved($locked->fresh()->load(['user', 'course']));
                $this->dashboardCache->forgetPaymentRelated();
            });

            return $locked->fresh();
        });
    }

    /**
     * Approves a payment the submitting staff member already verified in
     * person — a WhatsApp screenshot, a counter payment — at the moment they
     * captured it, so the student gets access on submission instead of
     * waiting on a second reviewer.
     *
     * Separation of duties (see lock()) exists to stop one person submitting
     * evidence they could have fabricated and then approving it themselves.
     * That risk does not apply here in the same way: the submitting officer
     * already looked at the same evidence a second reviewer would only be
     * re-glancing at. It is skipped only when the submission raised no risk
     * flag — a duplicate screenshot, short payment or overpayment still goes
     * through the normal queue for an independent second look.
     */
    public function approveStaffCapturedPayment(Payment $payment, User $staff, ?string $note = null): Payment
    {
        return DB::transaction(function () use ($payment, $staff, $note) {
            $locked = Payment::whereKey($payment->getKey())->lockForUpdate()->firstOrFail();

            if (! $locked->isReviewable()) {
                throw DomainException::conflict(
                    'This payment was already '.$locked->status->value.'.',
                    'payment_not_reviewable',
                );
            }

            $enrollment = $this->activateEnrollment($locked, $staff);

            $locked->forceFill([
                'status' => PaymentStatus::Approved->value,
                'enrollment_id' => $enrollment->getKey(),
                'reviewed_by' => $staff->getKey(),
                'reviewed_at' => now(),
                'review_note' => $note,
                'rejection_reason' => null,
            ])->save();

            if ($this->settings->bool('operations.automatic_receipts', true)) {
                $this->issueReceipt($locked, $staff);
            }

            // Distinct from payment.approved so the audit trail — and any
            // later per-staff enrollment report — can tell an instant,
            // self-verified capture apart from a decision a second reviewer
            // actually made.
            $this->audit->log('payment.approved_at_capture', $locked, $staff, $note, [
                'amount' => $locked->submitted_amount_npr,
                'expected' => $locked->expected_amount_npr,
                'enrollment_id' => $enrollment->getKey(),
            ]);

            DB::afterCommit(function () use ($locked) {
                $this->notifications->paymentApproved($locked->fresh()->load(['user', 'course']));
                $this->dashboardCache->forgetPaymentRelated();
            });

            return $locked->fresh();
        });
    }

    public function reject(Payment $payment, User $reviewer, string $reason): Payment
    {
        return DB::transaction(function () use ($payment, $reviewer, $reason) {
            $locked = $this->lock($payment, $reviewer);

            $locked->forceFill([
                'status' => PaymentStatus::Rejected->value,
                'reviewed_by' => $reviewer->getKey(),
                'reviewed_at' => now(),
                'rejection_reason' => $reason,
            ])->save();

            // A rejection never touches an existing enrollment: a student who
            // already holds a seat from an earlier payment keeps it.
            $this->audit->log('payment.rejected', $locked, $reviewer, $reason);

            DB::afterCommit(function () use ($locked, $reason) {
                $this->notifications->paymentRejected($locked->fresh()->load('user'), $reason);
                $this->dashboardCache->forgetPaymentRelated();
            });

            return $locked->fresh();
        });
    }

    /**
     * Parks a payment for investigation without deciding it. The submission
     * stays reviewable, so this is a pause rather than an outcome.
     */
    public function flag(Payment $payment, User $reviewer, string $reason): Payment
    {
        $payment->forceFill([
            'status' => PaymentStatus::UnderReview->value,
            'risk_label' => 'flagged_duplicate',
            'review_note' => $reason,
        ])->save();

        $this->audit->log('payment.flagged', $payment, $reviewer, $reason);
        $this->dashboardCache->forgetPaymentRelated();

        return $payment->fresh();
    }

    /* ----------------------------------------------------------------
     | Internals
     | ---------------------------------------------------------------- */

    /**
     * Re-reads the payment under a row lock and re-checks every precondition.
     *
     * The policy already ran in the controller, but state can change between
     * the page load and the click, so the decision is re-validated here where
     * it is actually serialized.
     */
    protected function lock(Payment $payment, User $reviewer): Payment
    {
        $locked = Payment::whereKey($payment->getKey())->lockForUpdate()->firstOrFail();

        if (! $locked->isReviewable()) {
            throw DomainException::conflict(
                'This payment was already '.$locked->status->value.'.',
                'payment_not_reviewable',
            );
        }

        // Separation of duties: whoever submitted the evidence must not be the
        // one who approves it.
        if ($locked->submitted_by === $reviewer->getKey() && ! $reviewer->isAdmin()) {
            throw DomainException::forbidden(
                'You submitted this payment, so it must be reviewed by someone else.',
                'self_review_blocked',
            );
        }

        return $locked;
    }

    /**
     * Reuses a pending enrollment if the student already has one for this
     * batch, so approving a resubmitted payment does not create a second seat.
     */
    protected function activateEnrollment(Payment $payment, User $reviewer): Enrollment
    {
        $enrollment = Enrollment::query()
            ->where('user_id', $payment->user_id)
            ->where('batch_id', $payment->batch_id)
            ->lockForUpdate()
            ->first();

        $accessDays = $this->settings->int('operations.default_access_days', 180);
        $batch = $payment->batch;

        // Batch-level access wins when set; otherwise fall back to the
        // institution default counted from today.
        $accessEnd = $batch?->access_until ?? now()->addDays($accessDays);

        if ($enrollment === null) {
            return Enrollment::create([
                'user_id' => $payment->user_id,
                'course_id' => $payment->course_id,
                'batch_id' => $payment->batch_id,
                'status' => EnrollmentStatus::Active->value,
                'access_start_at' => now(),
                'access_end_at' => $accessEnd,
                'source' => 'payment',
                'approved_payment_id' => $payment->getKey(),
                'created_by' => $reviewer->getKey(),
                'activated_at' => now(),
            ]);
        }

        /*
         * Renewal.
         *
         * Keeping the stored end date unconditionally meant a student whose
         * access had already lapsed paid again, saw the payment approved, and
         * was still locked out — the enrolment was Active with an end date in
         * the past. Take whichever is later, so a renewal always moves the
         * date forward and an early renewal never shortens existing access.
         */
        $currentEnd = $enrollment->access_end_at;
        $extendedEnd = $currentEnd === null || $currentEnd->lt($accessEnd) ? $accessEnd : $currentEnd;

        $enrollment->forceFill([
            'status' => EnrollmentStatus::Active->value,
            'access_start_at' => $enrollment->access_start_at ?? now(),
            'access_end_at' => $extendedEnd,
            'approved_payment_id' => $payment->getKey(),
            'activated_at' => $enrollment->activated_at ?? now(),
            'cancelled_at' => null,
            'cancellation_reason' => null,
        ])->save();

        return $enrollment;
    }

    /**
     * The snapshot is the point: a receipt must stay truthful even if the
     * course is renamed, the price changes or the account is later removed.
     */
    protected function issueReceipt(Payment $payment, User $reviewer): Receipt
    {
        $existing = Receipt::where('payment_id', $payment->getKey())->first();

        if ($existing !== null) {
            return $existing;
        }

        $payment->loadMissing(['user', 'course', 'batch', 'method']);

        $receipt = Receipt::create([
            'payment_id' => $payment->getKey(),
            'number' => $this->nextReceiptNumber(),
            'issued_at' => now(),
            'amount_npr' => $payment->submitted_amount_npr,
            'snapshot' => [
                'student_name' => $payment->user?->name ?? 'Student',
                'student_code' => $payment->user?->student_code ?? '',
                'payment_reference' => $payment->transaction_reference ?? $payment->getKey(),
                'payment_method' => $payment->method?->name ?? 'Not recorded',
                'course_title' => $payment->course?->title ?? '',
                'batch_title' => $payment->batch?->title ?? '',
                'institution' => $this->settings->string('institution.name', config('app.name')),

                /*
                 * A gateway approval passes the payer as the reviewer, because
                 * they are the only user in scope. Printing their own name as
                 * the issuer of their receipt is misleading, so the snapshot
                 * says what actually happened.
                 */
                'issued_by' => $reviewer->is($payment->user)
                    ? 'Verified online payment'
                    : $reviewer->name,
            ],
            'issued_by' => $reviewer->getKey(),
        ]);

        // Rendered once at issue time from the snapshot above, so the PDF a
        // student downloads a year from now still shows what was true the
        // day it was issued, not the course's current name or price.
        $receipt->forceFill(['pdf_path' => $this->receiptPdf->generate($receipt)])->save();

        return $receipt;
    }

    /** Sequential per year, generated inside the approval transaction. */
    protected function nextReceiptNumber(): string
    {
        $prefix = $this->settings->string('operations.receipt_prefix', 'RCP');
        $year = now()->year;

        $latest = Receipt::query()
            ->where('number', 'like', "{$prefix}-{$year}-%")
            ->lockForUpdate()
            ->orderByDesc('number')
            ->value('number');

        $sequence = $latest ? ((int) Str::afterLast($latest, '-')) + 1 : 1;

        return sprintf('%s-%d-%05d', $prefix, $year, $sequence);
    }
}
