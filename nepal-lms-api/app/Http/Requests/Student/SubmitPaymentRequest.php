<?php

namespace App\Http\Requests\Student;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SubmitPaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('submit', \App\Models\Payment::class) ?? false;
    }

    public function rules(): array
    {
        $maxKb = (int) config('lms.uploads.proof_max_kb', 5120);
        $mimes = implode(',', (array) config('lms.uploads.proof_mimes', ['jpg', 'jpeg', 'png', 'webp', 'pdf']));

        return [
            'batch_id' => ['required', 'string', Rule::exists('batches', 'id')->whereNull('deleted_at')],
            'payment_method_id' => ['required', 'string', Rule::exists('payment_methods', 'id')->where('is_active', true)],
            'amount_npr' => ['required', 'integer', 'min:1', 'max:10000000'],
            'payer_name' => ['required', 'string', 'min:2', 'max:120'],
            'transaction_reference' => ['nullable', 'string', 'max:120'],

            // A payment cannot have been made in the future, and evidence older
            // than a year is almost certainly the wrong file.
            'paid_at' => ['required', 'date', 'before_or_equal:now', 'after:'.now()->subYear()->toDateString()],

            'note' => ['nullable', 'string', 'max:500'],
            'proof_file' => ['required', 'file', "mimes:{$mimes}", "max:{$maxKb}"],
        ];
    }

    public function messages(): array
    {
        return [
            'proof_file.required' => 'Attach a screenshot or voucher showing the payment.',
            'proof_file.mimes' => 'Upload a JPG, PNG, WEBP or PDF file.',
            'proof_file.max' => 'The evidence file is larger than the allowed size.',
            'paid_at.before_or_equal' => 'The payment date cannot be in the future.',
        ];
    }
}
