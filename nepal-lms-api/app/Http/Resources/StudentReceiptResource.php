<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * ApiStudentReceipt. Values come from the immutable snapshot captured when the
 * receipt was issued, not from the live records, so a later name or price
 * change cannot rewrite a receipt that was already given to a student.
 */
class StudentReceiptResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $snapshot = $this->snapshot ?? [];

        return [
            'id' => $this->id,
            'payment_id' => $this->payment_id,
            'issued_at' => $this->issued_at->toIso8601String(),
            'student_name' => $snapshot['student_name'] ?? '',
            'student_code' => $snapshot['student_code'] ?? '',
            'payment_reference' => $snapshot['payment_reference'] ?? $this->number,
            'payment_method' => $snapshot['payment_method'] ?? '',
            'course_title' => $snapshot['course_title'] ?? '',
            'batch_title' => $snapshot['batch_title'] ?? '',
            'amount_npr' => (int) $this->amount_npr,
        ];
    }
}
