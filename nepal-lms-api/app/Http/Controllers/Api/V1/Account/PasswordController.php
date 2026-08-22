<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use App\Services\AuthenticationRevoker;
use App\Services\SettingsRepository;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

class PasswordController extends Controller
{
    public function __construct(
        protected SettingsRepository $settings,
        protected AuditLogger $audit,
        protected AuthenticationRevoker $revoker,
    ) {}

    public function update(Request $request): JsonResponse
    {
        $minimum = $this->settings->int('security.password_min_length', 8);

        $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'confirmed', PasswordRule::min($minimum)->letters()->numbers()],
        ]);

        $user = $request->user();

        if (! Hash::check($request->string('current_password')->value(), $user->password)) {
            throw ValidationException::withMessages(['current_password' => 'The current password is incorrect.']);
        }

        $user->forceFill([
            'password' => $request->string('password')->value(),
            'must_change_password' => false,
            'password_changed_at' => now(),
        ])->save();

        // Other devices lose access; this one — whichever mechanism it used
        // to authenticate — stays signed in.
        $this->revoker->revokeOthers($request, $user);

        // Only a real cookie session needs a fresh ID; a token request has
        // none to regenerate.
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        $this->audit->log('account.password_changed', $user, $user);

        return ApiResponse::message('Your password has been updated on this device and others were signed out.');
    }
}
