<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuthMeResource;
use App\Services\AuditLogger;
use App\Services\AuthenticationRevoker;
use App\Services\SettingsRepository;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

/**
 * Satisfies the "change_password" required action: staff created by an officer
 * receive a temporary password and must replace it before the portal opens.
 */
class ChangePasswordController extends Controller
{
    public function __construct(
        protected SettingsRepository $settings,
        protected AuditLogger $audit,
        protected AuthenticationRevoker $revoker,
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        $minimum = $this->settings->int('security.password_min_length', 8);

        $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'confirmed', PasswordRule::min($minimum)->letters()->numbers()],
        ]);

        $user = $request->user();

        if (! Hash::check($request->string('current_password')->value(), $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => 'The current password is incorrect.',
            ]);
        }

        if (Hash::check($request->string('password')->value(), $user->password)) {
            throw ValidationException::withMessages([
                'password' => 'Choose a password you have not used here before.',
            ]);
        }

        $user->forceFill([
            'password' => $request->string('password')->value(),
            'must_change_password' => false,
            'password_changed_at' => now(),
        ])->save();

        // Keep the current browser signed in, drop every other session.
        //
        // session()->regenerate() alone only protects this one browser
        // against session-fixation — it does nothing to a different
        // browser's session or a mobile device's bearer token, both of
        // which kept working fully after a password change that was
        // specifically meant to lock something out (a stolen device, a
        // shared/leaked password). revokeOthers() is the same mechanism the
        // explicit "sign out everywhere else" account action uses, and
        // correctly leaves this request's own session/token untouched.
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        $revoked = $this->revoker->revokeOthers($request, $user);

        $this->audit->log('auth.password_changed', $user, $user, properties: ['sessions_revoked' => $revoked]);

        return ApiResponse::item(new AuthMeResource($user->fresh()));
    }
}
