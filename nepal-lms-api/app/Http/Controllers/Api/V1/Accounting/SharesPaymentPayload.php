<?php

namespace App\Http\Controllers\Api\V1\Accounting;

use App\Models\Payment;

/** Queue row shaping shared by the dashboard and the payments list. */
trait SharesPaymentPayload
{
    protected function queuePayload(Payment $payment): array
    {
        return [
            'id' => $payment->id,
            // $payment->user applies User's soft-delete scope, so an
            // archived payer's row rendered blank here — with no fallback
            // at all, unlike the single-record show() view — in the exact
            // list an accountant scans to decide what to review next.
            'student_name' => $payment->user?->name ?? 'Removed account',
            'status' => $payment->status->value,
            'expected_amount_npr' => (int) $payment->expected_amount_npr,
            'submitted_amount_npr' => (int) $payment->submitted_amount_npr,
            'payment_method' => $payment->method?->name ?? 'Not recorded',
            'transaction_reference' => $payment->transaction_reference,
            'submitted_at' => $payment->submitted_at?->toIso8601String(),
            'rejection_reason' => $payment->rejection_reason,
            'proof_preview_available' => $payment->hasProof(),
            'course_title' => $payment->course?->title,
            'batch_title' => $payment->batch?->title,
            'risk_label' => match ($payment->risk_label) {
                'duplicate_evidence' => 'Duplicate evidence',
                'short_payment' => 'Short payment',
                'full_waiver' => 'Full waiver',
                'overpayment' => 'Overpayment',
                'flagged_duplicate' => 'Flagged',
                default => 'Normal',
            },
        ];
    }

    protected function humanSize(?int $bytes): ?string
    {
        if ($bytes === null) {
            return null;
        }

        return $bytes >= 1048576
            ? round($bytes / 1048576, 1).' MB'
            : max(1, (int) round($bytes / 1024)).' KB';
    }
}
