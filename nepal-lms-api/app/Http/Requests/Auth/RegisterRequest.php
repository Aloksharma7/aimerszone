<?php

namespace App\Http\Requests\Auth;

use App\Services\SettingsRepository;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Public registration is an administrator-controlled switch.
        return app(SettingsRepository::class)->bool('security.public_registration', true);
    }

    public function rules(): array
    {
        $minimum = app(SettingsRepository::class)->int('security.password_min_length', 8);

        return [
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'mobile' => ['required', 'string', 'min:7', 'max:20', 'regex:/^[0-9+\-\s]+$/', Rule::unique('users', 'mobile')->whereNull('deleted_at')],
            'email' => ['required', 'email:filter', 'max:190', Rule::unique('users', 'email')->whereNull('deleted_at')],
            'password' => ['required', 'confirmed', Password::min($minimum)->letters()->numbers()],
            'preferred_language' => ['nullable', Rule::in(['en', 'ne'])],
            'terms_accepted' => ['required', 'accepted'],
            'recording_policy_acknowledged' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'terms_accepted.accepted' => 'The terms of service must be accepted to create an account.',
            'mobile.unique' => 'An account already exists for this mobile number.',
            'email.required' => 'Enter an email address — you will need it to sign in and recover your account.',
            'email.unique' => 'An account already exists for this email address.',
        ];
    }

    protected function failedAuthorization(): void
    {
        abort(403, 'Public registration is currently closed. Contact the institution office to be enrolled.');
    }
}
