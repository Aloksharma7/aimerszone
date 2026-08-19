<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** ApiPayment. The evidence itself is never inlined, only its availability. */
class PaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status->value,
            'expected_amount_npr' => (int) $this->expected_amount_npr,
            'submitted_amount_npr' => (int) $this->submitted_amount_npr,
            'payment_method' => $this->method?->name ?? 'Not recorded',
            'transaction_reference' => $this->transaction_reference,
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'rejection_reason' => $this->rejection_reason,
            'proof_preview_available' => $this->hasProof(),
            'course_title' => $this->course?->title,
            'batch_title' => $this->batch?->title,
        ];
    }
}
