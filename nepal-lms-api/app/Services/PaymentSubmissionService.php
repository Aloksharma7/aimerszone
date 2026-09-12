<?php

namespace App\Services;

use App\Enums\AccessType;
use App\Enums\PaymentStatus;
use App\Exceptions\DomainException;
use App\Models\Batch;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

/**
 * Accepts payment evidence from a student or from staff acting on their behalf.
 *
 * Evidence goes to a private disk and is hashed, so re-using one screenshot for
 * a second submission is visible to the reviewing accountant instead of being
 * an easy way to claim a second seat.
 */
class PaymentSubmissionService
{
    public function __construct(
        protected AuditLogger $audit,
        protected SettingsRepository $settings,
    ) {}

    /**
     * @param  UploadedFile|null  $proof  Null only for a staff draft, which is
     *                                    parked incomplete and never enters the
     *                                    accountant's review queue.
     */
    public function submit(User $student, array $data, ?UploadedFile $proof, ?User $submittedBy = null): Payment
    {
        $batch = Batch::with('course')->findOrFail($data['batch_id']);

        // Checked once here so a request with no chance of succeeding never
        // touches disk for the proof upload; re-checked again below, inside
        // the lock, since state can change between this glance and the lock
        // actually being acquired.
        $this->assertEnrollable($student, $batch);

        $expected = $batch->price_npr ?: $batch->course->price_npr;

        // Store outside the transaction: a rollback should not leave a file
        // handle open, and a failed write must not create a half-recorded row.
        $stored = $proof !== null
            ? $this->storeProof($proof, $student)
            : ['path' => null, 'disk' => null, 'mime' => null, 'size' => null, 'hash' => null];

        return DB::transaction(function () use ($student, $batch, $data, $stored, $submittedBy, $expected) {
            // Locking the batch serializes every submission attempt against
            // it — the previous plain reads in assertEnrollable() let two
            // near-simultaneous requests (two browser tabs, or a manual
            // submission racing an eSewa checkout) both pass before either
            // had actually committed a row, so both could end up approved
            // independently: two Payments and two Receipts booked for one
            // seat, even though Enrollment's own unique constraint stopped
            // the seat itself from being duplicated.
            $locked = Batch::with('course')->whereKey($batch->getKey())->lockForUpdate()->firstOrFail();
            $this->assertEnrollable($student, $locked);

            $payment = Payment::create([
                'user_id' => $student->getKey(),
                'course_id' => $batch->course_id,
                'batch_id' => $batch->getKey(),
                'payment_method_id' => $data['payment_method_id'],
                'status' => PaymentStatus::Submitted->value,
                'expected_amount_npr' => $expected,
                'submitted_amount_npr' => $data['amount_npr'],
                'payer_name' => $data['payer_name'],
                'transaction_reference' => $data['transaction_reference'] ?? null,
                'paid_at' => $data['paid_at'],
                'submitted_at' => now(),
                'note' => $data['note'] ?? null,
                'proof_path' => $stored['path'],
                'proof_disk' => $stored['disk'],
                'proof_mime' => $stored['mime'],
                'proof_size' => $stored['size'],
                'proof_hash' => $stored['hash'],
                'submitted_by' => $submittedBy?->getKey() ?? $student->getKey(),
                'risk_label' => $stored['hash'] !== null
                    ? $this->riskLabel($stored['hash'], $data['amount_npr'], $expected)
                    : null,
            ]);

            $this->audit->log('payment.submitted', $payment, $submittedBy ?? $student, properties: [
                'amount' => $data['amount_npr'],
                'expected' => $expected,
                'on_behalf' => $submittedBy !== null && ! $submittedBy->is($student),
            ]);

            return $payment;
        });
    }

    /**
     * A student cannot pay twice for a seat they already hold or await.
     *
     * Public so EsewaController's checkout() can reuse the exact same rules
     * rather than a separately hand-maintained, easily-drifting subset —
     * checkout() previously only checked "already enrolled" and nothing
     * else, so a student with a manual payment already pending review (or
     * a batch that had since filled up) could still start a gateway
     * checkout for the same seat.
     */
    public function assertEnrollable(User $student, Batch $batch): void
    {
        if ($batch->course->access_type === AccessType::Free) {
            throw DomainException::unprocessable('This course is free and does not require payment.', 'course_is_free');
        }

        if (! in_array($batch->status->value, ['open', 'ongoing'], true)) {
            throw DomainException::conflict(
                $batch->status->value === 'draft'
                    ? 'This batch is still in Draft status. Open it for enrollment from the batch page, then try again.'
                    : "This batch is {$batch->status->label()} and is not accepting enrollments.",
                'batch_closed',
            );
        }

        if ($batch->isFull()) {
            throw DomainException::conflict('This batch is full.', 'batch_full');
        }

        $active = $student->enrollments()->where('batch_id', $batch->getKey())->accessible()->exists();

        if ($active) {
            throw DomainException::conflict('You are already enrolled in this batch.', 'already_enrolled');
        }

        $pending = $student->payments()
            ->where('batch_id', $batch->getKey())
            ->pendingReview()
            ->exists();

        if ($pending) {
            throw DomainException::conflict(
                'A payment for this batch is already under review.',
                'payment_already_pending',
            );
        }
    }

    /**
     * @return array{path: string, disk: string, mime: string, size: int, hash: string}
     */
    protected function storeProof(UploadedFile $proof, User $student): array
    {
        $hash = hash_file('sha256', $proof->getRealPath());

        $path = $proof->store(
            'payment-proof/'.$student->getKey().'/'.now()->format('Y/m'),
            ['disk' => 'local'],
        );

        if ($path === false) {
            throw DomainException::unprocessable('The evidence file could not be stored. Try again.', 'upload_failed');
        }

        return [
            'path' => $path,
            'disk' => 'local',
            // Detected from the file's own bytes, never the client's claim:
            // this value is later reflected as the Content-Type of an inline
            // response, so trusting the upload header would let a crafted file
            // be served as a type the browser will execute.
            'mime' => $proof->getMimeType() ?: 'application/octet-stream',
            'size' => $proof->getSize(),
            'hash' => $hash,
        ];
    }

    /** Surfaces the two things a reviewer most needs flagged. */
    protected function riskLabel(string $hash, int $submitted, int $expected): ?string
    {
        if (Payment::where('proof_hash', $hash)->exists()) {
            return 'duplicate_evidence';
        }

        // A genuine scholarship or fee waiver, not a mistake — flagged
        // distinctly from an ordinary short payment so a reviewer does not
        // read it as an error to chase up with the student.
        if ($submitted === 0) {
            return 'full_waiver';
        }

        if ($submitted < $expected) {
            return 'short_payment';
        }

        if ($submitted > $expected) {
            return 'overpayment';
        }

        return null;
    }
}
